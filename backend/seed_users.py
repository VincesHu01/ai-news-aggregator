import asyncio
import sys
from datetime import datetime, timedelta
import secrets

sys.path.insert(0, ".")

from app.database import async_session, init_db
from app.models.user import User
from app.models.news import NewsCard
from app.services.rewards_engine import RewardsEngine


USER_TEMPLATES = [
    ("ai_seer@test.com", "AI先知", 15800, 8200, 28, 920),
    ("gpt_master@test.com", "GPT大师", 14200, 7800, 25, 860),
    ("chip_king@test.com", "算力王者", 13500, 7200, 24, 780),
    ("deep_learner@test.com", "深度学习", 12800, 6800, 22, 720),
    ("neural_net@test.com", "神经网络", 11900, 6200, 20, 650),
    ("rl_expert@test.com", "强化学习", 11200, 5900, 19, 610),
    ("nlp_wiz@test.com", "自然语言", 10500, 5500, 18, 560),
    ("cv_pro@test.com", "计算机视觉", 9800, 5200, 17, 520),
    ("agi_explorer@test.com", "AGI探索者", 9200, 4800, 16, 480),
    ("ai_artist@test.com", "AI艺术家", 8600, 4500, 15, 440),
    ("agent_builder@test.com", "Agent构建师", 7800, 4000, 14, 400),
    ("data_scientist@test.com", "数据科学家", 7200, 3700, 13, 370),
    ("robotics_fan@test.com", "机器人爱好者", 6500, 3300, 12, 330),
    ("prompt_engineer@test.com", "提示工程师", 5800, 2900, 11, 290),
    ("ml_newbie@test.com", "ML新手", 2580, 1200, 7, 180),
]


async def seed():
    await init_db()
    print("Seeding users for leaderboard...")

    from sqlalchemy import select

    async with async_session() as session:
        count_q = select(User)
        result = await session.execute(count_q)
        existing = len(list(result.scalars().all()))
        print(f"Current users: {existing}")

        if existing >= 10:
            print("Already have enough users, skipping seed")
            return

        from app.utils.security import get_password_hash

        for email, nickname, points, exp, level, intel in USER_TEMPLATES:
            q = select(User).where(User.email == email)
            r = await session.execute(q)
            if r.scalar_one_or_none():
                print(f"  Skip existing: {nickname}")
                continue

            hashed = get_password_hash("test1234")
            u = User(
                id=secrets.token_hex(16),
                email=email,
                password_hash=hashed,
                nickname=nickname,
                points=points,
                experience=exp,
                level=level,
                intelligence=intel,
                invite_code=secrets.token_hex(4).upper(),
                created_at=datetime.utcnow() - timedelta(days=30),
            )
            session.add(u)
            print(f"  + {nickname} Lv.{level} ({exp} XP)")

        await session.commit()
        print("Done!")


if __name__ == "__main__":
    asyncio.run(seed())
