import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid_str():
    return str(uuid.uuid4())


class PushHistory(Base):
    """推送历史记录：每次采集完成后生成一次推送批次，记录发送对象、内容、结果"""
    __tablename__ = "push_histories"

    id = Column(String(36), primary_key=True, default=_uuid_str)

    # 采集触发方式：auto_visit（用户打开网站）/ cron_00_00（定时）/ manual（管理员）
    trigger_type = Column(String(32), nullable=False, default="auto_visit", index=True)

    # 推送方式：email / wechat / app_push
    push_channel = Column(String(32), nullable=False, default="email", index=True)

    # 发送状态：pending / sending / success / partial / failed / skipped
    status = Column(String(32), nullable=False, default="pending", index=True)

    # 本批次覆盖的新闻数量
    news_count = Column(Integer, default=0, nullable=False)

    # 发送目标数量（用户数或邮箱数）
    recipient_count = Column(Integer, default=0, nullable=False)

    # 成功/失败数量
    success_count = Column(Integer, default=0, nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)

    # 推送摘要（邮件正文预览 / 推送标题）
    title = Column(String(500), nullable=True)
    summary = Column(Text, nullable=True)

    # 包含的新闻 card_id 列表（JSON array），方便前端渲染历史页"查看推送内容"
    news_card_ids = Column(JSON, default=list, nullable=False)

    # 错误信息（发送失败时保存）
    error_message = Column(Text, nullable=True)

    # 创建人（手动触发时保存 user_id，系统触发则为 null）
    created_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    sent_at = Column(DateTime, nullable=True)

    creator = relationship("User", foreign_keys=[created_by])


class UserPushSettings(Base):
    """用户订阅推送的个性化设置"""
    __tablename__ = "user_push_settings"

    id = Column(String(36), primary_key=True, default=_uuid_str)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # ---- 推送方式开关 ----
    # 邮件推送（默认 False，用户主动开启并验证邮箱后生效）
    email_enabled = Column(Boolean, default=False, nullable=False)
    # 邮箱地址（默认取 users.email，但允许用户填写不同的订阅邮箱）
    email_override = Column(String(255), nullable=True)
    email_verified = Column(Boolean, default=False, nullable=False)

    # 微信推送（因微信限制，默认 False；开启后需要用户通过企业微信扫码绑定，否则无法主动推送）
    wechat_enabled = Column(Boolean, default=False, nullable=False)
    # 企业微信 userid / 公众号 openid（预留）
    wechat_userid = Column(String(255), nullable=True)

    # ---- 推送时机开关 ----
    # 只要有用户打开网站就触发时，是否给我也发（默认 False，避免过度骚扰）
    push_on_visit = Column(Boolean, default=False, nullable=False)
    # 是否启用每日 00:00 准点定时推送（默认 True）
    push_on_daily_cron = Column(Boolean, default=True, nullable=False)

    # 用户自定义只推哪些兴趣标签（空数组表示推全部）
    interest_tags_filter = Column(JSON, default=list, nullable=False)

    # 最少 AI 价值分（低于此分的资讯不推）
    min_ai_value_score = Column(Integer, default=0, nullable=False)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
