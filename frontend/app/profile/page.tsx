'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Trophy,
  Star,
  Flame,
  Sparkles,
  Share2,
  Gift,
  Users,
  Zap,
  Edit3,
  Settings,
  ChevronRight,
  Calendar,
  Award,
  AlertCircle,
  LogOut
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import Sidebar from '@/components/layout/Sidebar';
import LevelBadge from '@/components/rewards/LevelBadge';
import CheckIn from '@/components/rewards/CheckIn';
import {
  getBalance,
  checkin,
  isAuthenticated,
  getStoredUser,
  logout as apiLogout,
} from '@/lib/api';
import type { User as UserType, PointBalanceResponse } from '@/lib/types';

function levelTier(level: number): { name: string; color: string; desc: string } {
  if (level >= 50) return { name: 'AI 之神', color: '#FF006E', desc: '传说级段位，凤毛麟角' };
  if (level >= 40) return { name: '宗师', color: '#FF006E', desc: 'AI 领域宗师级人物' };
  if (level >= 30) return { name: '大师', color: '#BF00FF', desc: '精通 AI 之道的大师' };
  if (level >= 20) return { name: '专家', color: '#BF00FF', desc: '在 AI 领域颇有建树' };
  if (level >= 15) return { name: '资深研究员', color: '#00FFD1', desc: '持续深耕，成果斐然' };
  if (level >= 10) return { name: '研究员', color: '#00FFD1', desc: '对 AI 有系统认知' };
  if (level >= 5) return { name: '探索者', color: '#00BFFF', desc: '在 AI 世界中探索前行' };
  return { name: '入门新手', color: '#00BFFF', desc: '刚刚踏入 AI 领域' };
}

