from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import MetaData, inspect, text
from app.config import settings
from typing import Any

def _create_engine():
    url = settings.DATABASE_URL
    if url.startswith("sqlite"):
        return create_async_engine(
            url,
            echo=False,
            connect_args={"check_same_thread": False},
        )
    else:
        # 确保使用 asyncpg 异步驱动
        if url.startswith("postgresql://") and "asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return create_async_engine(
            url,
            echo=False,
            pool_size=20,
            max_overflow=40,
            pool_pre_ping=True,
        )

engine = _create_engine()

async_session = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()

metadata = MetaData()


def get_uuid_type():
    from sqlalchemy import String
    return String(36)


async def get_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    # 确保所有模型在 create_all 之前已被加载
    import app.models  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_upgrade_existing_schema)


def _upgrade_existing_schema(connection: Any) -> None:
    """对早期 NEXUS 数据库执行最小、幂等的结构升级。

    create_all 只会创建缺失的表，不会给已有表添加新字段。本地
    DailyBrief 的去重导入依赖 source_id，因此在旧部署上自动补齐它。
    """
    inspector = inspect(connection)
    if "news_cards" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("news_cards")}
    if "source_id" not in columns:
        connection.execute(text("ALTER TABLE news_cards ADD COLUMN source_id VARCHAR(200)"))

    additions = {
        "key_facts": "JSON",
        "background": "TEXT",
        "why_it_matters": "TEXT",
        "career_lens": "TEXT",
        "glossary": "JSON",
        "analysis_sections": "JSON",
        "timeline": "JSON",
        "stakeholders": "JSON",
        "visual_direction": "JSON",
    }
    for name, sql_type in additions.items():
        if name not in columns:
            connection.execute(text(f"ALTER TABLE news_cards ADD COLUMN {name} {sql_type}"))
    connection.execute(text("UPDATE news_cards SET key_facts = '[]' WHERE key_facts IS NULL"))
    connection.execute(text("UPDATE news_cards SET glossary = '[]' WHERE glossary IS NULL"))
    connection.execute(text("UPDATE news_cards SET analysis_sections = '[]' WHERE analysis_sections IS NULL"))
    connection.execute(text("UPDATE news_cards SET timeline = '[]' WHERE timeline IS NULL"))
    connection.execute(text("UPDATE news_cards SET stakeholders = '[]' WHERE stakeholders IS NULL"))
    connection.execute(text("UPDATE news_cards SET visual_direction = '{}' WHERE visual_direction IS NULL"))

    indexes = {index["name"] for index in inspect(connection).get_indexes("news_cards")}
    if "ix_news_cards_source_id" not in indexes:
        connection.execute(text(
            "CREATE INDEX ix_news_cards_source_id ON news_cards (source_id)"
        ))
