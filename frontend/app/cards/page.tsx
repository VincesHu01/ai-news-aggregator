'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Gift, ShoppingBag, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import Sidebar from '@/components/layout/Sidebar';
import CardCollection from '@/components/card/CardCollection';
import CardBlindBox from '@/components/card/CardBlindBox';
import { getBalance, getCards, drawCard, isAuthenticated } from '@/lib/api';
import type { CardItem, CardSeries, CardCollection as CardCollectionType, PointBalanceResponse } from '@/lib/types';

function mapToCardItem(c: CardCollectionType, idx: number): CardItem {
  return {
    id: c.id,
    name: c.card_name,
    description: `${c.card_series || '未知系列'} · 获得于 ${new Date(c.obtained_at).toLocaleDateString('zh-CN')}`,
    rarity: c.card_rarity as any,
    series: c.card_series || '通用系列',
    imageUrl: c.card_image || undefined,
    obtainedAt: c.obtained_at,
    isNew: idx < 2 && Math.random() > 0.7,
  };
}

export default function CardsPage() {
  const router = useRouter();
  const [blindBoxOpen, setBlindBoxOpen] = useState(false);
  const [balance, setBalance] = useState<PointBalanceResponse | null>(null);
  const [cards, setCards] = useState<CardCollectionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-neon btn-neon-secondary"
                  disabled
                  title="即将开放"
                >
                  <Gift className="w-4 h-4 mr-2" />
                  赠送
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
                  { icon: Gift, label: '赠礼', desc: '赠送好友', disabled: true },
                  { icon: ShoppingBag, label: '商店', desc: '积分商城', disabled: true }
                ].map((action, idx) => (
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
            <CardCollection cards={cardItems} series={series} />
          )}
        </div>
      </main>

      <BottomNav />

      <CardBlindBox
        isOpen={blindBoxOpen}
        onClose={() => setBlindBoxOpen(false)}
        onDraw={handleDrawCard}
      />
    </div>
  );
}
