'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ShoppingBag, AlertCircle, Layers, X, Loader2, Check, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import Sidebar from '@/components/layout/Sidebar';
import CardCollection from '@/components/card/CardCollection';
import CardBlindBox from '@/components/card/CardBlindBox';
import { getBalance, getCards, drawCard, isAuthenticated, synthesizeCards } from '@/lib/api';
import type { CardItem, CardSeries, CardCollection as CardCollectionType, PointBalanceResponse } from '@/lib/types';

function mapToCardItem(c: CardCollectionType, idx: number): CardItem {
  return {
    id: c.id,
    name: c.card_name,
    description: c.description || `${c.card_series || '未知系列'} · 获得于 ${new Date(c.obtained_at).toLocaleDateString('zh-CN')}`,
    rarity: c.card_rarity as any,
    series: c.card_series || '通用系列',
    imageUrl: c.card_image || undefined,
    obtainedAt: c.obtained_at,
    isNew: idx < 2 && Math.random() > 0.7,
    card_type: c.card_type || undefined,
    lore: c.lore || undefined,
    trivia_question: c.trivia_question || undefined,
    trivia_answer: c.trivia_answer || undefined,
    is_synthesized: c.is_synthesized ?? false,
  };
}

const rarityOrder: (keyof typeof raritySynthesisMap)[] = ['N', 'R', 'SR', 'SSR'];
const raritySynthesisMap: Record<string, { color: string; next: string | null }> = {
  N: { color: '#FFFFFF', next: 'R' },
  R: { color: '#00BFFF', next: 'SR' },
  SR: { color: '#FFD700', next: 'SSR' },
  SSR: { color: '#FF00FF', next: null },
};

