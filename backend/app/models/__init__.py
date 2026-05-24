"""Database models."""
from datetime import datetime
from typing import Any, List, Optional

from sqlalchemy import ForeignKey, JSON, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    """User model for students."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    username: Mapped[str] = mapped_column(unique=True, index=True)
    hashed_password: Mapped[str]
    full_name: Mapped[Optional[str]]
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    conversations: Mapped[List["Conversation"]] = relationship(back_populates="user")
    progress: Mapped[List["StudentProgress"]] = relationship(back_populates="user")


class Conversation(Base):
    """Conversation session between student and AI tutor."""
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    title: Mapped[Optional[str]]
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped[Optional["User"]] = relationship(back_populates="conversations")
    messages: Mapped[List["Message"]] = relationship(back_populates="conversation")


class Message(Base):
    """Individual message in a conversation."""
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    conversation_id: Mapped[Optional[int]] = mapped_column(ForeignKey("conversations.id"))
    role: Mapped[Optional[str]]  # "user" or "assistant"
    content: Mapped[Optional[str]] = mapped_column(Text)
    extra_metadata: Mapped[Optional[Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    conversation: Mapped[Optional["Conversation"]] = relationship(back_populates="messages")


class Problem(Base):
    """Problem from the problem bank."""
    __tablename__ = "problems"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str]
    description: Mapped[str] = mapped_column(Text)
    topic: Mapped[Optional[str]] = mapped_column(index=True)
    difficulty: Mapped[Optional[int]]  # 1-5
    solution: Mapped[Optional[str]] = mapped_column(Text)
    hints: Mapped[Optional[Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    attempts: Mapped[List["ProblemAttempt"]] = relationship(back_populates="problem")


class ProblemAttempt(Base):
    """Track student attempts at problems."""
    __tablename__ = "problem_attempts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    problem_id: Mapped[Optional[int]] = mapped_column(ForeignKey("problems.id"))
    is_correct: Mapped[bool] = mapped_column(default=False)
    attempt_data: Mapped[Optional[Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    problem: Mapped[Optional["Problem"]] = relationship(back_populates="attempts")


class StudentProgress(Base):
    """Track student progress across topics."""
    __tablename__ = "student_progress"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    topic: Mapped[Optional[str]] = mapped_column(index=True)
    mastery_score: Mapped[float] = mapped_column(default=0.0)
    problems_completed: Mapped[int] = mapped_column(default=0)
    last_practice: Mapped[Optional[datetime]]
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped[Optional["User"]] = relationship(back_populates="progress")
