'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  Newspaper,
  Grid3X3,
  TrendingUp,
  User,
  Trophy,
  Settings,
  Zap,
  Bookmark,
  History,
  Sparkles,
  Users
} from 'lucide-react';
import {
  getDailyTasks,
  claimDailyTask,
  isAuthenticated,
  type DailyTask
} from '@/lib/api';

const navSections = [
  {
    title: '导航',
    items: [
      { href: '/news', icon: Newspaper, label: 'AI 资讯', color: '#00FFD1' },
      { href: '/cards', icon: Grid3X3, label: '卡牌收集', color: '#BF00FF' },
      { href: '/predictions', icon: TrendingUp, label: '预测市场', color: '#FF006E' },
      { href: '/push-history', icon: History, label: '历史推送', color: '#FFB300' },
      { href: '/leaderboard', icon: Trophy, label: '排行榜', color: '#00FFD1' }
    ]
  },
  {
    title: '我的',
    items: [
      { href: '/profile', icon: User, label: '个人中心', color: '#00FFD1' },
      { href: '/friends', icon: Users, label: '好友', color: '#00FFD1' },
      { href: '/bookmarks', icon: Bookmark, label: '收藏夹', color: '#BF00FF' },
      { href: '/history', icon: History, label: '浏览历史', color: '#FF006E' },
      { href: '/settings', icon: Settings, label: '设置', color: '#8888A0' }
    ]
  }
];

export default function Sidebar() {
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      const isAuth = isAuthenticated();
      setAuthed(isAuth);
      if (!isAuth) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await getDailyTasks();
        if (mounted) {
          setTasks(data.tasks);
        }
      } catch (err) {
        console.error('Failed to fetch daily tasks:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  const handleClaim = async (taskId: string) => {
    try {
      setClaimingId(taskId);
      setMessage(null);
      const result = await claimDailyTask(taskId);
      setMessage({
        type: 'success',
        text: `获得 ${result.points_earned} 积分, ${result.experience_earned} 经验`
      });
      const data = await getDailyTasks();
      setTasks(data.tasks);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '领取失败';
      setMessage({ type: 'error', text: msg });
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <motion.aside
      initial={{ x: -250 }}
      animate={{ x: 0 }}
      transition={{ type: 'spring', stiffness: 80, damping: 15 }}
      className="hidden lg:flex fixed left-0 top-16 bottom-0 w-64 flex-col glass-nav border-r border-border"
    >
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
        {navSections.map((section) => (
          <div key={section.title}>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 px-3">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname?.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon
                      className="w-5 h-5 transition-colors"
                      style={isActive ? { color: item.color, filter: `drop-shadow(0 0 6px ${item.color})` } : {}}
                    />
                    <span className="text-sm font-medium">{item.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute left-0 w-1 h-6 rounded-r-full"
                        style={{ background: item.color, boxShadow: `0 0 10px ${item.color}` }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="glass-card p-4 rounded-xl"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-secondary to-accent flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">每日任务</div>
              <div className="text-xs text-muted">完成任务获取奖励</div>
            </div>
          </div>

          {!authed ? (
            <div className="text-center py-3 text-xs text-muted">
              登录后查看任务
            </div>
          ) : loading ? (
            <div className="text-center py-3 text-xs text-muted">
              加载中...
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-3 text-xs text-muted">
              暂无任务
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const pct = task.target > 0 ? Math.min(100, (task.progress / task.target) * 100) : 0;
                return (
                  <div key={task.id} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">{task.title}</span>
                      <span className="text-primary font-medium">
                        {task.progress}/{task.target}
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                      />
                    </div>
                    {task.claimed ? (
                      <div className="text-xs text-muted text-center py-1">
                        已领取
                      </div>
                    ) : task.claimable ? (
                      <button
                        onClick={() => handleClaim(task.id)}
                        disabled={claimingId === task.id}
                        className="mt-1 w-full py-2 text-xs font-medium rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        {claimingId === task.id ? '领取中...' : '领取奖励'}
                      </button>
                    ) : null}
                  </div>
                );
              })}

              {message && (
                <div
                  className={`text-xs text-center py-1 ${
                    message.type === 'success' ? 'text-primary' : 'text-red-400'
                  }`}
                >
                  {message.text}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </motion.aside>
  );
}