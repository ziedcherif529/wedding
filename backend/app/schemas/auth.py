from pydantic import BaseModel, EmailStr, field_validator


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str

    @field_validator('password')
    @classmethod
    def password_length(cls, value: str):
        if len(value) < 6:
            raise ValueError('Password must be at least 6 characters long')
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = 'bearer'


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str = 'USER'
    is_verified: bool = False

    model_config = {'from_attributes': True}
