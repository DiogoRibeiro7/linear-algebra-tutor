"""Chat API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional

from app.db.session import get_db
from app.core.security import get_current_active_user
from app.models import User, Conversation, Message
from app.services.tutor import tutor_service

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


class ConversationResponse(BaseModel):
    """Conversation response schema."""
    id: int
    title: str
    created_at: str
    message_count: int


@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    data: ConversationCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new conversation."""
    conversation = Conversation(
        user_id=current_user.id,
        title=data.title
    )
    
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    
    return ConversationResponse(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at.isoformat(),
        message_count=0
    )


@router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all conversations for the current user."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
    )
    conversations = result.scalars().all()
    
    response = []
    for conv in conversations:
        msg_count = await db.execute(
            select(Message).where(Message.conversation_id == conv.id)
        )
        response.append(ConversationResponse(
            id=conv.id,
            title=conv.title,
            created_at=conv.created_at.isoformat(),
            message_count=len(msg_count.scalars().all())
        ))
    
    return response


@router.post("/conversations/{conversation_id}/messages", response_model=ChatResponse)
async def send_message(
    conversation_id: int,
    message: ChatMessage,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a message in a conversation."""
    # Verify conversation belongs to user
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id
        )
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Save user message
    user_message = Message(
        conversation_id=conversation_id,
        role="user",
        content=message.content
    )
    db.add(user_message)
    await db.commit()
    
    # Get conversation history
    history_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    messages = history_result.scalars().all()
    
    conversation_history = [
        {"role": msg.role, "content": msg.content}
        for msg in messages[:-1]  # Exclude the message we just added
    ]
    
    # Generate response using tutor service
    response = await tutor_service.answer_question(
        question=message.content,
        conversation_history=conversation_history,
        use_rag=True
    )
    
    # Save assistant response
    assistant_message = Message(
        conversation_id=conversation_id,
        role="assistant",
        content=response["answer"],
        metadata={"sources": response["sources"]}
    )
    db.add(assistant_message)
    await db.commit()
    await db.refresh(assistant_message)
    
    return ChatResponse(
        answer=response["answer"],
        sources=response["sources"],
        conversation_id=conversation_id,
        message_id=assistant_message.id
    )


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all messages in a conversation."""
    # Verify conversation belongs to user
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id
        )
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Get messages
    messages_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    messages = messages_result.scalars().all()
    
    return [
        {
            "id": msg.id,
            "role": msg.role,
            "content": msg.content,
            "metadata": msg.metadata,
            "created_at": msg.created_at.isoformat()
        }
        for msg in messages
    ]
