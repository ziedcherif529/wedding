from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.database import Base, engine

settings = get_settings()
app = FastAPI(title=settings.APP_NAME, version='0.1.0', docs_url='/docs', redoc_url='/redoc')

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(',') if origin.strip()],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

Base.metadata.create_all(bind=engine)

app.include_router(api_router)


@app.get('/')
def root():
    return {'app': settings.APP_NAME, 'status': 'running'}
