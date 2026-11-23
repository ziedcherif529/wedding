from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = 'SmartLife'
    APP_ENV: str = 'development'
    DEBUG: bool = True
    DATABASE_URL: str = 'postgresql+pg8000://postgres:CHANGE_ME@localhost:5432/smartlife_db'
    JWT_SECRET_KEY: str = 'smartlife-dev-secret-key-change-me-for-production-32+'
    JWT_ALGORITHM: str = 'HS256'
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    FRONTEND_URL: str = 'http://localhost:4200'
    CORS_ORIGINS: str = 'http://localhost:4200'

    model_config = SettingsConfigDict(env_file='.env', extra='ignore')


@lru_cache
def get_settings() -> Settings:
    return Settings()
