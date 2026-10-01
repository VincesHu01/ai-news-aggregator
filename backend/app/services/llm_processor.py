import asyncio
import json
import logging
from typing import Dict, List, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class LLMProcessor:
    """OpenAI-compatible client dedicated to the user's local Ollama server."""

    def __init__(self):
        self.base_url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/chat/completions"
        self.model = settings.OLLAMA_MODEL
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(600.0))

    async def _call_local(
        self,
        messages: List[Dict],
        max_tokens: int = 600,
        temperature: float = 0.2,
        max_retries: int = 2,
    ) -> Optional[str]:
        if settings.LOCAL_INGEST_ONLY:
            logger.info("云端导入模式已启用，跳过本地 Ollama 调用")
            return None
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False,
        }
        for attempt in range(max_retries):
            try:
                response = await self._client.post(
                    self.base_url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"].strip()
            except Exception as error:
                logger.warning("本地 Ollama 调用失败 (%s/%s): %s", attempt + 1, max_retries, str(error)[:200])
                if attempt + 1 < max_retries:
                    await asyncio.sleep(1)
        return None

    @staticmethod
    def _json_object(text: str) -> Optional[Dict]:
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end <= start:
            return None
        try:
            value = json.loads(text[start:end + 1])
            return value if isinstance(value, dict) else None
        except json.JSONDecodeError:
            return None

    async def analyze_content(self, title: str, content: str, category_hint: str = "") -> Dict:
        """One local-model call replaces the old four external API calls."""
        fallback = {
            "summary": (content or title)[:100],
            "value_score": 50.0,
            "tags": [],
            "category": category_hint or "其他",
        }
        if len(f"{title}{content}".strip()) < 10:
            return fallback
        messages = [
            {
                "role": "system",
                "content": (
                    "你是严谨的中文新闻编辑。只依据输入内容输出合法JSON，不补充外部事实。"
                    "格式：{\"summary\":\"50-100字事实摘要\",\"value_score\":0到100数字,"
                    "\"tags\":[\"3-5个短标签\"],\"category\":\"AI研究/AI应用/AI产业/AI政策/AI工具/AI人物/金融商业/宏观国际/其他之一\"}。"
                    "摘要保留主体、动作、日期和数字；信息不足时明确写信息不足。"
                ),
            },
            {"role": "user", "content": f"标题：{title}\n分类提示：{category_hint}\n内容：{content[:3500]}"},
        ]
        result = await self._call_local(messages, max_tokens=500, temperature=0.2)
        parsed = self._json_object(result or "")
        if not parsed:
            return fallback
        categories = {"AI研究", "AI应用", "AI产业", "AI政策", "AI工具", "AI人物", "金融商业", "宏观国际", "其他"}
        summary = str(parsed.get("summary") or fallback["summary"]).replace("\n", " ").strip()[:180]
        try:
            score = max(0.0, min(100.0, float(parsed.get("value_score", 50))))
        except (TypeError, ValueError):
            score = 50.0
        tags = parsed.get("tags") if isinstance(parsed.get("tags"), list) else []
        category = str(parsed.get("category") or fallback["category"])
        return {
            "summary": summary,
            "value_score": score,
            "tags": [str(tag).strip() for tag in tags if str(tag).strip()][:5],
            "category": category if category in categories else fallback["category"],
        }

    async def summarize_content(self, content: str) -> str:
        return (await self.analyze_content("", content))["summary"]

    async def evaluate_value(self, content: str) -> float:
        return (await self.analyze_content("", content))["value_score"]

    async def extract_tags(self, content: str) -> List[str]:
        return (await self.analyze_content("", content))["tags"]

    async def categorize_content(self, content: str) -> str:
        return (await self.analyze_content("", content))["category"]

    async def generate_prediction_questions(self, cards: List[Dict]) -> List[Dict]:
        # 自动预测不再由模型凭摘要生成，避免不可验证的问题和结算风险。
        return []

    async def settle_prediction(self, prediction: Dict, news_cards: List[Dict]) -> Optional[str]:
        # 预测必须由管理员依据明确的官方结算来源处理。
        return None

    async def close(self):
        await self._client.aclose()
