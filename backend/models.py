# speaking_coach_backend/models.py
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)

    speeches = relationship("Speech", back_populates="user")

class Speech(Base):
    __tablename__ = "speeches"

    id = Column(Integer, primary_key=True, index=True)
    transcript = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="speeches")

    feedback = relationship("Feedback", back_populates="speech", uselist=False)

class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    opening = Column(Text)
    content = Column(Text)
    delivery = Column(Text)
    grammar = Column(Text)
    overall = Column(Text)
    suggestions = Column(Text)

    # ✅ New numeric scores
    score_opening = Column(Integer)
    score_content = Column(Integer)
    score_delivery = Column(Integer)
    score_grammar = Column(Integer)
    score_overall = Column(Integer)

    speech_id = Column(Integer, ForeignKey("speeches.id"))
    speech = relationship("Speech", back_populates="feedback")

