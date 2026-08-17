'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  Flame,
  Sparkles,
  Clock,
  Tag,
  AlertCircle,
  Loader2,
  Heart,
  Bookmark,
  Share2,
  Gift,
  Trophy,
  CheckCircle2,
  X
} from 'lucide-react';
import type { NewsCard as NewsCardType } from '@/lib/types';
import { getNewsCard, isAuthenticated, markAsRead, isBookmarked, toggleBookmark } from '@/lib/api';
import ShareDialog from '@/components/ShareDialog';

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

export default function NewsDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params.cardId as string;

  const [card, setCard] = useState<NewsCardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [readingReported, setReadingReported] = useState(false);
  const [rewardToast, setRewardToast] = useState<{
    visible: boolean;
    points: number;
    experience: number;
    new_balance?: number;
    alreadyRead?: boolean;
  } | null>(null);
  const readingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readingSecRef = useRef(0); // ref 保存秒数，不触发每 1 秒重渲染
  const [shareOpen, setShareOpen] = useState(false);

  // 读取时长进度条 UI 用，降低刷新频率：每 5 秒 setState 一次（不是每 1 秒）
  const [readingSecDisplay, setReadingSecDisplay] = useState(0);

  useEffect(() => {
    const fetchCard = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getNewsCard(cardId);
        setCard(data);
        setBookmarked(isBookmarked(cardId));
      } catch (e: any) {
        const msg = e?.response?.data?.detail || e?.message || '加载失败';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchCard();
  }, [cardId]);

  // 阅读计时器：满 5 秒即上报（给足奖励）。>30s 继续计时但不再上报。
  // 为避免闪动，不使用每 1 秒 setState 触发整页重渲染，改用 ref + 每 5 秒同步一次显示。
  useEffect(() => {
    if (!card || card.is_read || readingReported) return;

    readingSecRef.current = 0;
    setReadingSecDisplay(0);

    readingTimerRef.current = setInterval(() => {
      readingSecRef.current += 1;
      const cur = readingSecRef.current;

      if (cur % 5 === 0) {
        setReadingSecDisplay(cur);
      }

      // 上报阈值：满 5 秒
      if (!readingReported && cur >= 5 && isAuthenticated()) {
        markAsRead(card.id, cur)
          .then((resp) => {
            const pt = resp?.points_earned ?? 0;
            const ex = resp?.experience_earned ?? 0;
            const already = pt === 0 && ex === 0;
            setRewardToast({
              visible: true,
              points: pt,
              experience: ex,
              new_balance: resp?.new_balance,
              alreadyRead: already,
            });
            setTimeout(() => {
              setRewardToast((t) => (t ? { ...t, visible: false } : null));
              setTimeout(() => setRewardToast(null), 500);
            }, 2800);
            setReadingReported(true);
            setCard((prev) => (prev ? { ...prev, is_read: true } : prev));
          })
          .catch((e) => {
            console.error('Failed to mark as read:', e);
          });
      }
    }, 1000);

    return () => {
      if (readingTimerRef.current) {
        clearInterval(readingTimerRef.current);
        readingTimerRef.current = null;
      }
    };
  }, [card, readingReported, cardId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-muted text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center glass-card rounded-2xl p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {error?.includes('404') || error?.includes('不存在') ? 'This page could not be found.' : '加载失败'}
          </h2>
          <p className="text-muted text-sm mb-6">{error || '请求的资讯不存在或已被删除'}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.back()}
              className="px-5 py-2.5 rounded-xl bg-surface border border-border text-white hover:bg-surface/80 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> 返回
            </button>
            <Link
              href="/news"
              className="px-5 py-2.5 rounded-xl bg-primary text-background font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              浏览资讯列表
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const categoryColor = (card.category && categoryColors[card.category]) || '#00FFD1';
  const categoryLabel = (card.category && categoryLabels[card.category]) || '📰 资讯';

  return (
    <main className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">返回</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLiked(!liked)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                liked ? 'bg-accent/20 text-accent' : 'bg-surface text-muted hover:text-white'
              }`}
            >
              <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={() => setBookmarked(toggleBookmark(card.id))}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                bookmarked ? 'bg-primary/20 text-primary' : 'bg-surface text-muted hover:text-white'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="w-9 h-9 rounded-full bg-surface text-muted hover:text-white flex items-center justify-center transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Article Body */}
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Category Tag */}
          <div className="mb-4 flex items-center gap-3">
            <span
              className="px-3 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1.5"
              style={{ backgroundColor: `${categoryColor}20`, color: categoryColor, border: `1px solid ${categoryColor}40` }}
            >
              {categoryLabel}
            </span>
            {card.is_read && (
              <span className="px-3 py-1 rounded-lg text-xs bg-primary/10 text-primary border border-primary/30">
                ✓ 已阅读
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-4">
            {card.title}
          </h1>

          {/* Meta Bar */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted mb-6 pb-6 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center">
                <ExternalLink className="w-3.5 h-3.5 text-muted" />
              </div>
              <span className="font-medium text-white">{card.source}</span>
            </div>
            {card.published_at && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>{new Date(card.published_at).toLocaleDateString('zh-CN')}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-400" />
              <span>热度 {card.heat_score.toFixed(0)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" style={{ color: '#00FFD1' }} />
              <span>AI价值 {card.ai_value_score.toFixed(0)}</span>
            </div>
          </div>

          {/* Cover Image */}
          {card.cover_image && (
            <div className="mb-6 rounded-2xl overflow-hidden border border-border aspect-video bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.cover_image}
                alt={card.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Summary / Content */}
          <div className="prose prose-invert max-w-none">
            <div className="p-5 rounded-2xl bg-surface/50 border border-border mb-6">
              <div className="flex items-center gap-2 text-primary text-sm font-medium mb-3">
                <Sparkles className="w-4 h-4" />
                <span>AI 生成摘要</span>
              </div>
              <p className="text-white/90 leading-relaxed whitespace-pre-wrap">
                {card.summary || '暂无摘要内容'}
              </p>
            </div>
          </div>

          {/* Tags */}
          {card.interest_tags && card.interest_tags.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 text-muted text-sm mb-3">
                <Tag className="w-4 h-4" />
                <span>兴趣标签</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {card.interest_tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 rounded-xl text-sm bg-surface text-muted border border-border hover:text-white hover:border-primary/40 transition-colors"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Reading progress + Reward indicator（不闪动） */}
          {!card.is_read ? (
            <div className="mt-6 rounded-2xl border border-border bg-surface/40 p-4">
              <div className="flex items-center justify-between text-xs text-muted mb-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>阅读奖励：满 5 秒 +5 积分 / +3 经验（阅读更久最高 3 倍）</span>
                </div>
                <span className="text-primary font-medium">
                  {readingReported ? '奖励已发放' : `已阅读 ${readingSecDisplay} 秒`}
                </span>
              </div>
              <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #00FFD1, #BF00FF)' }}
                  initial={{ width: 0 }}
                  animate={{ width: readingReported ? '100%' : `${Math.min(100, (readingSecDisplay / 5) * 100)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/10 p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="text-sm text-white/90">
                你已经完整阅读过这篇资讯的奖励（积分+经验仅限首次阅读一次性发放）。
              </div>
            </div>
          )}

          {/* Read Original CTA */}
          {card.source_url && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20">
              <p className="text-muted text-sm mb-3">查看完整原文请访问来源网站：</p>
              <a
                href={card.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-background font-medium hover:opacity-90 transition-opacity"
              >
                <ExternalLink className="w-4 h-4" />
                阅读原文
              </a>
            </div>
          )}
        </motion.div>
      </article>

      {/* 阅读奖励 Toast（只弹一次） */}
      <AnimatePresence>
        {rewardToast && rewardToast.visible && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.35, type: 'spring' }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] w-[90%] max-w-sm"
          >
            <div className="glass-card rounded-2xl border border-primary/40 p-4 shadow-[0_0_30px_rgba(0,255,209,0.15)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                    {rewardToast.alreadyRead ? <CheckCircle2 className="w-5 h-5 text-white" /> : <Trophy className="w-5 h-5 text-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    {rewardToast.alreadyRead ? (
                      <>
                        <div className="text-sm font-bold text-white mb-1">你已经领取过这篇资讯的奖励啦</div>
                        <div className="text-xs text-muted">每篇资讯只发一次，快去发现新资讯吧～</div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-bold text-white mb-1">阅读奖励已到账 🎉</div>
                        <div className="flex flex-wrap gap-3 text-xs">
                          <span className="flex items-center gap-1 text-primary font-medium">
                            <Gift className="w-3.5 h-3.5" /> +{rewardToast.points} 积分
                          </span>
                          <span className="flex items-center gap-1 text-secondary font-medium">
                            <Sparkles className="w-3.5 h-3.5" /> +{rewardToast.experience} 经验
                          </span>
                          {typeof rewardToast.new_balance === 'number' && (
                            <span className="text-muted">当前积分余额 {rewardToast.new_balance}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setRewardToast(null)}
                  className="w-7 h-7 rounded-lg hover:bg-surface flex items-center justify-center text-muted hover:text-white flex-shrink-0"
                  aria-label="关闭"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ShareDialog
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        targetType="news"
        targetId={card.id}
        title={card.title}
      />
    </main>
  );
}
