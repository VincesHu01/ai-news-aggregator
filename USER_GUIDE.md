# NEXUS AI 新闻聚合平台 — 用户使用文档与开发者指南

> 本文档面向两类读者：**平台用户**（了解各功能怎么用、什么时候触发）和**开发者/运营者**（了解各功能的触发机制、需要投入哪些财力、如何配置）。

---

## 一、平台概览

NEXUS AI 是一个 AI 新闻聚合平台，核心功能包括：

| 功能模块 | 一句话描述 |
|---------|-----------|
| AI 资讯 | 每日自动从 RSS、YouTube、arXiv 采集 AI 领域新闻，经 LLM 生成中文摘要、价值评分、兴趣标签和分类 |
| 每日任务 | 阅读 5 篇资讯领积分、每日签到领积分，引导用户养成阅读习惯 |
| 卡牌收集 | 抽盲盒获得 AI 主题卡牌（人物/技术/公司/伦理/里程碑），低级卡可合成高级卡 |
| 预测市场 | 对 AI 趋势进行预测，赚取积分 |
| 社交系统 | 添加好友、赠送卡牌、分享内容到微信/QQ/微博 |
| 推送系统 | 每日 00:00 定时推送 / 用户访问触发推送，支持邮件和微信（企业微信） |
| 积分与等级 | 阅读赚积分、签到赚积分、抽卡花积分，经验值决定等级 |

---

## 二、功能详解

### 2.1 AI 资讯

**用户视角：**
- 打开网站首页 → 自动触发一轮采集（20 分钟内只触发一次，防止重复）
- 在「AI 资讯」页浏览新闻卡片，可按分类（热门/技术/商业/财经/学术）筛选
- 点击进入详情页，阅读超过 30 秒后自动获得积分和经验（每篇仅一次）
- 可以收藏文章（点书签图标）、分享文章（点分享图标）
- 在「浏览历史」页查看已读文章

**触发机制：**
- **采集触发**：① 用户打开首页自动触发；② 每日 00:00 准点触发（cron 式）；③ 管理员手动触发
- **20 分钟防刷**：无论哪种触发方式，两次采集之间至少间隔 20 分钟，避免多个用户同时打开导致重复采集和 LLM 费用激增
- **阅读奖励**：在新闻详情页停留 30 秒后，前端自动调用 `POST /api/news/{cardId}/read`，后端检查是否已读过：
  - 首次阅读：奖励 5 积分 + 3 经验（30 秒基准），阅读时长越长奖励越多（最高 3 倍）
  - 重复阅读：仅更新阅读时长，不再发放奖励
- **LLM 处理**：每条新闻经过 4 次 LLM 调用（摘要/价值评分/兴趣标签/分类），使用配置的 LLM provider

### 2.2 每日任务

**用户视角：**
- 在侧边栏底部看到「每日任务」面板，实时显示今日进度
- **任务 1 — 阅读 5 篇资讯**：每读一篇进度 +1，达到 5 篇后可点击「领取奖励」获得 30 积分 + 15 经验
- **任务 2 — 每日签到**：在个人中心签到，获得 20+ 积分（连续签到有加成）
- 每日 00:00 重置进度

**触发机制：**
- 进度实时查询：前端调用 `GET /api/rewards/daily-tasks`，后端统计当天 `ReadingRecord` 表的记录数
- 领取奖励：前端调用 `POST /api/rewards/claim-daily-task?task_id=read_5`
  - 后端校验：① 今日是否已领取（查 `PointTransaction` 表）② 今日阅读数是否 ≥ 5
  - 防重复领取：使用 `PointTransaction.description = "daily_read_task_{日期}"` 作为唯一标识
- 签到：调用 `POST /api/rewards/checkin`，后端检查今日是否已签到

### 2.3 卡牌收集

**用户视角：**
- 在「卡牌收集」页花费 50 积分抽盲盒，随机获得一张卡牌
- 卡牌有 4 个稀有度：N（普通 74%）→ R（稀有 20%）→ SR（史诗 5%）→ SSR（传说 1%）
- **卡牌内容随稀有度递增**：
  - **N**：卡牌名称 + 类型标签 + 简短描述
  - **R**：增加「背景故事」（lore）— 详细的 AI 主题介绍
  - **SR**：增加「趣味问答」（trivia）— 可点击显示答案
  - **SSR**：增加「特别篇」内容，代表 AI 发展里程碑
