# NEXUS AI 新闻平台

NEXUS 把本机 DailyBrief 生成的高质量新闻卡片保存为可浏览、收藏和追踪的知识流，并自动推送到飞书群。

当前架构：

1. 用户 Mac 上的 Ollama 负责摘要与分析，不调用 Groq、Gemini、OpenRouter 等外部 LLM API。
2. DailyBrief 完成抓取、事件聚合、可解释评分和事实约束。
3. 私有导入接口用 `story_id` 幂等同步到 NEXUS，重复运行不会重复发新闻。
4. NEXUS 后端保存卡片并通过飞书自定义机器人发送群消息。
5. Vercel 前端继续提供账号、新闻、历史、积分、卡牌、预测和社交功能。

## 本地模型同步

DailyBrief 设置以下本地环境变量：

```bash
NEXUS_API_BASE_URL=https://your-backend.example.com/api
NEXUS_INGEST_TOKEN=与云端相同的长随机字符串
```

云端后端设置：

```bash
LOCAL_INGEST_ONLY=true
NEXUS_INGEST_TOKEN=与本机相同的长随机字符串
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/...
```

真实密钥不要提交到 GitHub。
