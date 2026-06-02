from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database. Defaults to a local SQLite file for easy development.
    # In production set DATABASE_URL to a Postgres connection string.
    database_url: str = "sqlite:///./recovery.db"

    # Auth
    jwt_secret: str = "dev-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Seed credentials for the initial employee account.
    seed_username: str = "employee"
    seed_password: str = "changeme123"
    seed_admin_username: str = "admin"
    seed_admin_password: str = "changeme123"

    # CORS: comma-separated list of allowed origins.
    cors_origins: str = "*"

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
