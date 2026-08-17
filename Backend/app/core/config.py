from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    GEMINI_API_KEY: str = ""  # blank default, .env se aayega
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "NextVisit <onboarding@resend.dev>"
    NEXTVISIT_ADMIN_EMAIL: str = "saurabhmauryajnp28@gmail.com"
    FRONTEND_URL: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

