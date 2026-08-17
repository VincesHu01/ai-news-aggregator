'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Star, Sparkles, Lock, Share2, Gift, Copy, Check, Users, X, Loader2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import type { CardItem, CardSeries } from '@/lib/types';
import { generateShareLink, listFriends, giftCard } from '@/lib/api';
import type { Friend } from '@/lib/api';

const rarityConfig: Record<string, { color: string; label: string; glow: string }> = {
  SSR: { color: '#FF00FF', label: 'SSR', glow: 'rainbow' },
  SR: { color: '#FFD700', label: 'SR', glow: 'gold' },
  R: { color: '#00BFFF', label: 'R', glow: 'blue' },
  N: { color: '#FFFFFF', label: 'N', glow: 'white' }
};

const cardTypeConfig: Record<string, { label: string; color: string }> = {
  figure: { label: '人物', color: '#00FFD1' },
  tech: { label: '技术', color: '#00BFFF' },
  company: { label: 'AI公司', color: '#FFD700' },
  ethics: { label: 'AI伦理', color: '#FF006E' },
  event: { label: '里程碑', color: '#BF00FF' }
};

const rarityOrder: Record<string, number> = { N: 0, R: 1, SR: 2, SSR: 3 };

function rarityRank(rarity: string): number {
  return rarityOrder[rarity] ?? 0;
}

interface CardCollectionProps {
  cards: CardItem[];
  series: CardSeries[];
  onSeriesFilter?: (seriesId: string | null) => void;
  onCardChanged?: () => void;
}