export default function CardsPage() {
  const router = useRouter();
  const [blindBoxOpen, setBlindBoxOpen] = useState(false);
  const [balance, setBalance] = useState<PointBalanceResponse | null>(null);
  const [cards, setCards] = useState<CardCollectionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Synthesis modal state
  const [synthOpen, setSynthOpen] = useState(false);
  const [synthRarity, setSynthRarity] = useState<string>('N');
  const [synthSelected, setSynthSelected] = useState<string[]>([]);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthError, setSynthError] = useState<string | null>(null);
  const [synthResult, setSynthResult] = useState<CardCollectionType | null>(null);

  const loadData = useCallback(async () => {
    if (!isAuthenticated()) {
      setError('请先登录');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [bal, myCards] = await Promise.all([getBalance(), getCards()]);
      setBalance(bal);
      setCards(myCards);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const cardItems: CardItem[] = cards.map(mapToCardItem);

  const seriesSet = new Map<string, number>();
  cards.forEach((c) => {
    const key = c.card_series || '通用系列';
    seriesSet.set(key, (seriesSet.get(key) || 0) + 1);
  });
  const series: CardSeries[] = Array.from(seriesSet.entries()).map(([name, count], i) => ({
    id: `s${i}`,
    name,
    description: `${name} 主题卡牌`,
    cardCount: Math.max(count, count + Math.floor(Math.random() * 6) + 2),
    completed: false,
  }));

  async function handleDrawCard() {
    if (!isAuthenticated()) {
      router.push('/auth');
      return;
    }
    try {
      const result = await drawCard();
      setCards((prev) => [result.card, ...prev]);
      setBalance((prev) => (prev ? { ...prev, points: result.points_remaining, cards_collected: prev.cards_collected + 1 } : prev));
      // Return the drawn card's rarity via the onComplete callback below
      const rarity = result.card.card_rarity as any;
      return rarity;
    } catch (e: any) {
      const msg = e?.response?.data?.detail || '积分不足或抽卡失败';
      alert(msg);
      throw e;
    }
  }

  function openSynthModal() {
    if (!isAuthenticated()) {
      router.push('/auth');
      return;
    }
    setSynthOpen(true);
    setSynthRarity('N');
    setSynthSelected([]);
    setSynthError(null);
    setSynthResult(null);
  }

  function closeSynthModal() {
    setSynthOpen(false);
    setSynthSelected([]);
    setSynthError(null);
    setSynthResult(null);
  }

  function toggleSynthCard(cardId: string) {
    setSynthSelected((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, cardId];
    });
    setSynthError(null);
  }

  function selectSynthRarity(r: string) {
    setSynthRarity(r);
    setSynthSelected([]);
    setSynthError(null);
  }

  const synthCardsOfRarity = cards.filter((c) => (c.card_rarity || '').toUpperCase() === synthRarity);
  const synthNextRarity = raritySynthesisMap[synthRarity]?.next ?? null;
  const canSynth = synthSelected.length === 3 && !!synthNextRarity;

  async function handleSynthesize() {
    if (!canSynth) return;
    setSynthesizing(true);
    setSynthError(null);
    setSynthResult(null);
    try {
      const result = await synthesizeCards(synthSelected);
      setSynthResult(result.new_card);
      // Refresh the card list & balance
      await loadData();
    } catch (e: any) {
      setSynthError(e?.response?.data?.detail || e?.message || '合成失败');
    } finally {
      setSynthesizing(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar />

      <main className="pt-16 lg:pl-64 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-2xl p-6 lg:col-span-1"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">我的积分</h2>
                  <p className="text-muted text-sm">用于抽取盲盒卡牌</p>
                </div>
                <div
                  className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center"
                  style={{ boxShadow: '0 0 20px rgba(0,255,209,0.4)' }}
                >
                  <Sparkles className="w-6 h-6 text-background" />
                </div>
              </div>
              {loading ? (
                <div className="h-10 bg-surface animate-pulse rounded-lg mb-4" />
              ) : error ? (
                <div className="text-accent text-sm flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                  {!isAuthenticated() && (
                    <button onClick={() => router.push('/auth')} className="ml-2 underline text-primary">
                      去登录
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="text-4xl font-bold gradient-text-primary">{(balance?.points ?? 0).toLocaleString()}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-surface/50 rounded-lg p-2">
                      <div className="text-muted">等级</div>
                      <div className="text-white font-bold">Lv.{balance?.level ?? 0}</div>
                    </div>
                    <div className="bg-surface/50 rounded-lg p-2">
                      <div className="text-muted">已收集</div>
                      <div className="text-white font-bold">{balance?.cards_collected ?? 0} 张</div>
                    </div>
                  </div>
                </>
              )}
              <div className="mt-4 flex gap-2">
                <motion.button
                  whileHover={{ scale: isAuthenticated() ? 1.02 : 1 }}
                  whileTap={{ scale: isAuthenticated() ? 0.98 : 1 }}
                  onClick={() => (isAuthenticated() ? setBlindBoxOpen(true) : router.push('/auth'))}
                  className="btn-neon btn-neon-primary flex-1"
                  disabled={loading || !balance}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {isAuthenticated() ? '开启盲盒' : '登录'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: isAuthenticated() ? 1.02 : 1 }}
                  whileTap={{ scale: isAuthenticated() ? 0.98 : 1 }}
                  onClick={() => (isAuthenticated() ? openSynthModal() : router.push('/auth'))}
                  className="btn-neon btn-neon-secondary flex-1"
                  disabled={loading}
                >
                  <Layers className="w-4 h-4 mr-2" />
                  卡牌合成
                </motion.button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card rounded-2xl p-6 lg:col-span-2"
            >
              <h2 className="text-xl font-bold text-white mb-4">快速操作</h2>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { icon: Sparkles, label: '抽卡', desc: '盲盒抽取', onClick: () => isAuthenticated() ? setBlindBoxOpen(true) : router.push('/auth'), disabled: false },
                  { icon: Layers, label: '合成', desc: '卡牌合成', onClick: () => isAuthenticated() ? openSynthModal() : router.push('/auth'), disabled: false },
                  { icon: ShoppingBag, label: '商店', desc: '积分商城', disabled: true }
                ].map((action) => (
                  <motion.button
                    key={action.label}
                    whileHover={{ scale: !action.disabled ? 1.03 : 1, y: !action.disabled ? -2 : 0 }}
                    whileTap={{ scale: !action.disabled ? 0.97 : 1 }}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-surface/50 border border-border hover:border-primary/30 transition-all ${action.disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      <action.icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-semibold text-sm text-white">{action.label}</span>
                    <span className="text-xs text-muted">
                      {action.disabled ? '即将开放' : action.desc}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-muted text-sm">加载卡牌中...</span>
            </div>
          ) : (
            <CardCollection cards={cardItems} series={series} onCardChanged={loadData} />
          )}
        </div>
      </main>

      <BottomNav />

      <CardBlindBox
        isOpen={blindBoxOpen}
        onClose={() => setBlindBoxOpen(false)}
        onDraw={handleDrawCard}
      />

      {/* Synthesis Modal */}
      <AnimatePresence>
        {synthOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeSynthModal}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-secondary" />
                  <h3 className="text-lg font-bold text-white">卡牌合成</h3>
                </div>
                <button onClick={closeSynthModal} className="text-muted hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-muted mb-4">
                选择 3 张相同稀有度的卡牌，合成 1 张更高稀有度的卡牌。N→R, R→SR, SR→SSR。
              </p>

              {/* Rarity tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hidden mb-4">
                {rarityOrder.map((r) => {
                  const cfg = raritySynthesisMap[r];
                  const count = cards.filter((c) => (c.card_rarity || '').toUpperCase() === r).length;
                  const selectable = cfg.next !== null;
                  return (
                    <motion.button
                      key={r}
                      whileHover={{ scale: selectable ? 1.03 : 1 }}
                      whileTap={{ scale: selectable ? 0.97 : 1 }}
                      onClick={() => selectable && selectSynthRarity(r)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap border ${
                        synthRarity === r
                          ? 'bg-secondary/20 text-secondary border-secondary/40'
                          : selectable
                          ? 'bg-surface text-muted border-border hover:text-white'
                          : 'bg-surface/40 text-muted/50 border-border/50 cursor-not-allowed'
                      }`}
                    >
                      {r} ({count}){!selectable ? ' · 不可合成' : ''}
                    </motion.button>
                  );
                })}
              </div>

              {/* Preview */}
              <div className="flex items-center justify-center gap-3 mb-4 p-3 rounded-lg bg-surface/60 border border-border">
                <span className="text-sm text-muted">合成结果预览:</span>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-bold"
                    style={{ backgroundColor: raritySynthesisMap[synthRarity].color, color: '#0A0A0F' }}
                  >
                    {synthRarity}
                  </span>
                  <span className="text-muted">×3 →</span>
                  {synthNextRarity ? (
                    <span
                      className="px-2 py-0.5 rounded text-xs font-bold"
                      style={{ backgroundColor: raritySynthesisMap[synthNextRarity].color, color: '#0A0A0F' }}
                    >
                      {synthNextRarity}
                    </span>
                  ) : (
                    <span className="text-accent text-xs font-bold">无法继续合成</span>
                  )}
                </div>
                <span className="text-xs text-muted ml-2">
                  已选 {synthSelected.length}/3
                </span>
              </div>

              {synthError && (
                <div className="mb-4 flex items-center gap-2 text-accent text-sm p-3 rounded-lg bg-accent/10 border border-accent/30">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{synthError}</span>
                </div>
              )}

              {/* Card selection grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4 max-h-80 overflow-y-auto scrollbar-hidden">
                {synthCardsOfRarity.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-8 text-muted gap-2">
                    <Layers className="w-8 h-8" />
                    <span className="text-sm">没有 {synthRarity} 稀有度的卡牌可合成</span>
                  </div>
                ) : (
                  synthCardsOfRarity.map((c) => {
                    const selected = synthSelected.includes(c.id);
                    const cfg = raritySynthesisMap[synthRarity];
                    return (
                      <motion.button
                        key={c.id}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => toggleSynthCard(c.id)}
                        className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all ${
                          selected ? 'border-secondary' : 'border-border'
                        }`}
                        style={{
                          background: 'linear-gradient(145deg, #1A1A24 0%, #252530 100%)',
                          boxShadow: selected ? `0 0 15px ${cfg.color}80` : 'none'
                        }}
                      >
                        {selected && (
                          <div className="absolute top-1 right-1 z-10 w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                            <Check className="w-3 h-3 text-background" />
                          </div>
                        )}
                        <div className="absolute top-0 right-0 px-1.5 py-0.5 rounded-bl text-[10px] font-bold" style={{ backgroundColor: cfg.color, color: '#0A0A0F' }}>
                          {synthRarity}
                        </div>
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
                          <Sparkles className="w-6 h-6 mb-1" style={{ color: cfg.color }} />
                          <div className="text-xs font-bold text-white leading-tight line-clamp-2">
                            {c.card_name}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })
                )}
              </div>

              {/* Synthesize button */}
              <motion.button
                whileHover={{ scale: canSynth && !synthesizing ? 1.02 : 1 }}
                whileTap={{ scale: canSynth && !synthesizing ? 0.98 : 1 }}
                onClick={handleSynthesize}
                disabled={!canSynth || synthesizing}
                className={`btn-neon btn-neon-primary w-full ${
                  !canSynth || synthesizing ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                {synthesizing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    合成中...
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4 mr-2" />
                    合成 ({synthSelected.length}/3)
                  </>
                )}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Synthesis Result Modal */}
      <AnimatePresence>
        {synthResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
            onClick={closeSynthModal}
          >
            <motion.div
              initial={{ scale: 0.5, rotateY: -180 }}
              animate={{ scale: 1, rotateY: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-2xl p-8 max-w-sm w-full text-center"
              style={{
                borderColor: raritySynthesisMap[(synthResult.card_rarity || 'N').toUpperCase()]?.color || '#FFFFFF',
                boxShadow: `0 0 40px ${raritySynthesisMap[(synthResult.card_rarity || 'N').toUpperCase()]?.color || '#FFFFFF'}60`
              }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1, rotate: [0, -10, 10, -5, 5, 0] }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${raritySynthesisMap[(synthResult.card_rarity || 'N').toUpperCase()]?.color || '#FFFFFF'}40, ${raritySynthesisMap[(synthResult.card_rarity || 'N').toUpperCase()]?.color || '#FFFFFF'}10)`,
                  border: `2px solid ${raritySynthesisMap[(synthResult.card_rarity || 'N').toUpperCase()]?.color || '#FFFFFF'}`
                }}
              >
                <Star className="w-10 h-10" style={{ color: raritySynthesisMap[(synthResult.card_rarity || 'N').toUpperCase()]?.color || '#FFFFFF' }} />
              </motion.div>
              <h3 className="text-2xl font-bold gradient-text-primary mb-2">合成成功!</h3>
              <div className="text-sm text-muted mb-1">获得新卡牌</div>
              <div className="text-lg font-bold text-white mb-2">{synthResult.card_name}</div>
              <span
                className="inline-block px-3 py-1 rounded text-sm font-bold mb-4"
                style={{
                  backgroundColor: raritySynthesisMap[(synthResult.card_rarity || 'N').toUpperCase()]?.color || '#FFFFFF',
                  color: '#0A0A0F'
                }}
              >
                {synthResult.card_rarity}
              </span>
              {synthResult.description && (
                <p className="text-sm text-muted mb-4 leading-relaxed">{synthResult.description}</p>
              )}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={closeSynthModal}
                className="btn-neon btn-neon-primary w-full"
              >
                <Check className="w-4 h-4 mr-2" />
                确定
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