- **卡牌类型**：人物（Hinton、Altman、Hassabis…）、技术（Transformer、Diffusion、RLHF…）、公司（OpenAI、DeepMind、Anthropic…）、AI 伦理（对齐、偏见、Deepfake…）、里程碑事件（AlphaGo、ChatGPT 发布、GPT-4…）
- **合成机制**：选择 3 张同稀有度卡牌 → 合成 1 张更高稀有度卡牌（N→R→SR→SSR）
- **赠送好友**：在卡牌详情中点击「赠送好友」，选择好友后赠送

**触发机制：**
- 抽卡：`POST /api/rewards/draw-card`，扣除 50 积分，按概率生成稀有度，从卡牌池随机选择内容
- 合成：`POST /api/rewards/synthesize-cards?card_ids=ID1&ID2&ID3`，消耗 3 张同稀有度卡牌，生成 1 张更高稀有度卡牌
- 赠送：`POST /api/rewards/gift-card?card_id=X&to_user_id=Y`，将卡牌所有权转移给好友
- 分享：`POST /api/shares/generate?target_type=card&target_id=X`，生成分享链接

### 2.4 预测市场

**用户视角：**
- 在「预测市场」页看到 AI 相关预测题（如「GPT-5 是否在 2025 年发布？」）
- 使用积分下注，预测正确赢取积分

**触发机制：**
- 系统自动从新闻中生成预测题（采集后自动触发）
- 结算：管理员调用 `POST /api/admin/settle-predictions`，系统根据结果结算积分

### 2.5 社交系统

**用户视角：**
- 在「好友」页搜索用户（按邮箱或昵称），发送好友请求
- 收到请求后可以接受或拒绝
- 好友列表中可以删除好友
- 在新闻详情页点击分享 → 弹出分享对话框 → 复制链接发到微信/QQ/微博
- 在卡牌详情页点击「赠送好友」→ 选择好友 → 赠送

**触发机制：**
- 搜索用户：`GET /api/friends/search?q=关键词`
- 发送请求：`POST /api/friends/request?to_user_id=X`
- 接受请求：`POST /api/friends/{id}/accept`（自动创建双向好友关系）
- 分享内容：`POST /api/shares/generate` 生成分享链接，前端提供微信/QQ/微博分享按钮
- 赠送卡牌：`POST /api/rewards/gift-card`（需为好友关系）

### 2.6 推送系统

**用户视角：**
- 在「个人中心 → 推送设置」中选择：
  - 触发时机：① 每日 00:00 定时推送 ② 有人访问网站时也推送
  - 推送方式：邮件推送（需填邮箱 + 发测试邮件验证）、微信推送（需企业微信绑定）
  - 个性化：AI 价值分最低阈值、兴趣标签过滤
- 在「历史推送」页查看所有推送记录，包括触发方式、发送状态、覆盖的新闻内容

**触发机制：**
- **采集 → 推送**：每次采集完成后自动调用 `PushService.run_pipeline()`
- **推送候选筛选**：取近 48 小时内 AI 价值分最高的 8 条新闻
- **邮件发送**：使用 SMTP（需配置 `MAIL_SERVER` 等环境变量），未配置时状态标记为 `skipped`
- **微信推送**：当前为占位实现（返回 skipped），需要企业微信 CorpID/CorpSecret/AgentID 后替换实现
- **00:00 cron 调度**：调度器计算到下一个本地 00:00:05 的秒数，sleep 等待后触发
- **访问触发**：首页挂载时调用 `POST /api/public/trigger-collection`，20 分钟去抖

### 2.7 积分与等级

| 行为 | 获得积分 | 获得经验 | 限制 |
|------|---------|---------|------|
| 阅读资讯（30 秒基准） | 5 | 3 | 每篇仅一次 |
| 每日签到 | 20 + 连续加成 | 10 + 连续加成 | 每日一次 |
| 每日阅读 5 篇任务 | 30 | 15 | 每日一次 |
| 邀请好友 | 50 | 0 | 每个邀请码一次 |

