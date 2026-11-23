from pydantic import BaseModel


class IncomeCreate(BaseModel):
    description: str
    source: str
    category: str = 'other'
    expected_amount: float = 0
    received_amount: float = 0
    transaction_date: str
    status: str = 'received'
    notes: str | None = None


class ExpenseCreate(BaseModel):
    description: str
    category: str = 'other'
    amount: float = 0
    transaction_date: str
    payment_method: str = 'cash'
    budget_category: str = 'other'
    notes: str | None = None


class MonthlyBudgetCreate(BaseModel):
    category: str
    budget_amount: float = 0
    month: str


class SavingsGoalCreate(BaseModel):
    name: str
    target_amount: float = 0
    current_savings: float = 0
    target_date: str | None = None
    monthly_contribution: float = 0
