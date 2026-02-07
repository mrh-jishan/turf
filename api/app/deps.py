from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from .database import get_session
from .models import User
from .security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login", auto_error=False)

async def get_token_from_request(request: Request, token: Optional[str] = Depends(oauth2_scheme)) -> Optional[str]:
    """Get token from Authorization header or cookies."""
    # First try the Authorization header
    if token:
        return token
    # Then try the access_token cookie
    cookie_token = request.cookies.get("access_token")
    return cookie_token

async def get_db() -> AsyncSession:
    async for session in get_session():
        yield session

async def get_current_user(token: Optional[str] = Depends(get_token_from_request), db: AsyncSession = Depends(get_db)) -> User:
    """Get current authenticated user. Raises exception if not authenticated."""
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")
    
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token")
    user = await db.get(User, payload["sub"])
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found")
    return user

async def get_current_user_optional(token: Optional[str] = Depends(get_token_from_request), db: AsyncSession = Depends(get_db)) -> Optional[User]:
    """Get current user if authenticated, otherwise return None."""
    if not token:
        return None
    
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        return None
    user = await db.get(User, payload["sub"])
    return user
