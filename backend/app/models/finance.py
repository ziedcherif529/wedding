from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class IncomeTransaction(Base):
    __tablename__ = 'income_transactions'

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    description = Column(String, nullable=False)
    source = Column(String, nullable=False)
    category = Column(String, default='other')
    expected_amount = Column(Numeric(10, 2), default=0)
    received_amount = Column(Numeric(10, 2), default=0)
    transaction_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(String, default='received')
    notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship('User', back_populates='incomes')


class ExpenseTransaction(Base):
    __tablename__ = 'expense_transactions'

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    description = Column(String, nullable=False)
    category = Column(String, default='other')
    amount = Column(Numeric(10, 2), default=0)
    transaction_date = Column(DateTime(timezone=True), nullable=False)
    payment_method = Column(String, default='cash')
    budget_category = Column(String, default='other')
    notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship('User', back_populates='expenses')


class MonthlyBudget(Base):
    __tablename__ = 'monthly_budgets'

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    category = Column(String, nullable=False)
    budget_amount = Column(Numeric(10, 2), default=0)
    month = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Debt(Base):
    __tablename__ = 'debts'

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, default='loan')
    creditor = Column(String, nullable=False)
    original_amount = Column(Numeric(10, 2), default=0)
    remaining_balance = Column(Numeric(10, 2), default=0)
    monthly_installment = Column(Numeric(10, 2), default=0)
    interest_rate = Column(Numeric(5, 2), default=0)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    next_payment_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default='active')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship('User', back_populates='debts')


class SavingsGoal(Base):
    __tablename__ = 'savings_goals'

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    name = Column(String, nullable=False)
    target_amount = Column(Numeric(10, 2), default=0)
    current_savings = Column(Numeric(10, 2), default=0)
    target_date = Column(DateTime(timezone=True), nullable=True)
    monthly_contribution = Column(Numeric(10, 2), default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship('User', back_populates='savings_goals')
