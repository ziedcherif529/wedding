from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Subscription(Base):
    __tablename__ = 'subscriptions'

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    plan_name = Column(String, nullable=False)
    status = Column(String, default='trial')
    amount = Column(Numeric(10, 2), default=0)
    currency = Column(String, default='TND')
    billing_interval = Column(String, default='month')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship('User', back_populates='subscriptions')