export default function ProfilePage() {
  const router = useRouter();
  const [balance, setBalance] = useState<PointBalanceResponse | null>(null);
  const [user, setUser] = useState<UserType | null>(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streakDays, setStreakDays] = useState(0);
  const [lastCheckInDay, setLastCheckInDay] = useState<string | undefined>(undefined);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const loadData = useCallback(async () => {
    if (!isAuthenticated()) {
      router.push('/auth');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const u = getStoredUser();
      setUser(u);
      const bal = await getBalance();
      setBalance(bal);
      setStreakDays(bal.total_checkins > 0 ? Math.min(bal.total_checkins, 7) : 0);
      // Approximate last checkin by checking if today has a checkin — we use the stored streak heuristic
      setLastCheckInDay(undefined);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCheckIn = async () => {
    if (isCheckingIn) return;
    setIsCheckingIn(true);
    try {
      const result = await checkin();
      setStreakDays(result.streak_days);
      setLastCheckInDay(result.checkin_date);
      // Refresh balance
      const bal = await getBalance();
      setBalance(bal);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || '签到失败';
      alert(msg);
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleLogout = () => {
    if (confirm('确认退出登录？')) {
      apiLogout();
      router.push('/auth');
    }
  };

  const tier = user ? levelTier(user.level) : levelTier(balance?.level ?? 0);
  const displayLevel = balance?.level ?? user?.level ?? 0;
  const displayExp = balance?.experience ?? user?.experience ?? 0;
  const displayNext = balance?.next_level_experience ?? user?.experienceToNext ?? 5000;
  const progress = Math.min(100, (displayExp / Math.max(1, displayNext)) * 100);

  const stats = [
    { label: '积分', value: balance?.points ?? user?.points ?? 0, icon: Sparkles, color: '#00FFD1' },
    { label: '经验', value: displayExp, icon: Zap, color: '#BF00FF' },
    { label: '智力', value: balance?.intelligence ?? user?.intelligence ?? 0, icon: Star, color: '#FF006E' },
    { label: '卡牌', value: balance?.cards_collected ?? user?.collectionsCount ?? 0, icon: Award, color: '#FFD93D' }
  ];

  const menuItems = [
    { icon: Gift, label: '我的收藏', desc: '查看收藏的资讯' },
    { icon: Share2, label: '分享统计', desc: '分享数据概览' },
    { icon: Users, label: `邀请好友 邀请码: ${user?.invite_code || '—'}`, desc: '邀请好友获取奖励' },
    { icon: Calendar, label: '签到记录', desc: `累计签到 ${balance?.total_checkins ?? 0} 天` },
    { icon: Settings, label: '账号设置', desc: '账号与隐私设置' },
    { icon: LogOut, label: '退出登录', desc: '安全退出当前账号', danger: true, onClick: handleLogout },
  ];

  const nickname = user?.nickname || user?.username || (user?.email ? user.email.split('@')[0] : 'AI探索者');
  const email = user?.email || '';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar />

      <main className="pt-16 lg:pl-64 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-muted text-sm">加载中...</span>
            </div>
          ) : error && !balance ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <AlertCircle className="w-10 h-10 text-accent mx-auto mb-3" />
              <div className="text-accent font-bold mb-2">{error}</div>
              <button onClick={loadData} className="btn-neon btn-neon-primary mt-2">重试</button>
            </div>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-2xl p-6 mb-6 relative overflow-hidden"
              >
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    background: `linear-gradient(135deg, ${tier.color}33 0%, #BF00FF33 50%, #FF006E33 100%)`
                  }}
                />
                <div className="relative flex flex-col sm:flex-row items-center gap-6">
                  <motion.div whileHover={{ scale: 1.05 }} className="relative">
                    <div
                      className="w-24 h-24 rounded-2xl flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${tier.color} 0%, #BF00FF 100%)`,
                        boxShadow: `0 0 30px ${tier.color}66, 0 0 60px rgba(191,0,255,0.3)`
                      }}
                    >
                      <User className="w-12 h-12 text-background" />
                    </div>
                    <motion.div
                      animate={{ boxShadow: [`0 0 10px ${tier.color}`, `0 0 20px ${tier.color}`, `0 0 10px ${tier.color}`] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute -bottom-1 -right-1"
                    >
                      <LevelBadge level={displayLevel} size="sm" />
                    </motion.div>
                  </motion.div>

                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-3 mb-2 flex-wrap">
                      <h2 className="text-2xl font-bold text-white">{nickname}</h2>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="p-1.5 rounded-lg bg-surface/50 text-muted hover:text-white transition-colors"
                        title="编辑资料（即将开放）"
                        disabled
                      >
                        <Edit3 className="w-4 h-4" />
                      </motion.button>
                      <span
                        className="px-3 py-1 rounded-full text-xs font-bold border"
                        style={{
                          color: tier.color,
                          borderColor: `${tier.color}60`,
                          backgroundColor: `${tier.color}15`,
                          boxShadow: `0 0 12px ${tier.color}30`
                        }}
                      >
                        {tier.name}
                      </span>
                    </div>
                    <p className="text-muted text-sm mb-1">{email}</p>
                    <p className="text-xs" style={{ color: `${tier.color}CC` }}>{tier.desc}</p>
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-sm mt-2">
                      <span className="px-3 py-1 rounded-full bg-primary/20 text-primary border border-primary/30">
                        Lv.{displayLevel}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-accent/20 text-accent border border-accent/30 flex items-center gap-1">
                        <Flame className="w-3 h-3" />
                        连续 {streakDays} 天
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowCheckIn(!showCheckIn)}
                      className="btn-neon btn-neon-primary"
                      disabled={isCheckingIn}
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      {showCheckIn ? '收起' : isCheckingIn ? '签到中' : '签到'}
                    </motion.button>
                    <span className="text-xs text-muted">累计签到 {balance?.total_checkins ?? 0} 天</span>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted">Lv.{displayLevel} → Lv.{displayLevel + 1} 升级进度</span>
                    <span className="text-primary font-medium">
                      {displayExp.toLocaleString()} / {displayNext.toLocaleString()} XP
                    </span>
                  </div>
                  <div className="h-2 bg-surface rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${tier.color}, #BF00FF)`,
                        boxShadow: `0 0 10px ${tier.color}80`
                      }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-muted text-right">
                    还差 {(Math.max(0, displayNext - displayExp)).toLocaleString()} XP 升级
                  </div>
                </div>
              </motion.div>

              {showCheckIn && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 overflow-hidden"
                >
                  <CheckIn
                    currentStreak={streakDays || 0}
                    lastCheckIn={lastCheckInDay}
                    onCheckIn={handleCheckIn}
                  />
                </motion.div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {stats.map((stat, idx) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                    className="glass-card rounded-xl p-4 text-center cursor-pointer"
                  >
                    <div
                      className="w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center"
                      style={{
                        background: `${stat.color}20`,
                        border: `1px solid ${stat.color}40`
                      }}
                    >
                      <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                    </div>
                    <div className="text-xl font-bold text-white">{(stat.value || 0).toLocaleString()}</div>
                    <div className="text-xs text-muted">{stat.label}</div>
                  </motion.div>
                ))}
              </div>

              <div className="glass-card rounded-2xl p-6 mb-6">
                <h3 className="text-lg font-bold text-white mb-4">成就徽章</h3>
                <div className="flex flex-wrap gap-3">
                  {[
                    { icon: Trophy, label: '新手', unlocked: displayLevel >= 1, color: '#00FFD1' },
                    { icon: Flame, label: '3连签', unlocked: (balance?.total_checkins ?? 0) >= 3, color: '#FF6B35' },
                    { icon: Sparkles, label: '首卡', unlocked: (balance?.cards_collected ?? 0) >= 1, color: '#BF00FF' },
                    { icon: Award, label: '卡牌收藏家', unlocked: (balance?.cards_collected ?? 0) >= 10, color: '#FFD93D' },
                    { icon: Zap, label: '研究员', unlocked: displayLevel >= 10, color: '#00FFD1' },
                    { icon: Star, label: '专家', unlocked: displayLevel >= 20, color: '#BF00FF' }
                  ].map((badge, idx) => (
                    <motion.div
                      key={badge.label}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      whileHover={{ scale: badge.unlocked ? 1.1 : 1 }}
                      title={badge.unlocked ? '已解锁' : '尚未解锁'}
                      className={`flex flex-col items-center p-3 rounded-xl transition-all ${
                        badge.unlocked ? 'bg-surface/50' : 'bg-surface/20 opacity-50'
                      }`}
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-1"
                        style={{
                          background: badge.unlocked ? `${badge.color}20` : '#2A2A38',
                          border: `1px solid ${badge.unlocked ? badge.color : '#2A2A38'}`,
                          boxShadow: badge.unlocked ? `0 0 15px ${badge.color}40` : 'none'
                        }}
                      >
                        <badge.icon
                          className="w-6 h-6"
                          style={{ color: badge.unlocked ? badge.color : '#8888A0' }}
                        />
                      </div>
                      <span className="text-xs text-muted">{badge.label}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="glass-card rounded-2xl overflow-hidden">
                <h3 className="text-lg font-bold text-white p-6 pb-4">更多</h3>
                <div className="divide-y divide-border">
                  {menuItems.map((item, idx) => (
                    <motion.button
                      key={item.label}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                      onClick={() => item.onClick && item.onClick()}
                      disabled={!item.onClick}
                      className={`w-full flex items-center gap-4 px-6 py-4 transition-colors text-left ${!item.onClick ? 'cursor-default' : ''}`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.danger ? 'bg-accent/10' : 'bg-surface'}`}>
                        <item.icon className={`w-5 h-5 ${item.danger ? 'text-accent' : 'text-primary'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium truncate ${item.danger ? 'text-accent' : 'text-white'}`}>{item.label}</div>
                        <div className="text-xs text-muted truncate">{item.desc}</div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted flex-shrink-0" />
                    </motion.button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