export default function CardCollection({ cards, series, onSeriesFilter, onCardChanged }: CardCollectionProps) {
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);
  const [activeSeries, setActiveSeries] = useState<string | null>(null);

  // Share modal state
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Gift modal state
  const [giftOpen, setGiftOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [gifting, setGifting] = useState(false);
  const [giftResult, setGiftResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Trivia reveal state
  const [showTriviaAnswer, setShowTriviaAnswer] = useState(false);

  const filteredCards = activeSeries
    ? cards.filter((c) => c.series === activeSeries)
    : cards;

  function openShareModal(card: CardItem) {
    setShareOpen(true);
    setShareUrl(null);
    setShareError(null);
    setCopied(false);
    setShareLoading(true);
    generateShareLink('card', card.id)
      .then((res) => {
        setShareUrl(res.share_url || res.token);
      })
      .catch((e: any) => {
        setShareError(e?.response?.data?.detail || e?.message || '生成分享链接失败');
      })
      .finally(() => setShareLoading(false));
  }

  function closeShareModal() {
    setShareOpen(false);
    setShareUrl(null);
    setShareError(null);
    setCopied(false);
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text via prompt
      window.prompt('复制分享链接:', shareUrl);
    }
  }

  function openGiftModal() {
    setGiftOpen(true);
    setFriends([]);
    setFriendsError(null);
    setSelectedFriendId(null);
    setGiftResult(null);
    setFriendsLoading(true);
    listFriends()
      .then((list) => setFriends(list || []))
      .catch((e: any) => {
        setFriendsError(e?.response?.data?.detail || e?.message || '获取好友列表失败');
      })
      .finally(() => setFriendsLoading(false));
  }

  function closeGiftModal() {
    setGiftOpen(false);
    setFriends([]);
    setFriendsError(null);
    setSelectedFriendId(null);
    setGiftResult(null);
  }

  async function confirmGift(card: CardItem) {
    if (!selectedFriendId) return;
    setGifting(true);
    setGiftResult(null);
    try {
      await giftCard(card.id, selectedFriendId);
      setGiftResult({ ok: true, message: '卡牌赠送成功!' });
      onCardChanged?.();
      setTimeout(() => {
        closeGiftModal();
        setSelectedCard(null);
      }, 1500);
    } catch (e: any) {
      setGiftResult({
        ok: false,
        message: e?.response?.data?.detail || e?.message || '赠送失败',
      });
    } finally {
      setGifting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">卡牌收藏</h2>
          <p className="text-muted text-sm mt-1">
            共 {cards.length} 张卡牌 · {series.filter((s) => s.completed).length}/{series.length} 系列完成
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="btn-neon btn-neon-secondary"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          抽取新卡
        </motion.button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hidden">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setActiveSeries(null);
            onSeriesFilter?.(null);
          }}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
            activeSeries === null
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'bg-surface text-muted border border-border hover:text-white'
          }`}
        >
          全部
        </motion.button>
        {series.map((s) => (
          <motion.button
            key={s.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setActiveSeries(s.id);
              onSeriesFilter?.(s.id);
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              activeSeries === s.id
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-surface text-muted border border-border hover:text-white'
            }`}
          >
            {s.name}
            {s.completed && <Star className="w-3 h-3 inline ml-1 text-accent" />}
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredCards.map((card, index) => {
          const config = rarityConfig[card.rarity] || rarityConfig.N;
          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, scale: 0.8, rotateY: -30 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              transition={{ delay: index * 0.05, type: 'spring', stiffness: 200 }}
              whileHover={{ scale: 1.05, y: -5 }}
              onClick={() => {
                setSelectedCard(card);
                setShowTriviaAnswer(false);
              }}
              className="relative cursor-pointer group"
            >
              <div
                className={`aspect-[3/4] rounded-xl overflow-hidden relative ${
                  card.isNew ? 'animate-neon-glow' : ''
                }`}
                style={{
                  background: `linear-gradient(145deg, #1A1A24 0%, #252530 100%)`,
                  border: `2px solid ${config.color}`,
                  boxShadow: `0 0 15px ${config.color}40, inset 0 0 15px ${config.color}10`
                }}
              >
                <div
                  className="absolute top-0 right-0 px-2 py-1 rounded-bl-lg text-xs font-bold"
                  style={{ backgroundColor: config.color, color: '#0A0A0F' }}
                >
                  {config.label}
                </div>

                {card.is_synthesized && (
                  <div className="absolute top-0 left-0 px-2 py-1 rounded-br-lg text-[10px] font-bold bg-secondary/80 text-white">
                    合成
                  </div>
                )}

                {card.rarity === 'SSR' && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'conic-gradient(from 0deg, #FF00FF, #00FFFF, #FFFF00, #FF00FF)',
                      opacity: 0.2
                    }}
                  />
                )}

                <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                  <div
                    className="w-16 h-16 rounded-full mb-3 flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${config.color}40, ${config.color}20)`,
                      border: `1px solid ${config.color}60`
                    }}
                  >
                    <Sparkles className="w-8 h-8" style={{ color: config.color }} />
                  </div>
                  <h3 className="text-sm font-bold text-white leading-tight mb-1 line-clamp-2">
                    {card.name}
                  </h3>
                  <p className="text-xs text-muted line-clamp-2">{card.description}</p>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">{card.series}</span>
                    <span className="text-muted">
                      {new Date(card.obtainedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {Array.from({ length: Math.max(0, 20 - filteredCards.length) }).map((_, i) => (
          <motion.div
            key={`empty-${i}`}
            whileHover={{ scale: 1.02 }}
            className="aspect-[3/4] rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-muted hover:text-white transition-colors cursor-pointer"
          >
            <Lock className="w-8 h-8 mb-2" />
            <span className="text-xs">未解锁</span>
          </motion.div>
        ))}
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedCard(null)}
        >
          <motion.div
            initial={{ scale: 0.5, rotateY: -180 }}
            animate={{ scale: 1, rotateY: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto scrollbar-hidden"
            style={{
              borderColor: rarityConfig[selectedCard.rarity].color,
              boxShadow: `0 0 30px ${rarityConfig[selectedCard.rarity].color}60`
            }}
          >
            <div className="flex flex-col items-center text-center">
              <div
                className="w-28 h-28 rounded-2xl mb-4 flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${rarityConfig[selectedCard.rarity].color}40, ${rarityConfig[selectedCard.rarity].color}10)`,
                  border: `2px solid ${rarityConfig[selectedCard.rarity].color}`
                }}
              >
                <Sparkles
                  className="w-14 h-14"
                  style={{ color: rarityConfig[selectedCard.rarity].color }}
                />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{selectedCard.name}</h3>

              <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
                <span
                  className="px-2 py-0.5 rounded text-xs font-bold"
                  style={{
                    backgroundColor: rarityConfig[selectedCard.rarity].color,
                    color: '#0A0A0F'
                  }}
                >
                  {rarityConfig[selectedCard.rarity].label}
                </span>
                <span className="text-sm text-muted">{selectedCard.series}</span>
                {selectedCard.card_type && cardTypeConfig[selectedCard.card_type] && (
                  <span
                    className="px-2 py-0.5 rounded text-xs font-semibold border"
                    style={{
                      color: cardTypeConfig[selectedCard.card_type].color,
                      borderColor: `${cardTypeConfig[selectedCard.card_type].color}60`,
                      backgroundColor: `${cardTypeConfig[selectedCard.card_type].color}15`
                    }}
                  >
                    {cardTypeConfig[selectedCard.card_type].label}
                  </span>
                )}
                {selectedCard.is_synthesized && (
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-secondary/30 text-secondary border border-secondary/40">
                    合成获得
                  </span>
                )}
              </div>

              {selectedCard.description && (
                <p className="text-muted text-sm mb-4 text-left w-full leading-relaxed">
                  {selectedCard.description}
                </p>
              )}

              {selectedCard.lore && rarityRank(selectedCard.rarity) >= 1 && (
                <div className="w-full mb-4 p-3 rounded-lg bg-surface/60 border border-border text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-secondary" />
                    <span className="text-sm font-semibold text-secondary">背景故事</span>
                  </div>
                  <p className="text-sm text-white/90 leading-relaxed whitespace-pre-line">
                    {selectedCard.lore}
                  </p>
                </div>
              )}

              {selectedCard.trivia_question && rarityRank(selectedCard.rarity) >= 2 && (
                <div className="w-full mb-4 p-3 rounded-lg bg-surface/60 border border-border text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-4 h-4 text-accent" />
                    <span className="text-sm font-semibold text-accent">趣味问答</span>
                  </div>
                  <p className="text-sm text-white/90 mb-2">{selectedCard.trivia_question}</p>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowTriviaAnswer((v) => !v)}
                    className="text-xs text-primary underline"
                  >
                    {showTriviaAnswer ? '隐藏答案' : '显示答案'}
                  </motion.button>
                  <AnimatePresence>
                    {showTriviaAnswer && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-sm text-primary/90 mt-2 p-2 rounded bg-primary/10 border border-primary/20"
                      >
                        {selectedCard.trivia_answer}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="flex items-center gap-4 text-sm text-muted mb-2">
                <span>获得时间</span>
                <span>{new Date(selectedCard.obtainedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex gap-3 mt-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => openShareModal(selectedCard)}
                  className="btn-neon btn-neon-secondary"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  分享
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => openGiftModal()}
                  className="btn-neon btn-neon-accent"
                >
                  <Gift className="w-4 h-4 mr-2" />
                  赠送好友
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Share Modal */}
      <AnimatePresence>
        {shareOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeShareModal}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-2xl p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold text-white">分享卡牌</h3>
                </div>
                <button onClick={closeShareModal} className="text-muted hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {shareLoading && (
                <div className="flex items-center justify-center py-8 text-muted">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  生成分享链接中...
                </div>
              )}

              {shareError && !shareLoading && (
                <div className="flex items-center gap-2 text-accent text-sm p-3 rounded-lg bg-accent/10 border border-accent/30">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{shareError}</span>
                </div>
              )}

              {shareUrl && !shareLoading && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-surface/60 border border-border">
                    <input
                      readOnly
                      value={shareUrl}
                      className="flex-1 bg-transparent text-sm text-white outline-none truncate"
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={copyShareUrl}
                      className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1 ${
                        copied
                          ? 'bg-primary/20 text-primary border border-primary/30'
                          : 'bg-primary text-background'
                      }`}
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? '已复制' : '复制'}
                    </motion.button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => window.open(shareUrl, '_blank', 'noopener,noreferrer')}
                      className="flex items-center justify-center gap-2 py-3 rounded-lg bg-green-600/20 text-green-400 border border-green-600/40 hover:bg-green-600/30 transition-all"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8.5 13.5a1 1 0 100-2 1 1 0 000 2zm6 0a1 1 0 100-2 1 1 0 000 2z" />
                        <path d="M9 4C4.58 4 1 7.58 1 12c0 1.66.45 3.21 1.23 4.55L1 20l3.7-1.23A7.93 7.93 0 009 20c4.42 0 8-3.58 8-8s-3.58-8-8-8z" />
                      </svg>
                      <span className="text-sm font-semibold">微信分享</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() =>
                        window.open(
                          `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(
                            shareUrl
                          )}&title=${encodeURIComponent('分享一张AI卡牌')}`,
                          '_blank',
                          'noopener,noreferrer'
                        )
                      }
                      className="flex items-center justify-center gap-2 py-3 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-600/40 hover:bg-blue-600/30 transition-all"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5.5 7.5c0 .3-.05.6-.14.88a4.67 4.67 0 01-1.12 1.8c-.55.55-1.13.95-1.8 1.12-.28.09-.58.14-.88.14H9.36c-.3 0-.6-.05-.88-.14a4.67 4.67 0 01-1.8-1.12 4.67 4.67 0 01-1.12-1.8c-.09-.28-.14-.58-.14-.88 0-.3.05-.6.14-.88a4.67 4.67 0 011.12-1.8c.55-.55 1.13-.95 1.8-1.12.28-.09.58-.14.88-.14h5.36c.3 0 .6.05.88.14a4.67 4.67 0 011.8 1.12 4.67 4.67 0 011.12 1.8c.09.28.14.58.14.88z" />
                      </svg>
                      <span className="text-sm font-semibold">QQ分享</span>
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gift Modal */}
      <AnimatePresence>
        {giftOpen && selectedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeGiftModal}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto scrollbar-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-accent" />
                  <h3 className="text-lg font-bold text-white">赠送卡牌</h3>
                </div>
                <button onClick={closeGiftModal} className="text-muted hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 p-3 rounded-lg bg-surface/60 border border-border flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${rarityConfig[selectedCard.rarity].color}40, ${rarityConfig[selectedCard.rarity].color}10)`,
                    border: `1px solid ${rarityConfig[selectedCard.rarity].color}`
                  }}
                >
                  <Sparkles
                    className="w-5 h-5"
                    style={{ color: rarityConfig[selectedCard.rarity].color }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white truncate">{selectedCard.name}</div>
                  <div className="text-xs text-muted">{rarityConfig[selectedCard.rarity].label} · {selectedCard.series}</div>
                </div>
              </div>

              {giftResult && (
                <div
                  className={`mb-4 flex items-center gap-2 text-sm p-3 rounded-lg border ${
                    giftResult.ok
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'bg-accent/10 text-accent border-accent/30'
                  }`}
                >
                  {giftResult.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{giftResult.message}</span>
                </div>
              )}

              {friendsLoading && (
                <div className="flex items-center justify-center py-8 text-muted">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  加载好友列表...
                </div>
              )}

              {friendsError && !friendsLoading && (
                <div className="flex items-center gap-2 text-accent text-sm p-3 rounded-lg bg-accent/10 border border-accent/30">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{friendsError}</span>
                </div>
              )}

              {!friendsLoading && !friendsError && friends.length === 0 && !giftResult && (
                <div className="flex flex-col items-center justify-center py-8 text-muted gap-2">
                  <Users className="w-8 h-8" />
                  <span className="text-sm">暂无好友，快去添加好友吧</span>
                </div>
              )}

              {!friendsLoading && !friendsError && friends.length > 0 && !giftResult && (
                <>
                  <div className="mb-2 flex items-center gap-2 text-sm text-muted">
                    <Users className="w-4 h-4" />
                    <span>选择赠送对象 ({friends.length})</span>
                  </div>
                  <div className="space-y-2 mb-4 max-h-60 overflow-y-auto scrollbar-hidden">
                    {friends.map((f) => (
                      <motion.button
                        key={f.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setSelectedFriendId(f.id)}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-all ${
                          selectedFriendId === f.id
                            ? 'bg-primary/10 border-primary/40'
                            : 'bg-surface/40 border-border hover:border-primary/20'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {(f.nickname || f.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <div className="text-sm font-semibold text-white truncate">
                            {f.nickname || f.email}
                          </div>
                          <div className="text-xs text-muted">Lv.{f.level ?? 0}</div>
                        </div>
                        {selectedFriendId === f.id && (
                          <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        )}
                      </motion.button>
                    ))}
                  </div>
                  <motion.button
                    whileHover={{ scale: selectedFriendId ? 1.02 : 1 }}
                    whileTap={{ scale: selectedFriendId ? 0.98 : 1 }}
                    onClick={() => confirmGift(selectedCard)}
                    disabled={!selectedFriendId || gifting}
                    className={`btn-neon btn-neon-accent w-full ${
                      !selectedFriendId || gifting ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  >
                    {gifting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        赠送中...
                      </>
                    ) : (
                      <>
                        <Gift className="w-4 h-4 mr-2" />
                        确认赠送
                      </>
                    )}
                  </motion.button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