| 消耗行为 | 花费积分 |
|---------|---------|
| 抽卡（盲盒） | 50 |

等级由经验值决定，从 Lv.1（0 经验）到 Lv.20（19000 经验）。

### 2.8 个人中心与设置

- **个人中心**：查看积分/等级/签到/卡牌数、签到、推送设置
- **收藏夹**：本地存储的书签文章（点新闻详情页的书签图标添加/移除）
- **浏览历史**：后端 `ReadingRecord` 表记录的已读文章
- **设置**：修改昵称、查看邀请码、退出登录
- **好友**：搜索/添加/管理好友
- **历史推送**：查看所有推送批次及详情

---

## 三、触发机制详解

### 3.1 数据采集触发链

```
用户打开首页 (或 00:00 cron)
    ↓
POST /api/public/trigger-collection (匿名)
    ↓
检查 20 分钟去抖 + 防重入锁
    ↓ (通过)
RSS 采集 + YouTube 采集 + arXiv 采集
    ↓
LLM 处理（摘要 + 评分 + 标签 + 分类）— 每条 4 次 API 调用
    ↓
保存新卡片到数据库（source_id 去重）
    ↓
自动触发 PushService 推送管线
    ↓
筛选高价值新闻 → 发送邮件/微信 → 写入推送历史
```

### 3.2 阅读奖励触发链

```
用户进入新闻详情页
    ↓
前端启动 1 秒计时器
    ↓
计时 ≥ 30 秒 且 用户已登录 且 未标记已读
    ↓
POST /api/news/{cardId}/read (read_duration=秒数)
    ↓
后端检查 ReadingRecord 是否存在
    ├─ 不存在 → 创建记录，发放积分+经验，返回奖励数值
    └─ 已存在 → 仅更新阅读时长，返回 0 积分 0 经验
    ↓
前端标记 readingReported=true，停止计时器
```

### 3.3 每日任务触发链

```
用户阅读新闻 → ReadingRecord +1
    ↓
前端定期调用 GET /api/rewards/daily-tasks
    ↓
后端统计今日 ReadingRecord 数量
    ↓
返回 { progress: 3, target: 5, claimable: false }
    ↓
progress ≥ 5 时，claimable = true
    ↓
用户点击「领取奖励」
    ↓
POST /api/rewards/claim-daily-task?task_id=read_5
    ↓
后端校验 → 发放 30 积分 + 15 经验 → 记录 PointTransaction
```

### 3.4 推送触发链

```
采集完成
    ↓
PushService.run_pipeline(trigger_type)
    ↓
取近 48h AI 价值分 Top 8 新闻
    ↓
查 UserPushSettings 表，筛选匹配 trigger_type 的订阅者
    ├─ trigger=auto_visit → 只推开启了 push_on_visit 的用户
    └─ trigger=cron_00_00 → 只推开启了 push_on_daily_cron 的用户
    ↓
生成公共标题和摘要
    ↓
逐个发送邮件（SMTP）→ 记录成功/失败
微信发送（占位）→ 记录 skipped
    ↓
写入 PushHistory 表（状态/收件数/成功数/失败数/错误信息）
    ↓
用户可在「历史推送」页查看
```

---

## 四、开发者财力投入分析

> 以下分析基于当前代码实现，按「必须投入」和「可选投入」分类。

### 4.1 必须投入（不投则功能不可用）

| 项目 | 月成本 | 说明 |
|------|--------|------|
| **服务器托管（Render）** | $0 ~ $7/月 | Render 免费版：750 小时/月，15 分钟无访问自动休眠（00:00 cron 可能不触发，但有访问触发兜底）。付费版 $7/月：不休眠，cron 准点触发有保障。 |
| **数据库（Render PostgreSQL）** | $0 ~ $7/月 | Render 免费 PostgreSQL：90 天后自动删除数据。付费 $7/月：永久存储。**强烈建议付费**，否则用户数据 90 天后丢失。 |
| **域名（可选）** | $10~15/年 | 如果不用 `.onrender.com` 免费域名，需自购域名。非必须。 |

