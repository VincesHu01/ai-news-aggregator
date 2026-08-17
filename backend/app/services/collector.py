import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from urllib.parse import urlencode

import feedparser
import httpx
import requests
from bs4 import BeautifulSoup
from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models.news import NewsCard
from app.services.card_generator import CardGenerator
from app.services.prediction_engine import PredictionEngine
from app.services.push_service import PushService

logger = logging.getLogger(__name__)

# 任何两次采集之间的最小间隔（无论是 cron 还是按需访问触发）
# 防止：多个用户同时打开首页 → 10 秒内连抓 10 次 → 大量重复 LLM 调用花真钱。
MIN_COLLECTION_INTERVAL_MINUTES = 20


RSS_FEEDS = [
    {
        "name": "MIT Technology Review - AI",
        "url": "https://www.technologyreview.com/feed/",
        "category": "AI研究",
    },
    {
        "name": "TechCrunch - AI",
        "url": "https://techcrunch.com/category/artificial-intelligence/feed/",
        "category": "AI产业",
    },
    {
        "name": "The Verge - AI",
        "url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
        "category": "AI应用",
    },
    {
        "name": "ArsTechnica - AI",
        "url": "https://feeds.arstechnica.com/arstechnica/technology-lab",
        "category": "AI研究",
    },
    {
        "name": "VentureBeat - AI",
        "url": "https://venturebeat.com/category/ai/feed/",
        "category": "AI产业",
    },
    {
        "name": "Wired - AI",
        "url": "https://www.wired.com/feed/category/ai/latest/rss",
        "category": "AI应用",
    },
    {
        "name": "Google News - AI",
        "url": "https://news.google.com/rss/search?q=artificial+intelligence&hl=en-US&gl=US&ceid=US:en",
        "category": "AI产业",
    },
]

YOUTUBE_FEEDS = [
    {
        "name": "Yannic Kilcher",
        "rss_url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCZHmQkKXys2R6s-l8sg4HQQ",
    },
    {
        "name": "Two Minute Papers",
        "rss_url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCbfYPyITQ-7l4upoX8nvctg",
    },
    {
        "name": "The AI Advantage",
        "rss_url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCjq4FXZREO023sCQYrt9tLg",
    },
]

ARXIV_CATEGORIES = ["cs.AI", "cs.LG", "cs.CL", "cs.CV", "cs.NE"]


