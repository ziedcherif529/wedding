from pydantic import BaseModel


class WeddingCreate(BaseModel):
    name: str
    budget_total: float = 0
    currency: str = 'TND'


class WeddingBudgetCreate(BaseModel):
    category: str
    planned_amount: float = 0
    actual_amount: float = 0
    currency: str = 'TND'


class ShoppingItemCreate(BaseModel):
    name: str
    category: str = 'Other'
    quantity: str = '1'
    estimated_unit_price: float = 0
    actual_unit_price: float = 0
    amount_paid: float = 0
    priority: str = 'medium'
    status: str = 'pending'
    notes: str | None = None
