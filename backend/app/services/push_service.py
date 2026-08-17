import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models.news import NewsCard
from app.models.push import PushHistory, UserPushSettings
from app.models.user import User

logger = logging.getLogger(__name__)


class PushService:
    """推送服务：
    - 采集完成后负责筛选要推送的新闻
    - 组装邮件正文
    - 发送邮件（调用 settings.MAIL_*，如未配置则只记录 skipped，不报错不影响主流程）
    - 写入 push_histories 表，供前端"历史推送"页查询
    - 微信推送：因微信主动推送需要企业微信/公众号资质，先写入状态为 skipped+备注说明，等用户接入对应服务后再扩展
    """

    def __init__(self):
        pass

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    async def run_pipeline(
        self,
        trigger_type: str,  # auto_visit / cron_00_00 / manual
        new_cards_saved: int = 0,
        operator_user_id: Optional[str] = None,
    ) -> PushHistory:
        """一次完整推送流程：取最新的新闻（不管本次新增多少，只要是近 48h 内且尚未推送的高分卡片）→ 发送 → 记录历史"""
        async with async_session() as db:
            # 1) 取候选卡片
            candidates = await self._load_candidate_cards(db)
            if not candidates:
                history = PushHistory(
                    trigger_type=trigger_type,
                    push_channel="email",
                    status="skipped",
                    news_count=0,
                    recipient_count=0,
                    title="（无符合条件的新资讯）",
                    summary="本次采集没有新的高价值资讯，跳过推送。",
                    news_card_ids=[],
                    created_by=operator_user_id,
                    created_at=datetime.utcnow(),
                )
                db.add(history)
                await db.commit()
                await db.refresh(history)
                return history

            # 2) 查订阅用户（根据 trigger_type 匹配对应的 push_on_* 开关）
            settings_rows = (
                await db.execute(
                    select(UserPushSettings, User).join(User, UserPushSettings.user_id == User.id)
                )
            ).all()

            # 用户设置默认值：没有开启 UserPushSettings 的人，按"用户创建默认值"处理
            # 为了避免骚扰默认未订阅用户，只给"主动启用了任一推送方式的用户"发送推送。
            recipients_email: List[Dict] = []  # [{email, nickname, tags_filter, min_score}]
            recipients_wechat: List[Dict] = []

            for ups, user in settings_rows:
                want_this_trigger = False
                if trigger_type == "auto_visit" and ups.push_on_visit:
                    want_this_trigger = True
                if trigger_type == "cron_00_00" and ups.push_on_daily_cron:
                    want_this_trigger = True
                if trigger_type == "manual":
                    # 手动触发：只要订阅了任何方式就推
                    want_this_trigger = ups.email_enabled or ups.wechat_enabled

                if not want_this_trigger:
                    continue

                target_email = (ups.email_override or user.email or "").strip()
                if ups.email_enabled and target_email and "@" in target_email:
                    recipients_email.append({
                        "email": target_email,
                        "nickname": user.nickname or target_email.split("@")[0],
                        "tags_filter": ups.interest_tags_filter or [],
                        "min_score": ups.min_ai_value_score or 0,
                    })

                if ups.wechat_enabled and ups.wechat_userid:
                    recipients_wechat.append({
                        "userid": ups.wechat_userid,
                        "nickname": user.nickname or "订阅用户",
                        "tags_filter": ups.interest_tags_filter or [],
                        "min_score": ups.min_ai_value_score or 0,
                    })

            # 没有任何订阅者：也保存一次历史，用户能看到"今天没推送是因为没人订阅"
            if not recipients_email and not recipients_wechat:
                summary_parts = [f"本轮采集筛选出 {len(candidates)} 条高价值资讯，但当前没有用户开启对应方式的推送订阅（可在「我的 → 推送设置」中开启）。"]
                title = "本轮没有推送对象"
                history = PushHistory(
                    trigger_type=trigger_type,
                    push_channel="email",
                    status="skipped",
                    news_count=len(candidates),
                    recipient_count=0,
                    title=title,
                    summary="\n".join(summary_parts),
                    news_card_ids=[c.id for c in candidates],
                    created_by=operator_user_id,
                    created_at=datetime.utcnow(),
                )
                db.add(history)
                await db.commit()
                await db.refresh(history)
                return history

            # 3) 生成公共摘要
            title, summary = self._build_common_title_summary(candidates, trigger_type)

            history = PushHistory(
                trigger_type=trigger_type,
                push_channel="email+wechat" if (recipients_email and recipients_wechat) else ("email" if recipients_email else "wechat"),
                status="sending",
                news_count=len(candidates),
                recipient_count=len(recipients_email) + len(recipients_wechat),
                title=title,
                summary=summary,
                news_card_ids=[c.id for c in candidates],
                created_by=operator_user_id,
                created_at=datetime.utcnow(),
            )
            db.add(history)
            await db.commit()
            await db.refresh(history)

        # 4) 实际发送（不要占用事务）
        success_email = 0
        failed_email = 0
        error_parts: List[str] = []

        if recipients_email:
            try:
                ok, fails = self._send_emails_sync(recipients_email, candidates, title, summary)
                success_email += ok
                failed_email += fails
                if fails:
                    error_parts.append(f"{fails} 封邮件发送失败")
            except Exception as e:
                logger.exception(f"邮件批量发送异常: {e}")
                failed_email += len(recipients_email)
                error_parts.append(f"邮件异常: {str(e)[:200]}")

        success_wechat = 0
        failed_wechat = 0
        if recipients_wechat:
            # 微信推送：目前只记录 skipped 说明 + 预留实现位。企业微信/公众号接入后即可替换为真实发送。
            try:
                ok, fails = self._send_wechat_sync(recipients_wechat, candidates, title, summary)
                success_wechat += ok
                failed_wechat += fails
                if fails:
                    error_parts.append(f"{fails} 条微信未发送（需要接入企业微信/公众号才能主动推送）")
            except Exception as e:
                failed_wechat += len(recipients_wechat)
                error_parts.append(f"微信异常: {str(e)[:200]}")

        # 5) 回写状态
        total_ok = success_email + success_wechat
        total_fail = failed_email + failed_wechat
        async with async_session() as db:
            h = await db.get(PushHistory, history.id)
            if h:
                if total_ok == 0 and total_fail > 0:
                    h.status = "failed"
                elif total_fail == 0:
                    h.status = "success"
                else:
                    h.status = "partial"
                h.success_count = total_ok
                h.failed_count = total_fail
                h.error_message = "；".join(error_parts) if error_parts else None
                h.sent_at = datetime.utcnow()
                await db.commit()
                await db.refresh(h)
                history = h

        logger.info(
            f"推送完成: id={history.id[:8]} trigger={trigger_type} "
            f"news={history.news_count} ok={total_ok} fail={total_fail} status={history.status}"
        )
        return history

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    async def _load_candidate_cards(self, db) -> List[NewsCard]:
        """选要推送的新闻：近 48 小时内，按 ai_value_score 降序，最多 8 条。
        重点聚焦大模型：从候选池中挑选出"大模型相关"卡片，至少占 Top 8 的 60%（≥ 5 条）。
        大模型判定关键词与 collector 保持一致。
        """
        from datetime import timedelta
        from app.services.collector import LLM_KEYWORDS

        cutoff = datetime.utcnow() - timedelta(hours=48)
        # 多取一些（24 条）再从中重新组合，避免直接 ORDER BY 时大模型卡不够
        stmt = (
            select(NewsCard)
            .where(NewsCard.published_at >= cutoff)
            .order_by(NewsCard.ai_value_score.desc(), NewsCard.heat_score.desc())
            .limit(24)
        )
        result = await db.execute(stmt)
        pool = list(result.scalars().all())
        if not pool:
            return []

        def _is_llm_card(c: NewsCard) -> bool:
            text = (
                f"{c.title or ''} {c.summary or ''} "
                + " ".join(str(t) for t in (c.interest_tags or []))
            ).lower()
            return any(kw in text for kw in LLM_KEYWORDS)

        llm_pool = [c for c in pool if _is_llm_card(c)]
        non_llm_pool = [c for c in pool if not _is_llm_card(c)]

        # 构造结果：优先大模型卡
        target_total = min(8, len(pool))
        target_llm = max(5, int(target_total * 0.6))  # ≥5 或 ≥60%

        picked: List[NewsCard] = []
        picked_ids: set = set()

        def _take(src, max_n):
            for c in src:
                if len(picked) >= target_total:
                    return
                if len(picked) - max_n >= 0 and (len(picked) - (sum(1 for x in picked if _is_llm_card(x)))) == 0:
                    pass
                if id(c) in picked_ids:
                    continue
                picked_ids.add(id(c))
                picked.append(c)
                if len(picked) >= target_total:
                    return

        # 先按要求放 ≥target_llm 张大模型卡
        for c in llm_pool:
            if len([x for x in picked if _is_llm_card(x)]) >= target_llm:
                break
            if len(picked) >= target_total:
                break
            picked_ids.add(id(c))
            picked.append(c)

        # 然后按 ai_value_score 把剩余的补满（不管是否大模型，保持高价值在前面）
        combined_rest = sorted(pool, key=lambda c: (c.ai_value_score or 0), reverse=True)
        for c in combined_rest:
            if len(picked) >= target_total:
                break
            if id(c) in picked_ids:
                continue
            picked_ids.add(id(c))
            picked.append(c)

        # 最终按 ai_value_score 排序渲染（高价值在前）
        picked.sort(key=lambda c: (c.ai_value_score or 0), reverse=True)
        return picked

    def _build_common_title_summary(self, cards: List[NewsCard], trigger_type: str) -> (str, str):
        trigger_labels = {
            "auto_visit": "用户访问自动触发",
            "cron_00_00": "每日 00:00 定时推送",
            "manual": "手动触发推送",
        }
        label = trigger_labels.get(trigger_type, trigger_type)
        title = f"[NEXUS AI] {label} · {len(cards)} 条 AI 高价值资讯（{datetime.now().strftime('%Y-%m-%d')}）"

        lines = [
            f"{label}，本轮共筛选 {len(cards)} 条高价值 AI 资讯。",
            "",
            "---- 精选摘要 ----",
            "",
        ]
        for i, c in enumerate(cards, 1):
            lines.append(f"{i}. {c.title}")
            lines.append(f"   来源：{c.source}　价值分：{round(c.ai_value_score)}　热度：{round(c.heat_score)}")
            if c.summary:
                lines.append(f"   摘要：{c.summary}")
            tags = c.interest_tags or []
            if tags:
                lines.append(f"   标签：{' / '.join(tags)}")
            lines.append("")

        lines.append("登录 NEXUS AI 查看完整原文、开启推送设置、浏览历史推送：")
        lines.append("https://ai-news-frontend-kappa.vercel.app/news")
        return title, "\n".join(lines)

    def _send_emails_sync(self, recipients: List[Dict], cards: List[NewsCard], title: str, body: str):
        """同步发送邮件。如果 settings.MAIL_* 未配置，返回全部 skipped（失败为 0，但会记录到 error_message）。"""
        cfg = settings
        ok = 0
        fails = 0
        if not cfg.MAIL_SERVER or not cfg.MAIL_USERNAME:
            return 0, len(recipients)  # 全部未发送，不抛异常，让上层写入 skipped

        import smtplib
        from email.mime.text import MIMEText
        from email.header import Header

        sender = cfg.MAIL_FROM or cfg.MAIL_USERNAME
        for r in recipients:
            try:
                # 个性化抬头
                personalized = f"Hi，{r['nickname']}：\n\n{body}"
                msg = MIMEText(personalized, "plain", "utf-8")
                msg["Subject"] = Header(title, "utf-8")
                msg["From"] = sender
                msg["To"] = r["email"]

                with smtplib.SMTP(cfg.MAIL_SERVER, cfg.MAIL_PORT, timeout=30) as s:
                    s.ehlo()
                    if cfg.MAIL_USE_TLS:
                        s.starttls()
                        s.ehlo()
                    s.login(cfg.MAIL_USERNAME, cfg.MAIL_PASSWORD)
                    s.sendmail(sender, [r["email"]], msg.as_string())
                ok += 1
            except Exception as e:
                logger.warning(f"邮件发送失败 {r['email']}: {str(e)[:100]}")
                fails += 1
        return ok, fails

    def _send_wechat_sync(self, recipients: List[Dict], cards: List[NewsCard], title: str, body: str):
        """
        微信"主动推送"的真实实现有严格限制：
        1) 个人微信 → 不开放任何官方 API 主动发消息（第三方协议都是违反微信 ToS 的外挂，封号风险高，不集成）。
        2) 公众号（订阅号/服务号）→ 订阅号仅在用户进入会话后 48h 内可回复消息，不能 00:00 主动定时发；服务号必须用户扫码/关注+点击订阅模板消息授权才能发"模板消息"，否则无法主动推送。
        3) 企业微信 → 可通过"应用消息"对成员主动推送，是官方合规路径；但你需要拥有企业微信的企业主体/自建应用/CorpID+Secret+用户 userid，拿到后替换本方法内部实现即可（预留企业微信发送接入点，见 TODO）。

        当前版本：**所有"微信推送"都写为 skipped（不算失败），并在 PushHistory.error_message 里提示用户"请接入企业微信或公众号模板消息"**。
        """
        # TODO: 若你已拥有企业微信自建应用（CorpID / CorpSecret / AgentID / 用户 userid），替换这里为真实调用：
        #   https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=ID&corpsecret=SECRET
        #   https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=TOKEN  → msgtype=text/textcard
        # 目前返回 (0, 0) 表示既不成功也不失败（skipped），由调用方统一附加 wechat 说明到 error_message。
        skipped_note = (
            "微信推送当前未接入企业微信/公众号，无法主动发送。如需启用，请到"
            " 我的 → 推送设置 → 微信推送 查看说明并扫码绑定；或直接提供企业微信的"
            " CorpID/CorpSecret/AgentID/userid 后可在本方法内替换实现。"
        )
        logger.info(skipped_note)
        # 返回 (成功, 失败) = (0, 0)，外层会追加 skipped 说明。
        return 0, 0
