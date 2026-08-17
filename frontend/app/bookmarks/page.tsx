'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bookmark,
  BookmarkX,
  Loader2,
  AlertCircle,
  ExternalLink,
  Flame,
  Sparkles,
  Clock,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import { getBookmarkIds, getNewsCard, isAuthenticated } from '@/lib/api';
import type { NewsCard as NewsCardType } from '@/lib/types';

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

export default function BookmarksPage() {
  const [authed, setAuthed] = useState(false);
  const [cards, setCards] = useState<NewsCardType[]>([]);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const ids = getBookmarkIds();
    if (ids.length === 0) {
      setCards([]);
      setFailedIds([]);
      setLoading(false);
      return;
    }
    try {
      const results: { id: string; card: NewsCardType | null }[] = await Promise.all(
        ids.map((id) =>
          getNewsCard(id)
            .then((c): { id: string; card: NewsCardType | null } => ({ id, card: c }))
            .catch(
              (): { id: string; card: NewsCardType | null } => ({ id, card: null })
            )
        )
      );
      setCards(
        results
          .map((r) => r.card)
          .filter((c): c is NewsCardType => c !== null)
      );
      setFailedIds(results.filter((r) => r.card === null).map((r) => r.id));
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
    load();
  }, [load]);

  const handleClearAll = () => {
    if (!confirm('确认清空所有收藏？此操作不可撤销。')) return;
    setClearing(true);
    try {
      localStorage.removeItem('nexus_bookmarks');
    } finally {
      setClearing(false);
      setCards([]);
      setFailedIds([]);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header showSearch={false} />
      <Sidebar />

      <main className="pt-16 lg:pl-64 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,255,209,0.25), rgba(191,0,255,0.25))',
                  border: '1px solid rgba(0,255,209,0.35)',
                }}
              >
                <Bookmark className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">我的收藏</h1>
                <p className="text-muted text-sm mt-0.5">
                  收藏的资讯保存在本地浏览器，更换设备不会同步。
                </p>
              </div>
            </div>

            {authed && cards.length > 0 && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                onClick={handleClearAll}
                disabled={clearing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-accent/40 text-accent bg-accent/10 hover:bg-accent/20 transition-colors disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                {clearing ? '清空中…' : '清空收藏'}
              </motion.button>
            )}
          </div>

          {!authed ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/15 flex items-center justify-center">
                <Bookmark className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">登录后查看收藏</h2>
              <p className="text-sm text-muted mb-6 max-w-md mx-auto">
                收藏功能基于本地浏览器存储，但查看资讯详情、获取积分需要先登录账号。
              </p>
              <Link href="/auth" className="btn-neon btn-neon-primary">
                去登录 / 注册
              </Link>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <span className="text-muted text-sm">加载收藏中...</span>
            </div>
          ) : cards.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
                <BookmarkX className="w-8 h-8 text-muted" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">还没有收藏任何资讯</h2>
              <p className="text-sm text-muted mb-6 max-w-md mx-auto">
                浏览 AI 资讯时点击书签图标即可加入收藏，方便随时回看高价值内容。
              </p>
              <Link href="/news" className="btn-neon btn-neon-primary">
                去资讯广场逛逛
                <ArrowRight className="w-4 h-4 ml-2 inline" />
              </Link>
            </div>
          ) : (
            <>
              <div className="text-xs text-muted mb-3">
                共 {cards.length} 条收藏
                {failedIds.length > 0 && (
                  <span className="text-accent ml-2">（{failedIds.length} 条加载失败）</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cards.map((card, idx) => {
                  const categoryColor =
                    (card.category && categoryColors[card.category]) || '#00FFD1';
                  const categoryLabel =
                    (card.category && categoryLabels[card.category]) || '📰 资讯';
                  return (
                    <motion.div
                      key={card.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
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
                            <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/30">
                              ✓ 已阅读
                            </span>
                          )}
                          <span className="ml-auto text-muted/70 text-xs flex-shrink-0">
                            <Bookmark className="w-3.5 h-3.5 inline fill-primary text-primary" />
                          </span>
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

              {failedIds.length > 0 && (
                <div className="mt-6 glass-card rounded-2xl p-5 border border-accent/30 bg-accent/5 text-sm text-accent flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold mb-1">部分收藏加载失败</div>
                    <p className="text-muted text-xs leading-relaxed">
                      以下资讯可能已被删除或暂时无法访问：{failedIds.slice(0, 5).join('，')}
                      {failedIds.length > 5 ? '…' : ''}
                    </p>
                  </div>
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
