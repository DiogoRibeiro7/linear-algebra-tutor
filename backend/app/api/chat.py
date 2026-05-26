"""Chat API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from pydantic import BaseModel
from typing import List, Optional

from app.config import get_settings
from app.core.limiter import limiter
from app.core.security import get_current_active_user
from app.db.session import get_db
from app.models import User, Conversation, Message
from app.services.tutor import tutor_service

settings = get_settings()
router = APIRouter()


class ChatMessage(BaseModel):
    """Chat message schema."""

    content: str


class ChatResponse(BaseModel):
    """Chat response schema."""

    answer: str
    sources: List[dict] = []
    conversation_id: int
    message_id: int


class ConversationCreate(BaseModel):
    """Schema for creating a new conversation."""

    title: Optional[str] = "New Conversation"


class ConversationUpdate(BaseModel):
    """Partial-update payload for PATCH /conversations/{id}.

    Any field left as None is ignored, so callers can update one field
    at a time (e.g. just toggle pinned) without resending the others.
    """

    title: Optional[str] = None
    pinned: Optional[bool] = None


class ConversationResponse(BaseModel):
    """Conversation response schema."""

    id: int
    title: Optional[str] = None
    pinned: bool = False
    created_at: str
    message_count: int


class MessageResponse(BaseModel):
    """Single message in a conversation, as returned by GET /messages."""

    id: int
    role: Optional[str] = None
    content: Optional[str] = None
    # API uses "metadata" while the column is named extra_metadata to dodge
    # SQLAlchemy's reserved attribute name; keep the wire shape unchanged.
    metadata: Optional[dict] = None
    created_at: str


@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    data: ConversationCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new conversation."""
    conversation = Conversation(user_id=current_user.id, title=data.title)

    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)

    return ConversationResponse(
        id=conversation.id,
        title=conversation.title,
        pinned=conversation.pinned,
        created_at=conversation.created_at.isoformat(),
        message_count=0,
    )


@router.patch(
    "/conversations/{conversation_id}",
    response_model=ConversationResponse,
)
async def update_conversation(
    conversation_id: int,
    data: ConversationUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update fields on a conversation (currently: title, pinned)."""
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Apply only the fields the caller actually sent.
    update = data.model_dump(exclude_unset=True)
    for field, value in update.items():
        setattr(conversation, field, value)

    await db.commit()
    await db.refresh(conversation)

    msg_count_q = await db.execute(
        select(func.count(Message.id)).where(
            Message.conversation_id == conversation_id
        )
    )
    msg_count = msg_count_q.scalar_one()

    return ConversationResponse(
        id=conversation.id,
        title=conversation.title,
        pinned=conversation.pinned,
        created_at=conversation.created_at.isoformat(),
        message_count=msg_count,
    )


@router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all conversations for the current user.

    Sort key: pinned-first, then most-recently-updated.
    """
    msg_count = func.count(Message.id)
    result = await db.execute(
        select(Conversation, msg_count)
        .outerjoin(Message, Message.conversation_id == Conversation.id)
        .where(Conversation.user_id == current_user.id)
        .group_by(Conversation.id)
        .order_by(Conversation.pinned.desc(), Conversation.updated_at.desc())
    )

    return [
        ConversationResponse(
            id=conv.id,
            title=conv.title,
            pinned=conv.pinned,
            created_at=conv.created_at.isoformat(),
            message_count=count,
        )
        for conv, count in result.all()
    ]


@router.post("/conversations/{conversation_id}/messages", response_model=ChatResponse)
@limiter.limit(f"{settings.RATE_LIMIT_PER_MINUTE}/minute")
async def send_message(
    request: Request,
    conversation_id: int,
    message: ChatMessage,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message in a conversation."""
    # Verify conversation belongs to user
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id, Conversation.user_id == current_user.id
        )
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Snapshot the history *before* persisting the new user message so we don't
    # have to filter it back out, then save the user message.
    history_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    conversation_history = [
        {"role": msg.role or "", "content": msg.content or ""}
        for msg in history_result.scalars().all()
    ]

    user_message = Message(
        conversation_id=conversation_id, role="user", content=message.content
    )
    db.add(user_message)
    await db.commit()

    # Generate response using tutor service
    response = await tutor_service.answer_question(
        question=message.content,
        conversation_history=conversation_history,
        use_rag=True,
    )

    # Save assistant response
    assistant_message = Message(
        conversation_id=conversation_id,
        role="assistant",
        content=response["answer"],
        extra_metadata={"sources": response["sources"]},
    )
    db.add(assistant_message)
    await db.commit()
    await db.refresh(assistant_message)

    return ChatResponse(
        answer=response["answer"],
        sources=response["sources"],
        conversation_id=conversation_id,
        message_id=assistant_message.id,
    )


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=List[MessageResponse],
)
async def get_messages(
    conversation_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all messages in a conversation."""
    # Verify conversation belongs to user
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id, Conversation.user_id == current_user.id
        )
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )

    return [
        MessageResponse(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            metadata=msg.extra_metadata,
            created_at=msg.created_at.isoformat(),
        )
        for msg in messages_result.scalars().all()
    ]
