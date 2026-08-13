import logging
from typing import Dict, List, Optional

from app.services.llm_processor import LLMProcessor
from app.utils.helpers import sanitize_text

logger = logging.getLogger(__name__)


class CardGenerator:
    def __init__(self):
        self.llm_processor = LLMProcessor()

    async def generate_from_collected(
        self,
        title: str,
        content: str,
        source: str,
        source_url: str,
        source_id: Optional[str] = None,
        cover_image: Optional[str] = None,
        published_at: Optional[str] = None,
    ) -> Dict:
        clean_content = sanitize_text(content)

        summary = await self.llm_processor.summarize_content(
            f"{title}\n{clean_content}"
        )

        value_score = await self.llm_processor.evaluate_value(
            f"{title}\n{clean_content[:1000]}"
        )

        tags = await self.llm_processor.extract_tags(
            f"{title}\n{clean_content[:1000]}"
        )

        category = await self.llm_processor.categorize_content(
            f"{title}\n{clean_content[:1000]}"
        )

        heat_score = self._calculate_heat_score(value_score, tags, source)

        return {
            "title": title,
            "summary": summary,
            "category": category,
            "source": source,
            "source_url": source_url,
            "source_id": source_id,
            "heat_score": heat_score,
            "ai_value_score": value_score,
            "interest_tags": tags,
            "cover_image": cover_image,
            "published_at": published_at,
        }

    def _calculate_heat_score(
        self, value_score: float, tags: List[str], source: str
    ) -> float:
        base_score = value_score * 0.6

        tag_bonus = min(len(tags) * 5, 20)

        source_multiplier = {
            "arXiv": 1.2,
            "YouTube": 1.1,
            "Twitter": 1.0,
            "RSS": 0.9,
        }.get(source, 0.8)

        heat = (base_score + tag_bonus) * source_multiplier
        return round(min(heat, 100.0), 2)

    async def batch_generate(
        self, items: List[Dict]
    ) -> List[Dict]:
        cards = []
        for item in items:
            try:
                card = await self.generate_from_collected(
                    title=item.get("title", "未知标题"),
                    content=item.get("content", ""),
                    source=item.get("source", "未知"),
                    source_url=item.get("source_url", ""),
                    source_id=item.get("source_id"),
                    cover_image=item.get("cover_image"),
                    published_at=item.get("published_at"),
                )
                cards.append(card)
            except Exception as e:
                logger.error(f"生成卡片失败: {str(e)[:200]}")
        return cards

    async def generate_prediction_cards(
        self, news_cards: List[Dict]
    ) -> List[Dict]:
        return await self.llm_processor.generate_prediction_questions(news_cards)