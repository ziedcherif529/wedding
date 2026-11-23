from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, func

from app.core.database import Base


class RefreshToken(Base):
    __tablename__ = 'refresh_tokens'

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    token_hash = Column(String, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