class DataCollector:
    def __init__(self):
        self.card_generator = CardGenerator()
        self.prediction_engine = PredictionEngine()
        self.push_service = PushService()
        self._scheduler_task = None
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0),
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; AINewsBot/1.0)"},
        )
        self._sync_headers = {"User-Agent": "Mozilla/5.0 (compatible; AINewsBot/1.0)"}

        # 防止重入：采集进行中就拒绝再跑，避免用户点两下触发两次花两次钱
        self._collection_running = False
        # 最近一次采集完成时间（UTC），用于访问触发+MIN_COLLECTION_INTERVAL_MINUTES 去抖
        self._last_collection_finished_at: Optional[datetime] = None
        # 最近一次推送的 trigger 类型
        self._last_trigger: Optional[str] = None

    async def _fetch_url(self, url: str) -> Optional[str]:
        """获取URL内容，优先httpx，失败时回退到requests（解决SSL兼容性问题）"""
        try:
            resp = await self._client.get(url)
            resp.raise_for_status()
            return resp.text
        except Exception:
            try:
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(
                    None,
                    lambda: requests.get(url, headers=self._sync_headers, timeout=30, verify=False).text
                )
            except Exception as e:
                logger.warning(f"获取URL失败 [{url[:50]}]: {str(e)[:100]}")
                return None

    async def start_scheduler(self, interval_hours: int = 24):
        """启动调度器。优先级：
        - 如果 settings.DAILY_COLLECTION_CRON_AT_0000 = True（或没配置但 interval_hours == 24），用 00:00 准点 cron；
        - 否则回退到 interval_hours 的间隔调度。
        """
        if self._scheduler_task:
            return

        use_cron_0000 = interval_hours == 24
        self._scheduler_task = asyncio.create_task(
            self._run_scheduler_cron_0000() if use_cron_0000 else self._run_scheduler_interval(interval_hours)
        )
        mode = "00:00 准点 cron" if use_cron_0000 else f"间隔 {interval_hours}h"
        logger.info(f"数据采集调度器已启动，模式：{mode}")

    async def stop_scheduler(self):
        if self._scheduler_task:
            self._scheduler_task.cancel()
            try:
                await self._scheduler_task
            except asyncio.CancelledError:
                pass
            self._scheduler_task = None
            logger.info("数据采集调度器已停止")

        await self._client.aclose()

    # ------------------------------------------------------------------
    # 两种调度模式
    # ------------------------------------------------------------------
    async def _run_scheduler_interval(self, interval_hours: int):
        while True:
            try:
                logger.info("开始定时数据采集（interval 模式）...")
                await self.trigger_collection(trigger_type="cron_interval", force=False)
            except Exception as e:
                logger.error(f"定时数据采集(interval)出错: {str(e)[:200]}")
            await asyncio.sleep(interval_hours * 3600)

    async def _run_scheduler_cron_0000(self):
        """每天 本地时区 00:00:05 准点触发一次采集 + 推送。
        实现方式：循环睡眠到"下一个 00:00"。注意 Render 免费实例休眠期间 sleep 不会推进，
        休眠时就不触发（用户打开网站后会被访问触发机制兜底）。
        """
        while True:
            try:
                seconds = self._seconds_until_next_local_midnight()
                logger.info(f"[cron 00:00] 距离下次采集还有 {seconds/3600:.2f} 小时，等待中...")
                await asyncio.sleep(seconds)

                logger.info("[cron 00:00] 开始每日 00:00 准点数据采集...")
                await self.trigger_collection(trigger_type="cron_00_00", force=False)
            except Exception as e:
                logger.error(f"[cron 00:00] 调度出错: {str(e)[:200]}")
            # 防止 sleep(0) 或异常导致瞬间空转
            await asyncio.sleep(5)

    @staticmethod
    def _seconds_until_next_local_midnight() -> float:
        """返回从"现在"到"本地时区下一天 00:00:05"的秒数。05 秒是为了避开 00:00:00 跳日毛刺。"""
        now_local = datetime.now()  # 本地时间（中国部署/用户浏览器时区一致）
        tomorrow_local = now_local + timedelta(days=1)
        midnight_local = tomorrow_local.replace(hour=0, minute=0, second=5, microsecond=0)
        delta = midnight_local - now_local
        seconds = delta.total_seconds()
        # 理论上不会 < 0，但兜底
        return max(60.0, seconds)

    # ------------------------------------------------------------------
    # 对外入口：采集 + 推送
    # ------------------------------------------------------------------
    async def trigger_collection(self, trigger_type: str = "auto_visit", force: bool = False):
        """用户打开网站 / cron / 管理员 触发采集的统一入口。
        返回 dict: { ok: bool, reason: str, trigger: str, saved_cards: int, push_history_id: str|None }
        """
        if not force:
            if self._collection_running:
                return {
                    "ok": False,
                    "reason": "正在采集中，请稍后",
                    "trigger": trigger_type,
                    "saved_cards": 0,
                    "push_history_id": None,
                }
            if self._last_collection_finished_at is not None:
                elapsed = (datetime.utcnow() - self._last_collection_finished_at).total_seconds()
                if elapsed < MIN_COLLECTION_INTERVAL_MINUTES * 60:
                    return {
                        "ok": False,
                        "reason": f"距离上次采集仅 {int(elapsed/60)} 分钟，小于 {MIN_COLLECTION_INTERVAL_MINUTES} 分钟保护间隔，跳过。",
                        "trigger": trigger_type,
                        "saved_cards": 0,
                        "push_history_id": None,
                    }

        self._collection_running = True
        self._last_trigger = trigger_type
        try:
            saved_cards = await self.run_collection(trigger_type=trigger_type)
            push_history = None
            try:
                push_history = await self.push_service.run_pipeline(
                    trigger_type=trigger_type,
                    new_cards_saved=saved_cards,
                )
            except Exception as e:
                logger.error(f"推送失败（不影响采集结果）: {str(e)[:300]}")

            return {
                "ok": True,
                "reason": "ok",
                "trigger": trigger_type,
                "saved_cards": saved_cards,
                "push_history_id": push_history.id if push_history else None,
                "push_status": push_history.status if push_history else "unknown",
            }
        finally:
            self._collection_running = False
            self._last_collection_finished_at = datetime.utcnow()

    async def run_collection(self, trigger_type: str = "manual"):
        logger.info(f"=== 开始数据采集 trigger={trigger_type} ===")
        
        rss_items = await self._fetch_rss_feeds()
        logger.info(f"RSS 采集完成: {len(rss_items)} 条")
        
        youtube_items = await self._fetch_youtube_feeds()
        logger.info(f"YouTube 采集完成: {len(youtube_items)} 条")
        
        arxiv_items = await self._fetch_arxiv_papers()
        logger.info(f"arXiv 采集完成: {len(arxiv_items)} 条")

        all_items = rss_items + youtube_items + arxiv_items
        logger.info(f"总共采集到 {len(all_items)} 条原始内容")

        if not all_items:
            logger.warning("未采集到任何内容，跳过。")
            return 0

        logger.info("开始 LLM 处理...")
        cards = await self.card_generator.batch_generate(all_items)
        logger.info(f"LLM 处理完成: {len(cards)} 张卡片")

        saved_count = await self._save_cards(cards)
        logger.info(f"已保存 {saved_count} 张新卡片到数据库（本次采集总量 {len(cards)}）")

        async with async_session() as db:
            try:
                await self.prediction_engine.generate_predictions_from_cards(db)
                logger.info("预测生成完成")
            except Exception as e:
                logger.error(f"生成预测失败: {str(e)[:200]}")
        
        logger.info(f"=== 数据采集完成 trigger={trigger_type} ===")
        return saved_count

    async def _fetch_rss_feeds(self) -> List[Dict]:
        items = []
        for feed_config in RSS_FEEDS:
            try:
                # 获取 RSS 内容（自动回退到 requests）
                text = await self._fetch_url(feed_config["url"])
                if not text:
                    logger.warning(f"RSS获取失败: {feed_config['name']}")
                    continue
                feed = feedparser.parse(text)

                if feed.bozo and not feed.entries:
                    logger.warning(f"RSS解析失败: {feed_config['name']}")
                    continue

                for entry in feed.entries[:10]:
                    title = entry.get("title", "").strip()
                    if not title:
                        continue

                    content = ""
                    if hasattr(entry, "content") and entry.content:
                        content = entry.content[0].get("value", "")
                    elif hasattr(entry, "summary"):
                        content = entry.summary or ""

                    soup = BeautifulSoup(content, "lxml")
                    clean_text = soup.get_text(separator=" ", strip=True)

                    if len(clean_text) < 20:
                        continue

                    published_at = None
                    if hasattr(entry, "published_parsed") and entry.published_parsed:
                        try:
                            published_at = datetime(*entry.published_parsed[:6])
                        except (TypeError, ValueError):
                            pass

                    items.append(
                        {
                            "title": title,
                            "content": clean_text[:3000],
                            "source": "RSS",
                            "source_url": entry.get("link", ""),
                            "source_id": f"rss_{feed_config['name']}_{entry.get('id', title)}",
                            "cover_image": self._extract_image(content),
                            "published_at": published_at.isoformat() if published_at else None,
                            "_category_hint": feed_config.get("category"),
                        }
                    )

                logger.info(f"RSS [{feed_config['name']}]: 获取 {len([e for e in feed.entries[:10]])} 条")
            except Exception as e:
                logger.error(f"RSS采集失败 [{feed_config['name']}]: {str(e)[:200]}")

        return items

    async def _fetch_youtube_feeds(self) -> List[Dict]:
        items = []
        for channel in YOUTUBE_FEEDS:
            try:
                # 获取 YouTube RSS 内容（自动回退到 requests）
                text = await self._fetch_url(channel["rss_url"])
                if not text:
                    logger.warning(f"YouTube RSS获取失败: {channel['name']}")
                    continue
                feed = feedparser.parse(text)

                if feed.bozo and not feed.entries:
                    logger.warning(f"YouTube RSS解析失败: {channel['name']}")
                    continue

                for entry in feed.entries[:5]:
                    title = entry.get("title", "").strip()
                    if not title:
                        continue

                    published_at = None
                    if hasattr(entry, "published_parsed") and entry.published_parsed:
                        try:
                            published_at = datetime(*entry.published_parsed[:6])
                        except (TypeError, ValueError):
                            pass

                    link = entry.get("link", "")
                    video_id = ""
                    if "youtube.com/watch?v=" in link:
                        video_id = link.split("v=")[1][:11]

                    items.append(
                        {
                            "title": f"[YouTube] {title}",
                            "content": f"YouTube视频: {title}",
                            "source": "YouTube",
                            "source_url": link,
                            "source_id": f"yt_{video_id or entry.get('id', '')}",
                            "cover_image": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg" if video_id else None,
                            "published_at": published_at.isoformat() if published_at else None,
                        }
                    )

                logger.info(f"YouTube [{channel['name']}]: 获取 {len(feed.entries[:5])} 条")
            except Exception as e:
                logger.error(f"YouTube采集失败 [{channel['name']}]: {str(e)[:200]}")

        return items

    async def _fetch_arxiv_papers(self) -> List[Dict]:
        items = []
        try:
            query_parts = " OR ".join(f"cat:{cat}" for cat in ARXIV_CATEGORIES)
            search_query = f"all:artificial intelligence AND ({query_parts})"

            url = "https://export.arxiv.org/api/query"
            params = {
                "search_query": search_query,
                "start": 0,
                "max_results": 15,
                "sortBy": "submittedDate",
                "sortOrder": "descending",
            }

            # 构建完整URL并通过 _fetch_url 获取
            query_string = urlencode(params)
            full_url = f"{url}?{query_string}"
            text = await self._fetch_url(full_url)
            if not text:
                logger.error("arXiv获取失败")
                return items

            feed = feedparser.parse(text)

            for entry in feed.entries:
                title = entry.get("title", "").strip().replace("\n", " ")
                if not title:
                    continue

                summary = entry.get("summary", "").strip().replace("\n", " ")
                if len(summary) < 50:
                    continue

                published_at = None
                if hasattr(entry, "published_parsed") and entry.published_parsed:
                    try:
                        published_at = datetime(*entry.published_parsed[:6])
                    except (TypeError, ValueError):
                        pass

                items.append(
                    {
                        "title": f"[arXiv] {title}",
                        "content": summary[:3000],
                        "source": "arXiv",
                        "source_url": entry.get("link", ""),
                        "source_id": f"arxiv_{entry.get('id', '').split('/')[-1]}",
                        "published_at": published_at.isoformat() if published_at else None,
                        "_category_hint": "AI研究",
                    }
                )

            logger.info(f"arXiv: 获取 {len(items)} 篇论文")
        except httpx.HTTPError as e:
            logger.error(f"arXiv请求失败: {str(e)[:200]}")
        except Exception as e:
            logger.error(f"arXiv采集失败: {str(e)[:200]}")

        return items

    def _extract_image(self, html_content: str) -> Optional[str]:
        if not html_content:
            return None
        try:
            soup = BeautifulSoup(html_content, "lxml")
            img = soup.find("img")
            if img and img.get("src"):
                return img["src"][:1000]
        except Exception:
            pass
        return None

    async def _save_cards(self, cards: List[Dict]):
        if not cards:
            return 0

        async with async_session() as db:
            saved = 0
            for card_data in cards:
                try:
                    source_id = card_data.get("source_id", "")
                    if source_id:
                        existing_query = (
                            select(NewsCard)
                            .where(NewsCard.source_id == source_id)
                        )
                        existing_result = await db.execute(existing_query)
                        if existing_result.scalar_one_or_none():
                            continue

                    published_at = card_data.get("published_at")
                    if published_at and isinstance(published_at, str):
                        try:
                            published_at = datetime.fromisoformat(published_at)
                        except ValueError:
                            published_at = None

                    card = NewsCard(
                        title=card_data.get("title", "未知标题"),
                        summary=card_data.get("summary"),
                        category=card_data.get("category", card_data.get("_category_hint", "其他")),
                        source=card_data.get("source", "未知"),
                        source_url=card_data.get("source_url", ""),
                        source_id=source_id,
                        heat_score=card_data.get("heat_score", 0.0),
                        ai_value_score=card_data.get("ai_value_score", 50.0),
                        interest_tags=card_data.get("interest_tags", []),
                        cover_image=card_data.get("cover_image"),
                        published_at=published_at,
                    )
                    db.add(card)
                    saved += 1
                except Exception as e:
                    logger.error(f"保存卡片失败: {str(e)[:200]}")

            await db.commit()
            logger.info(f"共保存 {saved} 张新卡片")
            return saved

    async def fetch_twitter_trends(self) -> List[Dict]:
        items = []
        try:
            nitter_instances = [
                "https://nitter.net",
                "https://nitter.privacydev.net",
                "https://nitter.poast.org",
            ]

            for instance in nitter_instances:
                try:
                    url = f"{instance}/search?f=tweets&q=artificial+intelligence"
                    response = await self._client.get(
                        url,
                        headers={"User-Agent": "Mozilla/5.0"},
                        follow_redirects=True,
                    )
                    if response.status_code != 200:
                        continue

                    soup = BeautifulSoup(response.text, "lxml")
                    tweets = soup.find_all("div", class_="tweet-content")

                    for tweet in tweets[:5]:
                        text = tweet.get_text(strip=True)
                        if len(text) < 20:
                            continue

                        items.append(
                            {
                                "title": f"[Twitter] {text[:80]}",
                                "content": text[:2000],
                                "source": "Twitter",
                                "source_url": "",
                                "source_id": f"twitter_{hash(text) % 100000}",
                            }
                        )

                    if items:
                        logger.info(f"Twitter [{instance}]: 获取 {len(items)} 条")
                        break
                except Exception:
                    continue
        except Exception as e:
            logger.error(f"Twitter采集失败: {str(e)[:200]}")

        return items