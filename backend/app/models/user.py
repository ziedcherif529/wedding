from sqlalchemy import Boolean, Column, DateTime, String, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class User(Base):
    __tablename__ = 'users'

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    role = Column(String, default='USER', nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    workspaces = relationship('Workspace', back_populates='owner')
    weddings = relationship('Wedding', back_populates='user')
    expenses = relationship('ExpenseTransaction', back_populates='user')
    incomes = relationship('IncomeTransaction', back_populates='user')
    debts = relationship('Debt', back_populates='user')
    savings_goals = relationship('SavingsGoal', back_populates='user')
    subscriptions = relationship('Subscription', back_populates='user')
