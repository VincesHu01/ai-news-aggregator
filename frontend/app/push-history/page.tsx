'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  History,
  Mail,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  CalendarDays,
  RadioTower,
  ChevronRight,
  FileText
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import { listPushHistory, isAuthenticated, PushHistoryEntry, getNewsCard } from '@/lib/api';
import type { NewsCard as NewsCardType } from '@/lib/types';

const TRIGGER_LABEL: Record<string, { label: string; color: string }> = {
  auto_visit: { label: '访问自动触发', color: 'text-sky-300 bg-sky-500/15 border-sky-400/30' },
  cron_00_00: { label: '每日 00:00 定时', color: 'text-violet-300 bg-violet-500/15 border-violet-400/30' },
  cron_interval: { label: '间隔定时', color: 'text-amber-300 bg-amber-500/15 border-amber-400/30' },
  manual: { label: '管理员手动', color: 'text-rose-300 bg-rose-500/15 border-rose-400/30' },
};

function statusIcon(status: string) {
  switch (status) {
    case 'success':
      return { Icon: CheckCircle2, cls: 'text-emerald-400', text: '发送成功' };
    case 'partial':
      return { Icon: AlertTriangle, cls: 'text-amber-400', text: '部分成功' };
    case 'failed':
      return { Icon: XCircle, cls: 'text-rose-400', text: '发送失败' };
    case 'skipped':
      return { Icon: HelpCircle, cls: 'text-muted', text: '已跳过' };
    case 'sending':
    case 'pending':
      return { Icon: Loader2, cls: 'text-primary animate-spin', text: status === 'sending' ? '发送中' : '等待发送' };
    default:
      return { Icon: HelpCircle, cls: 'text-muted', text: status };
  }
}

function formatDate(iso?: string | null) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch {
    return iso;
  }
}

