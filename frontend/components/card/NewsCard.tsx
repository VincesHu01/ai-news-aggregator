'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Bookmark, Share2, Sparkles, Flame, Clock, ExternalLink, Tag, Copy, Check, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { NewsCard as NewsCardType, ReadingResponse } from '@/lib/types';
import { markAsRead, drawCard, isAuthenticated, generateShare } from '@/lib/api';

interface NewsCardProps {
  card: NewsCardType;
  index: number;
  isActive: boolean;
  onSwipe?: () => void;
  onReward?: (response: ReadingResponse) => void;
}

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

const gradientPairs: [string, string][] = [
  ['#00FFD1', '#0066FF'],
  ['#FF006E', '#FF6B35'],
  ['#BF00FF', '#6B00CC'],
  ['#FFD93D', '#FF6B35'],
  ['#00FFD1', '#BF00FF'],
  ['#6BCB77', '#4D96FF'],
];

function getGradient(cardId: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < cardId.length; i++) {
    hash = cardId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % gradientPairs.length;
  return gradientPairs[idx];
}

export default function NewsCard({ card, index, isActive, onSwipe, onReward }: NewsCardProps) {
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [showReward, setShowReward] = useState<ReadingResponse | null>(null);
  const [progress, setProgress] = useState(card.is_read ? 100 : 0);
  const [drawResult, setDrawResult] = useState<string | null>(null);
  const [readingSeconds, setReadingSeconds] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareClicks, setShareClicks] = useState(0);
  const [copied, setCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    if (!isActive || card.is_read) return;
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + 2;
      });
      setReadingSeconds((s) => s + 1);
    }, 100);
    return () => clearInterval(timer);
  }, [isActive, card.is_read]);

  useEffect(() => {
    if (card.is_read || progress < 100 || !isActive || !isAuthenticated()) return;
    const sendRead = async () => {
      try {
        const duration = Math.max(readingSeconds, 30);
        const resp = await markAsRead(card.id, duration);
        setShowReward(resp);
        onReward?.(resp);
        setTimeout(() => setShowReward(null), 2500);
      } catch (e) {
        console.error('Failed to mark as read:', e);
      }
    };
    sendRead();
  }, [progress, card.id, isActive, readingSeconds, onReward, card.is_read]);

  const categoryColor = (card.category && categoryColors[card.category]) || '#00FFD1';
  const categoryLabel = (card.category && categoryLabels[card.category]) || '📰 资讯';
  const gradient = getGradient(card.id);

  const handleDrawCard = async () => {
    if (!isAuthenticated()) {
      setDrawResult('请先登录后再抽卡');
      setTimeout(() => setDrawResult(null), 2500);
      return;
    }
    try {
      const resp = await drawCard('AI新闻精选');
      const rarityNames: Record<string, string> = { N: '普通', R: '稀有', SR: '史诗', SSR: '传说' };
      setDrawResult(`🎉 抽到 ${rarityNames[resp.card.card_rarity] || resp.card.card_rarity} 卡片！`);
      setTimeout(() => setDrawResult(null), 2500);
    } catch (e) {
      setDrawResult('积分不足，无法抽卡');
      setTimeout(() => setDrawResult(null), 2500);
    }
  };

  const handleShareClick = async () => {
    if (!isAuthenticated()) {
      setShareError('请先登录后再分享');
      setShowShareModal(true);
      setTimeout(() => setShareError(null), 2500);
      return;
    }
    setShareLoading(true);
    setShareError(null);
    setShowShareModal(true);
    try {
      const resp = await generateShare('news', card.id);
      const fullUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/share/${resp.token}`
        : resp.share_url;
      setShareLink(fullUrl);
      setShareClicks(resp.click_count);
    } catch (e) {
      setShareError('生成分享链接失败');
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareError('复制失败，请手动复制');
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 100, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -100, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, duration: 0.4 }}
      className="relative w-full h-full flex flex-col"
    >
      <AnimatePresence>
        {showReward && (
          <motion.div
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: 1, y: -80, scale: 1 }}
            exit={{ opacity: 0, y: -120, scale: 0.8 }}
            transition={{ duration: 0.6 }}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <div
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary to-secondary"
              style={{ boxShadow: '0 0 30px rgba(0,255,209,0.6), 0 0 60px rgba(191,0,255,0.4)' }}
            >
              <Sparkles className="w-5 h-5 text-background" />
              <span className="font-bold text-background">
                +{showReward.points_earned} 积分 · +{showReward.experience_earned} 经验
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {drawResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
          >
            <div className="px-6 py-3 rounded-xl bg-surface/95 border border-primary/50 text-center">
              <span className="font-bold text-primary">{drawResult}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex-1 overflow-hidden rounded-2xl card-surface">
        {card.cover_image ? (
          <div
            className="absolute inset-0 h-64 bg-cover bg-center"
            style={{ backgroundImage: `url(${card.cover_image})` }}
          />
        ) : (
          <div
            className="absolute inset-0 h-64"
            style={{
              background: `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`,
            }}
          />
        )}
        <div className="absolute inset-0 h-64 bg-gradient-to-b from-transparent via-transparent to-surface" />

        <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
          <motion.span
            whileHover={{ scale: 1.05 }}
            className="px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-md"
            style={{
              backgroundColor: `${categoryColor}20`,
              color: categoryColor,
              border: `1px solid ${categoryColor}40`,
              textShadow: `0 0 10px ${categoryColor}80`,
            }}
          >
            {categoryLabel}
          </motion.span>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md">
            <Flame className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-bold text-accent">{Math.round(card.heat_score ?? 0)}</span>
          </div>
        </div>

        <div className="relative z-10 pt-72 px-6 pb-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-2xl sm:text-3xl font-bold text-white mb-3 leading-tight"
          >
            {card.title}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-muted text-sm sm:text-base leading-relaxed mb-4 line-clamp-4"
          >
            {card.summary || '暂无摘要'}
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center">
                <ExternalLink className="w-3.5 h-3.5 text-muted" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">{card.source}</div>
                <div className="flex items-center gap-1 text-xs text-muted">
                  <Clock className="w-3 h-3" />
                  <span>{(card.ai_value_score ?? 0).toFixed(0)} 分价值</span>
                </div>
              </div>
            </div>

            {card.interest_tags && card.interest_tags.length > 0 && (
              <div className="flex items-center gap-1">
                {card.interest_tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 rounded text-xs bg-surface text-muted border border-border"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface">
          <motion.div
            className="h-full rounded-r-full"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${categoryColor}, #BF00FF)`,
              boxShadow: `0 0 10px ${categoryColor}`,
            }}
          />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex items-center justify-around py-4 mt-4 glass-card rounded-xl px-4"
      >
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setLiked(!liked)}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
            liked ? 'text-accent' : 'text-muted hover:text-white'
          }`}
        >
          <Heart className="w-6 h-6" fill={liked ? '#FF006E' : 'none'} />
          <span className="text-xs font-medium">{liked ? '已赞' : '点赞'}</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setBookmarked(!bookmarked)}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
            bookmarked ? 'text-primary' : 'text-muted hover:text-white'
          }`}
        >
          <Bookmark className="w-6 h-6" fill={bookmarked ? '#00FFD1' : 'none'} />
          <span className="text-xs font-medium">{bookmarked ? '已藏' : '收藏'}</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleShareClick}
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-muted hover:text-white transition-colors"
        >
          <Share2 className="w-6 h-6" />
          <span className="text-xs font-medium">分享</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-muted hover:text-secondary transition-colors"
          onClick={handleDrawCard}
        >
          <Sparkles className="w-6 h-6 text-secondary" />
          <span className="text-xs font-medium">抽卡</span>
        </motion.button>
      </motion.div>

      <div className="absolute top-4 right-4 flex flex-col items-center gap-1">
        <div className="w-1 h-12 bg-surface rounded-full overflow-hidden">
          <motion.div
            className="w-full bg-primary rounded-full"
            style={{ height: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-muted">{index + 1}</span>
      </div>

      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-2xl"
            onClick={() => !shareLoading && setShowShareModal(false)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-[90%] max-w-md p-6 glass-card rounded-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => !shareLoading && setShowShareModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-muted hover:text-white hover:bg-surface transition-colors disabled:opacity-50"
                disabled={shareLoading}
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-xl font-bold text-white mb-1">分享资讯</h3>
              <p className="text-sm text-muted mb-5">分享给好友获得奖励积分</p>

              {shareLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : shareError && !shareLink ? (
                <div className="py-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/20 flex items-center justify-center">
                    <Share2 className="w-8 h-8 text-accent" />
                  </div>
                  <p className="text-accent font-medium">{shareError}</p>
                  <a
                    href={card.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface text-sm text-muted hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    直接查看原文
                  </a>
                </div>
              ) : (
                <>
                  <div className="mb-4 p-4 rounded-xl bg-surface/80 border border-border">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-white truncate">{card.title}</h4>
                        <p className="text-xs text-muted mt-1">{card.source}</p>
                      </div>
                    </div>
                  </div>

                  {shareLink && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 px-3 py-2.5 rounded-lg bg-surface border border-border text-sm text-white truncate font-mono">
                          {shareLink}
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleCopy}
                          className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                            copied
                              ? 'bg-primary/20 text-primary border border-primary/40'
                              : 'bg-primary text-background hover:opacity-90'
                          }`}
                        >
                          {copied ? (
                            <span className="flex items-center gap-1.5">
                              <Check className="w-4 h-4" />
                              已复制
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <Copy className="w-4 h-4" />
                              复制
                            </span>
                          )}
                        </motion.button>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>已有 {shareClicks} 次点击</span>
                        <a
                          href={card.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          查看原文
                        </a>
                      </div>
                    </div>
                  )}

                  {shareError && (
                    <p className="mt-3 text-sm text-accent text-center">{shareError}</p>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
