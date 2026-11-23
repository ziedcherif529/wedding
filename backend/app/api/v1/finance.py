import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import extract
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.finance import Debt, ExpenseTransaction, IncomeTransaction, MonthlyBudget, SavingsGoal
from app.models.user import User
from app.schemas.finance import ExpenseCreate, IncomeCreate, MonthlyBudgetCreate, SavingsGoalCreate

router = APIRouter(prefix='/finance', tags=['finance'])


@router.get('/dashboard')
def dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.now()
    month_income = db.query(IncomeTransaction).filter(
        IncomeTransaction.user_id == current_user.id,
        extract('year', IncomeTransaction.transaction_date) == now.year,
        extract('month', IncomeTransaction.transaction_date) == now.month,
    ).all()
    month_expenses = db.query(ExpenseTransaction).filter(
        ExpenseTransaction.user_id == current_user.id,
        extract('year', ExpenseTransaction.transaction_date) == now.year,
        extract('month', ExpenseTransaction.transaction_date) == now.month,
    ).all()
    monthly_income = sum((float(item.received_amount or 0) for item in month_income), 0)
    monthly_expense = sum((float(item.amount or 0) for item in month_expenses), 0)
    total_savings = sum((float(item.current_savings or 0) for item in db.query(SavingsGoal).filter(SavingsGoal.user_id == current_user.id).all()), 0)
    total_debt = sum((float(item.remaining_balance or 0) for item in db.query(Debt).filter(Debt.user_id == current_user.id).all()), 0)
    monthly_budget = sum(
        (float(item.budget_amount or 0) for item in db.query(MonthlyBudget).filter(
            MonthlyBudget.user_id == current_user.id,
            MonthlyBudget.month == now.strftime('%Y-%m'),
        ).all()),
        0,
    )
    return {
        'monthly_income': monthly_income,
        'monthly_expenses': monthly_expense,
        'monthly_balance': monthly_income - monthly_expense,
        'total_savings': total_savings,
        'total_debt': total_debt,
        'savings_rate': round((total_savings / monthly_income * 100) if monthly_income else 0, 2),
        'budget_utilization': round((monthly_expense / monthly_budget * 100) if monthly_budget else 0, 2),
    }


@router.post('/income')
def create_income(payload: IncomeCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = IncomeTransaction(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        description=payload.description,
        source=payload.source,
        category=payload.category,
        expected_amount=Decimal(str(payload.expected_amount)),
        received_amount=Decimal(str(payload.received_amount)),
        transaction_date=datetime.fromisoformat(payload.transaction_date),
        status=payload.status,
        notes=payload.notes,
    )
    db.add(item)
    db.commit()
    return {'id': item.id}


@router.get('/income')
def list_income(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(IncomeTransaction).filter(IncomeTransaction.user_id == current_user.id).all()
    return [{'id': i.id, 'description': i.description, 'source': i.source, 'received_amount': float(i.received_amount or 0)} for i in items]


@router.post('/expenses')
def create_expense(payload: ExpenseCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = ExpenseTransaction(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        description=payload.description,
        category=payload.category,
        amount=Decimal(str(payload.amount)),
        transaction_date=datetime.fromisoformat(payload.transaction_date),
        payment_method=payload.payment_method,
        budget_category=payload.budget_category,
        notes=payload.notes,
    )
    db.add(item)
    db.commit()
    return {'id': item.id}


@router.get('/expenses')
def list_expenses(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(ExpenseTransaction).filter(ExpenseTransaction.user_id == current_user.id).all()
    return [{'id': e.id, 'description': e.description, 'category': e.category, 'amount': float(e.amount or 0), 'notes': e.notes} for e in items]


@router.put('/expenses/{expense_id}')
def update_expense(expense_id: str, payload: ExpenseCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    expense = db.query(ExpenseTransaction).filter(ExpenseTransaction.id == expense_id, ExpenseTransaction.user_id == current_user.id).first()
    if not expense:
        raise HTTPException(status_code=404, detail='Expense not found')
    expense.description = payload.description
    expense.category = payload.category
    expense.amount = Decimal(str(payload.amount))
    expense.transaction_date = datetime.fromisoformat(payload.transaction_date)
    expense.payment_method = payload.payment_method
    expense.budget_category = payload.budget_category
    expense.notes = payload.notes
    db.commit()
    return {'message': 'Expense updated'}


@router.delete('/expenses/{expense_id}')
def delete_expense(expense_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    expense = db.query(ExpenseTransaction).filter(ExpenseTransaction.id == expense_id, ExpenseTransaction.user_id == current_user.id).first()
    if not expense:
        raise HTTPException(status_code=404, detail='Expense not found')
    db.delete(expense)
    db.commit()
    return {'message': 'Expense deleted'}


@router.post('/budgets')
def create_budget(payload: MonthlyBudgetCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = MonthlyBudget(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        category=payload.category,
        budget_amount=Decimal(str(payload.budget_amount)),
        month=payload.month,
    )
    db.add(item)
    db.commit()
    return {'id': item.id}


@router.get('/budgets')
def list_budgets(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(MonthlyBudget).filter(MonthlyBudget.user_id == current_user.id).all()
    return [{'id': b.id, 'category': b.category, 'budget_amount': float(b.budget_amount or 0), 'month': b.month} for b in items]


@router.post('/savings-goals')
def create_savings_goal(payload: SavingsGoalCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = SavingsGoal(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=payload.name,
        target_amount=Decimal(str(payload.target_amount)),
        current_savings=Decimal(str(payload.current_savings)),
        monthly_contribution=Decimal(str(payload.monthly_contribution)),
        target_date=datetime.fromisoformat(payload.target_date) if payload.target_date else None,
    )
    db.add(item)
    db.commit()
    return {'id': item.id}


@router.get('/savings-goals')
def list_savings_goals(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(SavingsGoal).filter(SavingsGoal.user_id == current_user.id).all()
    return [{'id': g.id, 'name': g.name, 'target_amount': float(g.target_amount or 0), 'current_savings': float(g.current_savings or 0)} for g in items]