### 4.2 LLM API 费用（核心功能，但有免费额度）

当前 `config.py` 默认配置了 3 个 LLM provider，全部有免费额度：

| Provider | 免费额度 | 每条新闻 4 次调用 | 每日 50~100 条 | 是否花钱 |
|---------|---------|-----------------|--------------|---------|
| **Groq** | 30 次/分钟，10000 次/天 | 4 次/条 | 200~400 次/天 | ❌ 不花钱 |
| **Google Gemini (Free)** | 15 次/分钟，1500 次/天 | 4 次/条 | 200~400 次/天 | ❌ 不花钱 |
| **OpenRouter (Free)** | 部分模型免费 | 4 次/条 | 200~400 次/天 | ❌ 不花钱 |

**结论**：如果你在 Render 环境变量中配置了上述任一免费 provider 的 API Key，**LLM 费用 = 0 元人民币**。

**如果切换到收费 LLM**（如 OpenAI GPT-4o-mini）：
- GPT-4o-mini：$0.15/百万输入 token，$0.60/百万输出 token
- 每条约 2000 输入 token + 500 输出 token × 4 次调用 = 约 10000 token
- 每日 100 条 = 约 100 万 token ≈ $0.15~0.20/天 ≈ **$4.5~6/月**
- 如果用 GPT-4o（非 mini）：约 **$150~200/月**（不推荐）

### 4.3 邮件推送费用

| 方案 | 月成本 | 说明 |
|------|--------|------|
| **Gmail 应用专用密码** | $0 | 免费，每天限 500 封。适合小规模（< 500 用户）。需开启两步验证 + 生成应用密码。 |
| **腾讯企业邮** | $0 | 免费，需有域名。每天限 500 封。 |
| **Resend** | $0 ~ $20/月 | 免费版 3000 封/月，100 封/天。付费 $20/月 = 50000 封/月。 |
| **SendGrid** | $0 ~ $19.95/月 | 免费版 100 封/天。付费 $19.95/月 = 50000 封/月。 |

**配置方法**：在 Render Environment Variables 中设置：
```
MAIL_SERVER=smtp.gmail.com (或 smtp.resend.com 等)
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-specific-password
MAIL_USE_TLS=true
MAIL_FROM=your-email@gmail.com
```

### 4.4 微信推送费用

| 方案 | 月成本 | 说明 |
|------|--------|------|
| **企业微信（自建应用）** | $0 | 免费，但需要企业主体注册企业微信。可对成员主动推送消息（00:00 定时推送可行）。需配置 CorpID/CorpSecret/AgentID。 |
| **微信公众号（服务号）** | $0 ~ ¥300/年 | 认证服务号 ¥300/年认证费。可发模板消息，但需用户主动订阅授权。 |
| **微信公众号（订阅号）** | $0 | 免费，但只能在用户进入会话 48h 内被动回复，不能 00:00 主动推送。 |

