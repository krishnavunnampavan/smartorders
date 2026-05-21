from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", case_sensitive=False)

    database_url: str = "postgresql://postgres:postgres@localhost/liquorstore"
    redis_url: str = "redis://localhost:6379"
    secret_key: str = "change-me"
    encryption_key: str = ""
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000


@lru_cache
def get_settings() -> Settings:
    return Settings()
