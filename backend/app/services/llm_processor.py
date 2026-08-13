import asyncio
import json
import logging
from typing import List, Dict, Optional, Any

import httpx
import requests as sync_requests

from app.config import settings

logger = logging.getLogger(__name__)


class LLMProcessor:
    def __init__(self):
        self.providers = sorted(settings.LLM_PROVIDERS, key=lambda p: p.get("priority", 99))
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(60.0))

    async def _call_provider(
        self,
        provider: Dict,
        messages: List[Dict],
        max_tokens: int = 500,
        temperature: float = 0.7,
        max_retries: int = 3,
    ) -> Optional[str]:
        base_url = provider.get("base_url", "")
        if not base_url.endswith("/chat/completions"):
            base_url = f"{base_url.rstrip('/')}/chat/completions"

        payload = {
            "model": provider.get("model", ""),
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "thinking": {"type": "disabled"},
        }

        headers = {
            "Authorization": f"Bearer {provider.get('api_key', '')}",
            "Content-Type": "application/json",
        }

        for attempt in range(max_retries):
            try:
                try:
                    response = await self._client.post(
                        base_url, json=payload, headers=headers
                    )
                    if response.status_code == 429:
                        wait = 2 ** attempt
                        logger.warning(f"Rate limited, waiting {wait}s (attempt {attempt+1}/{max_retries})")
                        await asyncio.sleep(wait)
                        continue
                    response.raise_for_status()
                    data = response.json()
                    return data["choices"][0]["message"]["content"].strip()
                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 429:
                        wait = 2 ** attempt
                        logger.warning(f"Rate limited (httpx), waiting {wait}s")
                        await asyncio.sleep(wait)
                        continue
                    # 回退到同步 requests
                    raise
                except Exception as httpx_error:
                    # 回退到同步 requests
                    try:
                        loop = asyncio.get_event_loop()
                        resp = await loop.run_in_executor(
                            None,
                            lambda: sync_requests.post(
                                base_url, json=payload, headers=headers, timeout=60, verify=False
                            )
                        )
                        if resp.status_code == 429:
                            wait = 2 ** attempt
                            logger.warning(f"Rate limited (requests), waiting {wait}s")
                            await asyncio.sleep(wait)
                            continue
                        resp.raise_for_status()
                        data = resp.json()
                        return data["choices"][0]["message"]["content"].strip()
                    except Exception:
                        if attempt < max_retries - 1:
                            await asyncio.sleep(1)
                            continue
                        logger.warning(f"Provider {provider.get('name')} failed after {max_retries} retries")
                        return None
            except Exception as e:
                if attempt < max_retries - 1:
                    await asyncio.sleep(1)
                    continue
                logger.warning(f"Provider {provider.get('name')} error: {str(e)[:200]}")
                return None

        return None

    async def _try_providers(
        self,
        messages: List[Dict],
        max_tokens: int = 500,
        temperature: float = 0.7,
    ) -> Optional[str]:
        for provider in self.providers:
            if not provider.get("api_key"):
                continue
            result = await self._call_provider(provider, messages, max_tokens, temperature)
            if result:
                return result
        return None

    async def summarize_content(self, content: str) -> str:
        if len(content) < 10:
            return content

        truncated = content[:3000] if len(content) > 3000 else content

        messages = [
            {
                "role": "system",
                "content": "你是一个专业的AI新闻摘要助手。请将以下内容总结为30-50个中文字符的摘要，要求准确、简洁、信息量高。",
            },
            {"role": "user", "content": truncated},
        ]

        result = await self._try_providers(messages, max_tokens=100, temperature=0.5)
        if result:
            clean = result.replace("\n", " ").strip()
            if len(clean) > 100:
                clean = clean[:100]
            return clean
        return truncated[:100]

    async def evaluate_value(self, content: str) -> float:
        if not content:
            return 0.0

        truncated = content[:2000] if len(content) > 2000 else content

        messages = [
            {
                "role": "system",
                "content": """你是一个AI新闻价值评估专家。请评估以下内容的价值分数（0-100）。
评分标准：
- 90-100: 重大突破、开创性研究、行业颠覆性事件
- 70-89: 重要进展、高质量研究、显著影响
- 50-69: 一般新闻、有一定参考价值
- 30-49: 普通资讯、信息有限
- 0-29: 低价值、无关紧要

请仅输出一个数字，不要输出其他内容。""",
            },
            {"role": "user", "content": truncated},
        ]

        result = await self._try_providers(messages, max_tokens=10, temperature=0.1)
        if result:
            try:
                score = float(result.strip())
                return max(0.0, min(100.0, score))
            except ValueError:
                pass
        return 50.0

    async def extract_tags(self, content: str) -> List[str]:
        if not content:
            return []

        truncated = content[:2000] if len(content) > 2000 else content

        messages = [
            {
                "role": "system",
                "content": """你是一个AI内容标签提取专家。请从以下内容中提取3-5个最相关的主题标签。
标签要求：
- 简短（2-4个字或英文单词）
- 具体（不是泛泛的词）
- 相关（准确反映内容核心主题）

请以JSON数组格式输出，例如 ["机器学习", "深度学习", "NLP"]。仅输出JSON，不要其他内容。""",
            },
            {"role": "user", "content": truncated},
        ]

        result = await self._try_providers(messages, max_tokens=100, temperature=0.3)
        if result:
            try:
                tags = json.loads(result.strip())
                if isinstance(tags, list):
                    return [str(t) for t in tags[:5]]
            except json.JSONDecodeError:
                tags = result.replace("[", "").replace("]", "").replace('"', '').replace("'", "")
                return [t.strip() for t in tags.split(",") if t.strip()][:5]
        return []

    async def categorize_content(self, content: str) -> str:
        if not content:
            return "其他"

        truncated = content[:1500] if len(content) > 1500 else content

        messages = [
            {
                "role": "system",
                "content": """你是一个AI新闻分类专家。请将以下内容归类到最合适的类别中。
可选类别：AI研究、AI应用、AI产业、AI政策、AI工具、AI人物、其他。

请仅输出类别名称，不要输出其他内容。""",
            },
            {"role": "user", "content": truncated},
        ]

        result = await self._try_providers(messages, max_tokens=20, temperature=0.1)
        if result:
            valid_categories = ["AI研究", "AI应用", "AI产业", "AI政策", "AI工具", "AI人物", "其他"]
            result_clean = result.strip()
            for cat in valid_categories:
                if cat in result_clean:
                    return cat
            return result_clean[:20]
        return "其他"

    async def generate_prediction_questions(self, cards: List[Dict]) -> List[Dict]:
        if not cards:
            return []

        combined = "\n\n".join(
            f"标题: {c.get('title', '')}\n摘要: {c.get('summary', '')}"
            for c in cards[:5]
        )

        messages = [
            {
                "role": "system",
                "content": """你是一个AI新闻预测专家。基于以下新闻内容，生成1-3个预测问题。
预测问题类型：yes_no（是/否）或 multiple_choice（多选）。

JSON格式输出：
[
  {
    "question": "预测问题",
    "type": "yes_no",
    "options": ["是", "否"],
    "category": "类别",
    "settlement_logic": "结算逻辑描述"
  }
]

仅输出JSON数组。""",
            },
            {"role": "user", "content": combined},
        ]

        result = await self._try_providers(messages, max_tokens=500, temperature=0.8)
        if result:
            try:
                questions = json.loads(result.strip())
                if isinstance(questions, list):
                    return questions
            except json.JSONDecodeError:
                pass
        return []

    async def settle_prediction(self, prediction: Dict, news_cards: List[Dict]) -> Optional[str]:
        if not news_cards:
            return None

        combined = "\n".join(
            f"{c.get('title', '')}: {c.get('summary', '')[:100]}"
            for c in news_cards[:10]
        )

        messages = [
            {
                "role": "system",
                "content": f"""你是一个AI预测结算专家。根据以下新闻内容，判断预测问题的结果。

预测问题：{prediction.get('question', '')}
预测类型：{prediction.get('type', 'yes_no')}
选项：{prediction.get('options', [])}
结算逻辑：{prediction.get('settlement_logic', '')}

请根据新闻内容判断正确答案。仅输出选项中的一个值。""",
            },
            {"role": "user", "content": combined},
        ]

        result = await self._try_providers(messages, max_tokens=50, temperature=0.1)
        if result:
            options = prediction.get("options", [])
            result_clean = result.strip()
            for opt in options:
                if str(opt) in result_clean:
                    return str(opt)
            return result_clean[:50]
        return None

    async def close(self):
        await self._client.aclose()