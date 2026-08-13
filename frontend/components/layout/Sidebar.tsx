'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
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
  Sparkles
} from 'lucide-react';

const navSections = [
  {
    title: '导航',
    items: [
      { href: '/news', icon: Newspaper, label: 'AI 资讯', color: '#00FFD1' },
      { href: '/cards', icon: Grid3X3, label: '卡牌收集', color: '#BF00FF' },
      { href: '/predictions', icon: TrendingUp, label: '预测市场', color: '#FF006E' },
      { href: '/leaderboard', icon: Trophy, label: '排行榜', color: '#00FFD1' }
    ]
  },
  {
    title: '我的',
    items: [
      { href: '/profile', icon: User, label: '个人中心', color: '#00FFD1' },
      { href: '/bookmarks', icon: Bookmark, label: '收藏夹', color: '#BF00FF' },
      { href: '/history', icon: History, label: '浏览历史', color: '#FF006E' },
      { href: '/settings', icon: Settings, label: '设置', color: '#8888A0' }
    ]
  }
];

export default function Sidebar() {
  const pathname = usePathname();

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
          className="glass-card p-4 rounded-xl cursor-pointer"
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
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">阅读 5 篇资讯</span>
              <span className="text-primary font-medium">3/5</span>
            </div>
            <div className="h-1.5 bg-surface rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '60%' }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
              />
            </div>
          </div>
          <button className="mt-3 w-full py-2 text-xs font-medium rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors flex items-center justify-center gap-1">
            <Zap className="w-3.5 h-3.5" />
            领取奖励
          </button>
        </motion.div>
      </div>
    </motion.aside>
  );
}