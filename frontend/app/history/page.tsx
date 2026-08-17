'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  History,
  Loader2,
  AlertCircle,
  ExternalLink,
  Flame,
  Sparkles,
  Clock,
  CheckCircle2,
  ArrowRight,
  Inbox,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import { getReadingHistory, isAuthenticated } from '@/lib/api';
import type { NewsCard as NewsCardType, NewsCardListResponse } from '@/lib/types';

const categoryColors: Record<string, string> = {
  hot: '#FF006E',
  tech: '#00FFD1',
  business: '#BF00FF',
  finance: '#FFD93D',
  academic: '#6BCB77',
};

const categoryLabels: Record<string, string> = {
  hot: '🔥 热门',
  tech: '⚡ 技术',
  business: '💼 商业',
  finance: '📈 财经',
  academic: '🎓 学术',
};

const PAGE_SIZE = 20;

export default function HistoryPage() {
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState<NewsCardType[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: NewsCardListResponse = await getReadingHistory(1, PAGE_SIZE);
      setItems(data.items);
      setTotal(data.total);
      setPage(1);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ok = isAuthenticated();
    setAuthed(ok);
    if (!ok) {
      setLoading(false);
      return;
    }
    loadFirst();
  }, [loadFirst]);

  const hasMore = items.length < total;

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const data = await getReadingHistory(next, PAGE_SIZE);
      setItems((prev) => [...prev, ...data.items]);
      setPage(next);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? '加载更多失败');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header showSearch={false} />
      <Sidebar />

      <main className="pt-16 lg:pl-64 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(0,255,209,0.25), rgba(191,0,255,0.25))',
                border: '1px solid rgba(0,255,209,0.35)',
              }}
            >
              <History className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">阅读历史</h1>
              <p className="text-muted text-sm mt-0.5">
                {total > 0 ? `已阅读 ${total} 篇 AI 资讯` : '回顾你阅读过的资讯'}
              </p>
            </div>
          </div>

          {!authed ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/15 flex items-center justify-center">
                <History className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">登录后查看阅读历史</h2>
              <p className="text-sm text-muted mb-6 max-w-md mx-auto">
                阅读历史记录你完整阅读过的 AI 资讯，方便复盘高价值内容。登录后系统会自动追踪你的阅读时长。
              </p>
              <Link href="/auth" className="btn-neon btn-neon-primary">
                去登录 / 注册
              </Link>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <span className="text-muted text-sm">加载阅读历史中...</span>
            </div>
          ) : error ? (
            <div className="glass-card rounded-2xl p-6 border border-accent/30 text-accent flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold mb-1">加载失败</div>
                <div className="text-sm opacity-90 break-words">{error}</div>
                <button
                  onClick={loadFirst}
                  className="mt-3 btn-neon btn-neon-primary text-sm py-2 px-4"
                >
                  重试
                </button>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
                <Inbox className="w-8 h-8 text-muted" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">还没有阅读记录</h2>
              <p className="text-sm text-muted mb-6 max-w-md mx-auto">
                在资讯页停留 30 秒以上即可标记为已阅读，并获取积分与经验。
              </p>
              <Link href="/news" className="btn-neon btn-neon-primary">
                去阅读第一篇资讯
                <ArrowRight className="w-4 h-4 ml-2 inline" />
              </Link>
            </div>
          ) : (
            <>
              <div className="text-xs text-muted mb-3">
                已展示 {items.length} / {total} 篇
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {items.map((card, idx) => {
                  const categoryColor =
                    (card.category && categoryColors[card.category]) || '#00FFD1';
                  const categoryLabel =
                    (card.category && categoryLabels[card.category]) || '📰 资讯';
                  return (
                    <motion.div
                      key={card.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                      whileHover={{ y: -2 }}
                    >
                      <Link
                        href={`/news/${card.id}`}
                        className="block glass-card rounded-2xl p-5 h-full border border-border hover:border-primary/40 transition-all group"
                      >
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <span
                            className="px-2.5 py-0.5 rounded-full text-xs font-medium border"
                            style={{
                              backgroundColor: `${categoryColor}20`,
                              color: categoryColor,
                              borderColor: `${categoryColor}40`,
                            }}
                          >
                            {categoryLabel}
                          </span>
                          {card.is_read && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/30">
                              <CheckCircle2 className="w-3 h-3" />
                              已阅读
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-semibold text-white leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                          {card.title}
                        </h3>

                        {card.summary && (
                          <p className="text-sm text-muted leading-relaxed line-clamp-2 mb-3">
                            {card.summary}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                          <span className="inline-flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            {card.source || '未知来源'}
                          </span>
                          {card.published_at && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(card.published_at).toLocaleDateString('zh-CN')}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-orange-400">
                            <Flame className="w-3 h-3" />
                            {Math.round(card.heat_score || 0)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-primary">
                            <Sparkles className="w-3 h-3" />
                            {Math.round(card.ai_value_score || 0)}
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              {hasMore && (
                <div className="mt-8 flex justify-center">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="btn-neon btn-neon-primary"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        加载中...
                      </>
                    ) : (
                      <>
                        加载更多
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </motion.button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
