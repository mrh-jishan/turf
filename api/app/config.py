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

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
