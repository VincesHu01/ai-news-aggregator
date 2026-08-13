from typing import List, Dict, Optional
from pydantic_settings import BaseSettings
from pydantic import field_validator
import json
import os


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./ai_intel.db"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080

    MAIL_SERVER: str = "smtp.example.com"
    MAIL_PORT: int = 587
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_USE_TLS: bool = True
    MAIL_FROM: str = ""

    REDIS_URL: str = "redis://localhost:6379/0"

    COLLECTION_INTERVAL_HOURS: int = 24

    # LLM 配置：支持多模型 fallback
    # Groq 免费：https://console.groq.com
    # Google 免费：https://aistudio.google.com
    # OpenRouter 免费：https://openrouter.ai
    LLM_PROVIDERS: List[Dict] = [
        {
            "name": "Groq",
            "api_key": "",
            "base_url": "https://api.groq.com/openai/v1",
            "model": "llama-3.1-70b-versatile",
            "priority": 1,
        },
        {
            "name": "GoogleFree",
            "api_key": "",
            "base_url": "https://generativelanguage.googleapis.com/v1beta",
            "model": "gemini-2.0-flash",
            "priority": 2,
        },
        {
            "name": "OpenRouter",
            "api_key": "",
            "base_url": "https://openrouter.ai/api/v1",
            "model": "meta-llama/llama-3.1-70b-instruct",
            "priority": 3,
        },
    ]

    # CORS：部署时设置为 ["*"] 或具体域名列表
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8080"]

    LOG_LEVEL: str = "INFO"

    model_config = {"env_file": ".env", "case_sensitive": True}

    @field_validator("LLM_PROVIDERS", mode="before")
    @classmethod
    def parse_llm_providers(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v


settings = Settings()