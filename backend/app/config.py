from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AquaNexus"
    groq_api_key: Optional[str] = None
    groq_model: str = "groq/compound"
    groq_timeout_seconds: float = 40.0
    groq_base_url: Optional[str] = None
    cors_origins: List[str] = ["*"]

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), env_file_encoding="utf-8")


settings = Settings()
