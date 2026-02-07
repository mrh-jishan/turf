from datetime import datetime, timedelta
from typing import Optional
import json
import httpx
import bcrypt

from jose import JWTError, jwt

from .config import settings

SECRET_KEY = settings.jwt_secret  # override via env for production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # bcrypt has a 72-byte limit for passwords
    password_bytes = plain_password[:72].encode('utf-8')
    hash_bytes = hashed_password.encode('utf-8') if isinstance(hashed_password, str) else hashed_password
    return bcrypt.checkpw(password_bytes, hash_bytes)

def get_password_hash(password: str) -> str:
    # bcrypt has a 72-byte limit for passwords
    password_bytes = password[:72].encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

async def verify_google_token(id_token: str) -> Optional[dict]:
    """
    Verify Google ID token and return user info.
    Returns dict with id, email, name, picture if valid, None otherwise.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": id_token}
            )
            if response.status_code == 200:
                data = response.json()
                return {
                    "id": data.get("sub"),
                    "email": data.get("email"),
                    "name": data.get("name"),
                    "picture": data.get("picture"),
                }
    except Exception:
        pass
    return None
