from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    DATABASE_URL: str = "sqlite+aiosqlite:///./zoom_clone.db"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:3000"

    LIVEKIT_API_KEY: str = "devkey"
    LIVEKIT_API_SECRET: str = "devsecretdevsecretdevsecretdevsecretdevsecret"
    LIVEKIT_WS_URL: str = "ws://localhost:7880"

    GROQ_API_KEY: str = ""
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def database_url_resolved(self) -> str:
        url = self.DATABASE_URL
        if "your-neon-host" in url or "user:password" in url:
            return "sqlite+aiosqlite:///./zoom_clone.db"
        return url


@lru_cache()
def get_settings() -> Settings:
    return Settings()

