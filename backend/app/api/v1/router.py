from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.finance import router as finance_router
from app.api.v1.subscriptions import router as subscriptions_router
from app.api.v1.wedding import router as wedding_router
from app.api.v1.wedding_planner import router as wedding_planner_router
from app.api.v1.admin import router as admin_router

api_router = APIRouter(prefix='/api/v1')
api_router.include_router(auth_router)
api_router.include_router(wedding_router)
api_router.include_router(wedding_planner_router)
api_router.include_router(finance_router)
api_router.include_router(subscriptions_router)
api_router.include_router(admin_router)
