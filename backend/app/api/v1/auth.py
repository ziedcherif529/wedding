from datetime import datetime, timedelta, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, create_refresh_token, get_current_user, hash_password, verify_password
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.models.workspace import Workspace
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse

router = APIRouter(prefix='/auth', tags=['auth'])


@router.post('/register', response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(status_code=400, detail='Email already registered')
    user = User(
        id=str(uuid.uuid4()),
        full_name=payload.full_name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role='USER',
        is_verified=True,
    )
    db.add(user)
    db.flush()
    workspace = Workspace(id=str(uuid.uuid4()), name=f'{payload.full_name} workspace', slug='personal', owner_id=user.id)
    db.add(workspace)
    db.commit()
    db.refresh(user)
    return user


@router.post('/login', response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail='Incorrect email or password')
    access_token = create_access_token(user.email)
    refresh_token = create_refresh_token(user.email)
    db.add(RefreshToken(id=str(uuid.uuid4()), user_id=user.id, token_hash=refresh_token, expires_at=datetime.now(timezone.utc) + timedelta(days=7)))
    db.commit()
    response.set_cookie(key='refresh_token', value=refresh_token, httponly=True, samesite='lax', secure=False)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post('/refresh', response_model=TokenResponse)
def refresh(payload: dict | None = None, db: Session = Depends(get_db)):
    raw = None
    if payload:
        raw = payload.get('refresh_token')
    if not raw:
        raise HTTPException(status_code=400, detail='Refresh token required')
    from app.core.security import decode_token

    payload_data = decode_token(raw)
    email = payload_data.get('sub')
    db_user = db.query(User).filter(User.email == email).first()
    if not db_user:
        raise HTTPException(status_code=401, detail='Invalid refresh token')
    access_token = create_access_token(email)
    return TokenResponse(access_token=access_token, refresh_token=raw)


@router.post('/logout')
def logout(response: Response):
    response.delete_cookie('refresh_token')
    return {'message': 'Logged out successfully'}


@router.get('/me', response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user