**当前实现状态**：微信推送为占位实现（`_send_wechat_sync` 返回 skipped）。如需启用，在 [push_service.py](file:///Users/vinces/Documents/trae_projects/N/backend/app/services/push_service.py) 的 `_send_wechat_sync` 方法中替换为企业微信 API 调用。

### 4.5 前端托管费用

| 方案 | 月成本 | 说明 |
|------|--------|------|
| **Vercel（当前）** | $0 | 免费 Hobby 计划，100GB 带宽/月。足够中小规模使用。 |
| **Vercel Pro** | $20/月 | 1TB 带宽，更多构建分钟数。用户量大时再考虑。 |

### 4.6 费用汇总

| 运营规模 | 月成本 | 包含 |
|---------|--------|------|
| **最小可用** | ¥0 | Render 免费 + 免费 PostgreSQL（90 天数据丢失风险）+ 免费 LLM + Gmail + Vercel 免费 |
| **推荐配置** | ≈ ¥100~120/月 | Render 付费 $7 + PostgreSQL $7 + 免费 LLM + Gmail/Resend 免费 + Vercel 免费 |
| **完整配置** | ≈ ¥200~300/月 | 推荐配置 + 企业微信（¥0）+ 公众号认证（¥300/年）+ 域名（¥100/年） |
| **大规模** | ¥500+/月 | Vercel Pro + SendGrid 付费 + 更大数据库 |

### 4.7 零成本验证清单

如果你想先以 ¥0 成本验证整个平台：

1. ✅ Render 免费版部署后端（15 分钟休眠，访问触发兜底）
2. ✅ Render 免费版 PostgreSQL（90 天内验证足够）
3. ✅ Vercel 免费版部署前端
4. ✅ Groq 免费 API Key（注册 groq.com，免费获取）
5. ✅ Gmail 应用专用密码（开启两步验证后生成）
6. ✅ 访问触发采集（不依赖 00:00 cron，打开网站就采集）
7. ⚠️ 微信推送不可用（需要企业微信才能主动推送）

---

## 五、环境变量配置清单

在 Render 的 Environment Variables 或本地 `.env` 中配置：

```bash
# 数据库
DATABASE_URL=postgresql://...

# LLM（至少配一个）
LLM_PROVIDERS=[{"provider":"groq","api_key":"gsk_xxx","model":"llama-3.1-70b-versatile"}]

# 邮件推送（不配则邮件推送自动跳过，不报错）
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=you@gmail.com
MAIL_PASSWORD=xxxx应用专用密码xxxx
MAIL_USE_TLS=true
MAIL_FROM=you@gmail.com

# 前端
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api

# 采集
COLLECTION_INTERVAL_HOURS=24
```

---

## 六、API 接口速查

### 公开接口（无需登录）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/public/stats` | 获取平台统计数据 |
| POST | `/api/public/trigger-collection` | 触发采集+推送（20 分钟去抖） |

### 资讯接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/news/` | 获取资讯列表（分页/分类/搜索） |
| GET | `/api/news/{cardId}` | 获取资讯详情 |
| POST | `/api/news/{cardId}/read` | 标记已读（首次发奖励，重复不发） |
| GET | `/api/news/history` | 获取阅读历史 |
| GET | `/api/news/heatmap` | 获取活跃度热力图 |

### 奖励接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/rewards/balance` | 获取积分余额 |
| POST | `/api/rewards/checkin` | 每日签到 |
| GET | `/api/rewards/cards` | 获取卡牌列表 |
| POST | `/api/rewards/draw-card` | 抽卡（花费 50 积分） |
| POST | `/api/rewards/synthesize-cards` | 合成卡牌（3 张同稀有度 → 1 张更高） |
| POST | `/api/rewards/gift-card` | 赠送卡牌给好友 |
| GET | `/api/rewards/daily-tasks` | 获取每日任务进度 |
| POST | `/api/rewards/claim-daily-task` | 领取每日任务奖励 |
| GET | `/api/rewards/leaderboard` | 获取排行榜 |

### 好友接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/friends/search?q=` | 搜索用户 |
| POST | `/api/friends/request?to_user_id=` | 发送好友请求 |
| POST | `/api/friends/{id}/accept` | 接受好友请求 |
| POST | `/api/friends/{id}/reject` | 拒绝好友请求 |
| GET | `/api/friends/requests` | 获取待处理请求 |
| GET | `/api/friends/` | 获取好友列表 |
| DELETE | `/api/friends/{id}` | 删除好友 |

### 分享接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/shares/generate` | 生成分享链接 |
| GET | `/api/shares/stats` | 获取分享统计 |
| POST | `/api/shares/invite` | 创建邀请码 |
| GET | `/api/shares/{token}` | 跟踪分享点击 |

### 推送接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/push-history` | 获取推送历史 |
| GET | `/api/push-history/{id}` | 获取推送详情 |
| GET | `/api/user/push-settings` | 获取推送设置 |
| PUT | `/api/user/push-settings` | 更新推送设置 |
| POST | `/api/user/push-settings/send-test-email` | 发送测试邮件 |

### 管理员接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/run-collection` | 强制触发采集+推送 |
| GET | `/api/admin/db-check` | 检查数据库连接 |
| POST | `/api/admin/settle-predictions` | 结算预测 |

---

*文档最后更新：2026-08-18*
*平台版本：基于当前代码库状态*
