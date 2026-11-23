from sqlalchemy import Column, Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import relationship

from app.core.database import Base

MONEY = Numeric(15, 3)


class Wedding(Base):
    __tablename__ = 'weddings'

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    name = Column(String, nullable=False)
    budget_total = Column(MONEY, default=0)
    estimated_expenses = Column(MONEY, default=0)
    amount_paid = Column(MONEY, default=0)
    currency = Column(String, default='TND')
    wedding_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship('User', back_populates='weddings')
    budgets = relationship('WeddingBudget', back_populates='wedding', cascade='all, delete-orphan')
    shopping_items = relationship('ShoppingItem', back_populates='wedding', cascade='all, delete-orphan')


class WeddingBudget(Base):
    __tablename__ = 'wedding_budgets'

    id = Column(String, primary_key=True, index=True)
    wedding_id = Column(String, ForeignKey('weddings.id'), nullable=False)
    category = Column(String, nullable=False)
    planned_amount = Column(MONEY, default=0)
    actual_amount = Column(MONEY, default=0)
    currency = Column(String, default='TND')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    wedding = relationship('Wedding', back_populates='budgets')


class ShoppingItem(Base):
    __tablename__ = 'shopping_items'

    id = Column(String, primary_key=True, index=True)
    wedding_id = Column(String, ForeignKey('weddings.id'), nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, default='Other')
    description = Column(Text, nullable=True)
    room = Column(String, nullable=True)
    quantity = Column(String, default='1')
    estimated_unit_price = Column(MONEY, default=0)
    confirmed_unit_price = Column(MONEY, default=0)
    actual_unit_price = Column(MONEY, default=0)
    amount_paid = Column(MONEY, default=0)
    priority = Column(String, default='medium')
    status = Column(String, default='pending')
    purchase_date = Column(Date, nullable=True)
    supplier = Column(String, nullable=True)
    warranty_info = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    wedding = relationship('Wedding', back_populates='shopping_items')
