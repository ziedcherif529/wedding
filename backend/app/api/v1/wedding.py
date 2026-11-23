import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.wedding import ShoppingItem, Wedding, WeddingBudget
from app.schemas.wedding import ShoppingItemCreate, WeddingBudgetCreate, WeddingCreate

router = APIRouter(prefix='/wedding', tags=['wedding'])


@router.get('/dashboard')
def dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wedding = db.query(Wedding).filter(Wedding.user_id == current_user.id).order_by(Wedding.created_at.desc()).first()
    if not wedding:
        return {
            'total_budget': 0,
            'estimated_expenses': 0,
            'total_paid': 0,
            'remaining': 0,
            'budget_utilization': 0,
            'completed_purchases': 0,
            'pending_purchases': 0,
            'upcoming_payments': 0,
            'overdue_payments': 0,
            'countdown_days': 0,
            'recent_activities': [],
        }
    total_budget = float(wedding.budget_total or 0)
    estimated = float(wedding.estimated_expenses or 0)
    total_paid = float(wedding.amount_paid or 0)
    remaining = max(total_budget - total_paid, 0)
    completed_purchases = db.query(ShoppingItem).filter(ShoppingItem.wedding_id == wedding.id, ShoppingItem.status == 'completed').count()
    pending_purchases = db.query(ShoppingItem).filter(ShoppingItem.wedding_id == wedding.id, ShoppingItem.status != 'completed').count()
    days = 0
    if wedding.wedding_date:
        delta = wedding.wedding_date - datetime.utcnow()
        days = max(delta.days, 0)
    return {
        'total_budget': total_budget,
        'estimated_expenses': estimated,
        'total_paid': total_paid,
        'remaining': remaining,
        'budget_utilization': round((estimated / total_budget * 100) if total_budget else 0, 2),
        'completed_purchases': completed_purchases,
        'pending_purchases': pending_purchases,
        'upcoming_payments': 0,
        'overdue_payments': 0,
        'countdown_days': days,
        'recent_activities': [{'label': 'Wedding created', 'value': wedding.name}],
    }


@router.post('', response_model=dict)
def create_wedding(payload: WeddingCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wedding = Wedding(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=payload.name,
        budget_total=Decimal(str(payload.budget_total)),
        currency=payload.currency,
    )
    db.add(wedding)
    db.commit()
    db.refresh(wedding)
    return {'id': wedding.id, 'name': wedding.name}


@router.get('')
def list_weddings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    weddings = db.query(Wedding).filter(Wedding.user_id == current_user.id).all()
    return [{'id': w.id, 'name': w.name, 'budget_total': float(w.budget_total or 0), 'currency': w.currency} for w in weddings]


@router.post('/budgets')
def create_budget(payload: WeddingBudgetCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wedding = db.query(Wedding).filter(Wedding.user_id == current_user.id).order_by(Wedding.created_at.desc()).first()
    if not wedding:
        raise HTTPException(status_code=400, detail='Create a wedding first')
    budget = WeddingBudget(
        id=str(uuid.uuid4()),
        wedding_id=wedding.id,
        category=payload.category,
        planned_amount=Decimal(str(payload.planned_amount)),
        actual_amount=Decimal(str(payload.actual_amount)),
        currency=payload.currency,
    )
    db.add(budget)
    db.commit()
    return {'id': budget.id, 'category': budget.category}


@router.get('/budgets')
def list_budgets(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wedding = db.query(Wedding).filter(Wedding.user_id == current_user.id).order_by(Wedding.created_at.desc()).first()
    if not wedding:
        return []
    budgets = db.query(WeddingBudget).filter(WeddingBudget.wedding_id == wedding.id).all()
    return [{'id': b.id, 'category': b.category, 'planned_amount': float(b.planned_amount or 0), 'actual_amount': float(b.actual_amount or 0)} for b in budgets]


@router.post('/shopping-items')
def create_shopping_item(payload: ShoppingItemCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wedding = db.query(Wedding).filter(Wedding.user_id == current_user.id).order_by(Wedding.created_at.desc()).first()
    if not wedding:
        raise HTTPException(status_code=400, detail='Create a wedding first')
    item = ShoppingItem(
        id=str(uuid.uuid4()),
        wedding_id=wedding.id,
        name=payload.name,
        category=payload.category,
        quantity=payload.quantity,
        estimated_unit_price=Decimal(str(payload.estimated_unit_price)),
        actual_unit_price=Decimal(str(payload.actual_unit_price)),
        amount_paid=Decimal(str(payload.amount_paid)),
        priority=payload.priority,
        status=payload.status,
        notes=payload.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {'id': item.id, 'name': item.name}


@router.get('/shopping-items')
def list_shopping_items(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wedding = db.query(Wedding).filter(Wedding.user_id == current_user.id).order_by(Wedding.created_at.desc()).first()
    if not wedding:
        return []
    items = db.query(ShoppingItem).filter(ShoppingItem.wedding_id == wedding.id).all()
    return [{
        'id': item.id,
        'name': item.name,
        'category': item.category,
        'quantity': item.quantity,
        'estimated_unit_price': float(item.estimated_unit_price or 0),
        'actual_unit_price': float(item.actual_unit_price or 0),
        'amount_paid': float(item.amount_paid or 0),
        'priority': item.priority,
        'status': item.status,
        'notes': item.notes,
    } for item in items]


@router.put('/shopping-items/{item_id}')
def update_shopping_item(item_id: str, payload: ShoppingItemCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wedding = db.query(Wedding).filter(Wedding.user_id == current_user.id).order_by(Wedding.created_at.desc()).first()
    if not wedding:
        raise HTTPException(status_code=404, detail='Wedding not found')
    item = db.query(ShoppingItem).filter(ShoppingItem.id == item_id, ShoppingItem.wedding_id == wedding.id).first()
    if not item:
        raise HTTPException(status_code=404, detail='Item not found')
    for key, value in payload.model_dump().items():
        if value is not None:
            setattr(item, key, value)
    db.commit()
    return {'message': 'Item updated'}


@router.delete('/shopping-items/{item_id}')
def delete_shopping_item(item_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wedding = db.query(Wedding).filter(Wedding.user_id == current_user.id).order_by(Wedding.created_at.desc()).first()
    if not wedding:
        raise HTTPException(status_code=404, detail='Wedding not found')
    item = db.query(ShoppingItem).filter(ShoppingItem.id == item_id, ShoppingItem.wedding_id == wedding.id).first()
    if not item:
        raise HTTPException(status_code=404, detail='Item not found')
    db.delete(item)
    db.commit()
    return {'message': 'Item deleted'}
