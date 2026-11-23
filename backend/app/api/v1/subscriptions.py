from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix='/subscriptions', tags=['subscriptions'])


@router.get('/plans')
def plans(current_user: User = Depends(get_current_user)):
    return [
        {'name': 'FREE', 'price': 0, 'currency': 'TND'},
        {'name': 'PREMIUM', 'price': 49, 'currency': 'TND'},
        {'name': 'FAMILY', 'price': 99, 'currency': 'TND'},
        {'name': 'BUSINESS', 'price': 199, 'currency': 'TND'},
    ]


@router.get('/current')
def current(current_user: User = Depends(get_current_user)):
    return {'plan_name': 'FREE', 'status': 'trial', 'user_id': current_user.id}


@router.post('/checkout')
def checkout(current_user: User = Depends(get_current_user)):
    return {'status': 'created', 'checkout_url': 'https://example.com/checkout'}


@router.post('/cancel')
def cancel(current_user: User = Depends(get_current_user)):
    return {'status': 'cancelled'}


@router.post('/webhook')
def webhook():
    return {'received': True}