export default function PushHistoryPage() {
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState<PushHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cardDetails, setCardDetails] = useState<Record<string, NewsCardType>>({});
  const [loadingCards, setLoadingCards] = useState(false);

  useEffect(() => {
    setAuthed(isAuthenticated());
  }, []);

  const load = () => {
    setLoading(true);
    setErr(null);
    listPushHistory(1, 50)
      .then(setItems)
      .catch((e) => setErr(e?.response?.data?.detail ?? e?.message ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!authed) return;
    load();
  }, [authed]);

  const loadCardsFor = async (ids: string[]) => {
    if (!ids.length) return;
    const missing = ids.filter((id) => !cardDetails[id]);
    if (!missing.length) return;
    setLoadingCards(true);
    try {
      const results = await Promise.all(
        missing.map((id) => getNewsCard(id).catch(() => null as NewsCardType | null))
      );
      const next = { ...cardDetails };
      missing.forEach((id, i) => {
        const r = results[i];
        if (r) next[id] = r;
      });
      setCardDetails(next);
    } finally {
      setLoadingCards(false);
    }
  };

  return (
    <main className="min-h-screen bg-background relative">
      <Header showSearch={false} />
      <Sidebar />
      <div className="pt-16 lg:pl-64 pb-24">
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(255,179,0,0.25), rgba(255,0,110,0.25))', border: '1px solid rgba(255,179,0,0.35)' }}
            >
              <History className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-wide">历史推送</h1>
              <p className="text-sm text-muted">
                查看所有采集推送批次：00:00 定时 / 访问自动触发 / 手动触发 的执行结果、收件数与详情。
              </p>
            </div>
          </div>

          {!authed ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <RadioTower className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">登录后查看历史推送</h2>
              <p className="text-sm text-muted mb-6">
                历史推送页仅对已登录用户开放，可查看推送覆盖的 AI 资讯摘要与发送状态。
              </p>
              <Link href="/auth" className="btn-neon btn-neon-primary">
                去登录 / 注册
              </Link>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-primary animate-spin mr-3" />
              <span className="text-muted">加载推送历史…</span>
            </div>
          ) : err ? (
            <div className="glass-card rounded-2xl p-6 border border-rose-400/30 text-rose-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold mb-1">加载失败</div>
                <div className="text-sm opacity-90 break-words">{err}</div>
                <button onClick={load} className="mt-3 btn-neon btn-neon-primary text-sm py-2 px-4">
                  重试
                </button>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center">
              <CalendarDays className="w-12 h-12 text-muted mx-auto mb-4 opacity-70" />
              <h2 className="text-lg font-semibold text-white mb-2">暂无推送记录</h2>
              <p className="text-sm text-muted mb-6 max-w-lg mx-auto">
                回到首页会立刻触发一次采集+推送。若未采集到新资讯 / 没有用户开启订阅，会生成一条"已跳过"的推送记录供排查。
              </p>
              <Link href="/" className="btn-neon btn-neon-primary">
                返回首页触发采集
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((it, idx) => {
                const trig = TRIGGER_LABEL[it.trigger_type] ?? {
                  label: it.trigger_type,
                  color: 'text-muted bg-white/5 border-white/10',
                };
                const st = statusIcon(it.status);
                const StatusIcon = st.Icon;
                const expanded = expandedId === it.id;
                return (
                  <motion.article
                    key={it.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="glass-card rounded-2xl p-5 transition-shadow hover:border-primary/25 border border-border"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center border ${
                            it.push_channel.includes('wechat')
                              ? 'bg-emerald-500/10 border-emerald-400/30'
                              : 'bg-sky-500/10 border-sky-400/30'
                          }`}
                        >
                          {it.push_channel.includes('wechat') ? (
                            <Mail className="w-4.5 h-4.5 text-emerald-300" />
                          ) : (
                            <Mail className="w-4.5 h-4.5 text-sky-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2.5 py-0.5 text-xs rounded-full border ${trig.color}`}>
                              {trig.label}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${st.cls}`}>
                              <StatusIcon className="w-3.5 h-3.5" />
                              {st.text}
                            </span>
                            {it.status === 'skipped' && !it.news_count && (
                              <span className="text-xs text-muted">（本轮无新资讯或无订阅）</span>
                            )}
                          </div>
                          <div className="mt-1.5 text-base font-semibold text-white line-clamp-2">
                            {it.title ?? '（无标题）'}
                          </div>
                          <div className="mt-2 text-xs text-muted flex flex-wrap gap-x-4 gap-y-1">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />创建 {formatDate(it.created_at)}
                            </span>
                            {it.sent_at && (
                              <span className="inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />完成 {formatDate(it.sent_at)}
                              </span>
                            )}
                            <span>资讯 {it.news_count} 条</span>
                            <span>订阅者 {it.recipient_count} 人</span>
                            <span className="text-emerald-300">成功 {it.success_count}</span>
                            {it.failed_count > 0 && (
                              <span className="text-rose-300">失败 {it.failed_count}</span>
                            )}
                            {it.push_channel && (
                              <span className="inline-flex items-center gap-1 text-muted/80">
                                渠道：{it.push_channel}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setExpandedId(expanded ? null : it.id);
                          if (!expanded) loadCardsFor(it.news_card_ids || []);
                        }}
                        className="self-end sm:self-start inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-white hover:border-primary/40 hover:bg-primary/10 transition-colors"
                      >
                        {expanded ? '收起详情' : '查看推送详情'}
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
                        />
                      </button>
                    </div>

                    {it.summary && (
                      <div className="mt-4 rounded-xl bg-surface/60 border border-border px-4 py-3 whitespace-pre-wrap text-sm leading-relaxed text-white/85">
                        {it.summary}
                      </div>
                    )}

                    {it.error_message && (
                      <div className="mt-3 rounded-xl bg-rose-500/10 border border-rose-400/30 px-4 py-3 text-sm text-rose-200 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="break-words">{it.error_message}</div>
                      </div>
                    )}

                    {expanded && (it.news_card_ids?.length ?? 0) > 0 && (
                      <div className="mt-4 border-t border-border pt-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted uppercase tracking-wider mb-2">
                          <FileText className="w-3.5 h-3.5" />
                          本轮推送包含的 AI 资讯
                        </div>
                        {loadingCards && !it.news_card_ids.every((id) => cardDetails[id]) && (
                          <div className="flex items-center gap-2 text-xs text-muted py-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            加载资讯详情…
                          </div>
                        )}
                        {(it.news_card_ids || []).map((cid) => {
                          const c = cardDetails[cid];
                          if (!c) {
                            return (
                              <div
                                key={cid}
                                className="rounded-xl border border-border bg-white/[0.02] px-4 py-3 text-sm text-muted flex items-center justify-between"
                              >
                                <span className="font-mono text-xs">{cid.slice(0, 12)}…</span>
                                <Link
                                  href={`/news/${cid}`}
                                  className="text-xs text-primary hover:underline"
                                >
                                  打开 →
                                </Link>
                              </div>
                            );
                          }
                          return (
                            <Link
                              key={cid}
                              href={`/news/${cid}`}
                              className="block rounded-xl border border-border bg-white/[0.02] hover:border-primary/30 hover:bg-primary/5 transition-all p-4"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-white line-clamp-1">
                                    {c.title}
                                  </div>
                                  <div className="mt-1 text-xs text-muted line-clamp-2">
                                    {c.summary}
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                    <span className="text-muted/80">来源：{c.source || '-'}</span>
                                    <span className="text-primary">AI 价值分 {Math.round(c.ai_value_score || 0)}</span>
                                    <span className="text-secondary">热度 {Math.round(c.heat_score || 0)}</span>
                                    {(c.interest_tags || []).slice(0, 4).map((t) => (
                                      <span
                                        key={t}
                                        className="px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px]"
                                      >
                                        #{t}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted flex-shrink-0 mt-1" />
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </motion.article>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <BottomNav />
    </main>
  );
}
