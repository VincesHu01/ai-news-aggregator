'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Medal, Award, Crown, Sparkles } from 'lucide-react';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import Sidebar from '@/components/layout/Sidebar';
import LevelBadge from '@/components/rewards/LevelBadge';
import { getLeaderboard, isAuthenticated, getStoredUser } from '@/lib/api';
import type { LeaderboardEntry } from '@/lib/types';

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'weekly' | 'daily'>('weekly');
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [myLevel, setMyLevel] = useState(0);

  useEffect(() => {
    fetchLeaderboard();
  }, [activeTab]);

  async function fetchLeaderboard() {
    setLoading(true);
    try {
      const limit = activeTab === 'weekly' ? 50 : 30;
      let entries = await getLeaderboard(limit);
      entries = entries.map((e) => ({
        ...e,
        username: e.nickname || e.username || '匿名用户',
        userId: e.user_id || e.userId || '',
        points: e.score ?? e.points ?? 0,
        experience: e.experience ?? (e.score ?? 0),
        weeklyChange: 0,
      }));
      setData(entries);

      if (isAuthenticated()) {
        const me = getStoredUser();
        if (me) {
          const idx = entries.findIndex((e) => (e.user_id || e.userId) === me.id);
          if (idx >= 0) {
            setMyRank(idx + 1);
            setMyScore(entries[idx].score ?? 0);
            setMyLevel(entries[idx].level);
          } else {
            setMyRank(entries.length + 1);
            setMyScore(me.experience);
            setMyLevel(me.level);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-300" />;
    if (rank === 3) return <Award className="w-6 h-6 text-amber-600" />;
    return null;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return { color: '#FFD700', bg: 'from-yellow-500/20 to-yellow-600/10' };
    if (rank === 2) return { color: '#C0C0C0', bg: 'from-gray-400/20 to-gray-500/10' };
    if (rank === 3) return { color: '#CD7F32', bg: 'from-amber-600/20 to-amber-700/10' };
    return { color: '#8888A0', bg: 'from-surface/50 to-surface/30' };
  };

  const topThree = data.slice(0, 3);
  const rest = data.slice(3);
  const me = isAuthenticated() ? getStoredUser() : null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar />

      <main className="pt-16 lg:pl-64 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Trophy className="w-7 h-7 text-primary" style={{ filter: 'drop-shadow(0 0 10px #00FFD1)' }} />
                排行榜
              </h1>
              <p className="text-muted text-sm mt-1">与全球 AI 爱好者同台竞技</p>
            </div>
          </div>

          <div className="flex gap-2 mb-6">
            {[
              { id: 'weekly', label: '经验榜', icon: TrendingUp },
              { id: 'daily', label: '新秀榜', icon: Sparkles }
            ].map((tab) => (
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTab(tab.id as 'weekly' | 'daily')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-surface text-muted border border-border hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </motion.button>
            ))}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-muted text-sm">加载中...</span>
            </div>
          ) : (
            <>
              {topThree.length === 3 && (
                <div className="grid grid-cols-3 gap-3 mb-8">
                  {[1, 0, 2].map((order) => {
                    const entry = topThree[order];
                    if (!entry) return null;
                    const colors = getRankColor(entry.rank);
                    const name = entry.nickname || entry.username || '匿名用户';

                    return (
                      <motion.div
                        key={`${entry.user_id || entry.userId}-${order}`}
                        initial={{ opacity: 0, y: 30, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: order === 1 ? 0 : order === 0 ? 0.1 : 0.2 }}
                        className={`relative glass-card rounded-2xl p-4 text-center bg-gradient-to-b ${colors.bg}`}
                        style={{
                          borderColor: `${colors.color}40`,
                          order: order === 1 ? 1 : order === 0 ? 0 : 2
                        }}
                      >
                        <div className="flex justify-center mb-2">
                          {getRankIcon(entry.rank)}
                        </div>
                        <div
                          className="w-14 h-14 rounded-xl mx-auto mb-2 flex items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, ${colors.color}40, ${colors.color}20)`,
                            border: `2px solid ${colors.color}60`,
                            boxShadow: entry.rank <= 3 ? `0 0 20px ${colors.color}40` : 'none'
                          }}
                        >
                          <span className="text-xl font-bold" style={{ color: colors.color }}>
                            {name.charAt(0)}
                          </span>
                        </div>
                        <div className="font-bold text-white text-sm truncate">{name}</div>
                        <div className="text-muted text-xs mt-1">{(entry.score ?? entry.points ?? 0).toLocaleString()} XP</div>
                        <div className="flex justify-center mt-1">
                          <LevelBadge level={entry.level} size="sm" showGlow={false} />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider border-b border-border">
                  <div className="col-span-1">排名</div>
                  <div className="col-span-6">用户</div>
                  <div className="col-span-2 text-right">经验</div>
                  <div className="col-span-2 text-right">等级</div>
                  <div className="col-span-1 text-right">变化</div>
                </div>

                {rest.length === 0 ? (
                  <div className="py-10 text-center text-muted text-sm">暂无数据</div>
                ) : (
                  rest.map((entry, idx) => {
                    const colors = getRankColor(entry.rank);
                    const name = entry.nickname || entry.username || '匿名用户';
                    return (
                      <motion.div
                        key={`${entry.user_id || entry.userId}-${idx}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                        className="grid grid-cols-12 gap-4 px-6 py-4 items-center border-b border-border last:border-0 transition-colors"
                      >
                        <div className="col-span-1 flex items-center">
                          <span
                            className="text-lg font-bold"
                            style={{ color: colors.color }}
                          >
                            {entry.rank}
                          </span>
                        </div>
                        <div className="col-span-6 flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              background: `linear-gradient(135deg, ${colors.color}30, ${colors.color}10)`,
                              border: `1px solid ${colors.color}40`
                            }}
                          >
                            <span className="font-bold text-white">{name.charAt(0)}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-white truncate">{name}</div>
                            <div className="text-xs text-muted">{(entry.score ?? entry.points ?? 0).toLocaleString()} XP</div>
                          </div>
                        </div>
                        <div className="col-span-2 text-right">
                          <div className="font-bold text-white">{(entry.score ?? entry.points ?? 0).toLocaleString()}</div>
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <LevelBadge level={entry.level} size="sm" showGlow={false} />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <span className="text-muted text-xs">-</span>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {me && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-6 glass-card rounded-2xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(135deg, #00FFD1, #BF00FF)',
                        boxShadow: '0 0 15px rgba(0,255,209,0.4)'
                      }}
                    >
                      <span className="font-bold text-background">
                        {(me.nickname || me.username || me.email || '我').charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm text-muted">我的排名</div>
                      <div className="font-bold text-white">
                        #{myRank ?? '—'} · {me.nickname || me.username || me.email.split('@')[0]}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted">当前经验</div>
                    <div className="font-bold text-primary">Lv.{myLevel || me.level} · {myScore.toLocaleString() || me.experience.toLocaleString()} XP</div>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
