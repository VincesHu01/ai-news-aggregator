from typing import List
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

    # 只连接本机 Ollama，不使用 Groq / Gemini / OpenRouter 等外部 LLM API。
    # 云端部署设置 LOCAL_INGEST_ONLY=true，仅接收本机已经生成好的卡片。
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434/v1"
    OLLAMA_MODEL: str = "dailybrief-qwen:8b"
    LOCAL_INGEST_ONLY: bool = True

    # 本机 DailyBrief → 云端 NEXUS 的私有导入通道。
    NEXUS_INGEST_TOKEN: str = ""

    # 飞书群自定义机器人 webhook。只保存在环境变量中，不写进代码库。
    FEISHU_WEBHOOK_URL: str = ""
    PUBLIC_APP_URL: str = "https://ai-news-frontend-kappa.vercel.app"
    PUBLIC_API_URL: str = "https://ai-news-db-egqx.onrender.com"

    # CORS：部署时设置为 ["*"] 或具体域名列表
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8080"]

    LOG_LEVEL: str = "INFO"

    model_config = {"env_file": ".env", "case_sensitive": True}

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v

    @field_validator("FEISHU_WEBHOOK_URL", "PUBLIC_APP_URL", "PUBLIC_API_URL", mode="before")
    @classmethod
    def strip_wrapping_quotes(cls, value):
        """兼容从 dotenv 或部署控制台复制过来的带引号 URL。"""
        if isinstance(value, str):
            return value.strip().strip('"').strip("'")
        return value


settings = Settings()
