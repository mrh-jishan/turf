from typing import Optional
from pydantic import BaseSettings, Field

class Settings(BaseSettings):
    app_name: str = "Turf API"
    environment: str = Field("local", env="ENVIRONMENT")
    database_url: str = Field(
        "postgresql+asyncpg://turf:turf@db:5432/turf",
        env="DATABASE_URL",
    )
    allowed_origin: str = Field("*", env="ALLOWED_ORIGIN")
    jwt_secret: str = Field("changeme-secret", env="JWT_SECRET")
    
    # Google OAuth2 settings
    google_client_id: Optional[str] = Field(None, env="GOOGLE_CLIENT_ID")
    google_client_secret: Optional[str] = Field(None, env="GOOGLE_CLIENT_SECRET")
    google_redirect_uri: Optional[str] = Field(None, env="GOOGLE_REDIRECT_URI")
    frontend_url: str = Field("http://localhost:3000", env="FRONTEND_URL")

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
