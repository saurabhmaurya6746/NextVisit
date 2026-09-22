from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_DIR = BACKEND_DIR.parent

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    GEMINI_API_KEY: str = ""  # blank default, .env se aayega
    BREVO_API_KEY: str = ""
    BREVO_SENDER_EMAIL: str = "saurabhmauryajnp28@gmail.com"
    BREVO_SENDER_NAME: str = "Nextvisit"
    OTP_EXPIRE_MINUTES: int = 10
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "NextVisit <onboarding@resend.dev>"
    NEXTVISIT_ADMIN_EMAIL: str = "saurabhmauryajnp28@gmail.com"
    FRONTEND_URL: str = "http://localhost:5173"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    model_config = SettingsConfigDict(
        env_file=[
            str(BACKEND_DIR / ".env"),
            str(ROOT_DIR / ".env"),
            ".env",
        ],
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

