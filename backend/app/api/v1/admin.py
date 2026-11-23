from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix='/admin', tags=['admin'])


@router.get('/users')
def users(current_user: User = Depends(get_current_user)):
    return {'count': 1, 'user': current_user.email}


@router.get('/subscriptions')
def subscriptions(current_user: User = Depends(get_current_user)):
    return {'count': 1, 'plan': 'FREE'}


@router.get('/analytics')
def analytics(current_user: User = Depends(get_current_user)):
    return {'active_users': 1, 'revenue': 0}


@router.get('/revenue')
def revenue(current_user: User = Depends(get_current_user)):
    return {'total_revenue': 0}
