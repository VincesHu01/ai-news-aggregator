'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Newspaper, Grid3X3, TrendingUp, User, Plus } from 'lucide-react';

const navItems = [
  { href: '/news', icon: Newspaper, label: '资讯', color: '#00FFD1' },
  { href: '/cards', icon: Grid3X3, label: '卡牌', color: '#BF00FF' },
  { href: '/news', icon: Plus, label: '', color: '#00FFD1', isCenter: true },
  { href: '/predictions', icon: TrendingUp, label: '预测', color: '#00FFD1' },
  { href: '/profile', icon: User, label: '我的', color: '#BF00FF' }
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="fixed bottom-0 left-0 right-0 z-50 glass-nav md:hidden"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item, index) => {
          const isActive = pathname?.startsWith(item.href);
          const Icon = item.icon;

          if (item.isCenter) {
            return (
              <Link
                key={index}
                href="/news"
                className="relative flex items-center justify-center"
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg"
                  style={{
                    boxShadow: '0 0 20px rgba(0, 255, 209, 0.5), 0 0 40px rgba(191, 0, 255, 0.3)'
                  }}
                >
                  <Icon className="w-6 h-6 text-background" strokeWidth={3} />
                </motion.div>
              </Link>
            );
          }

          return (
            <Link
              key={index}
              href={item.href}
              className="flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg transition-colors"
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className={`p-1 ${
                  isActive ? 'text-primary' : 'text-muted'
                }`}
              >
                <Icon
                  className="w-5 h-5"
                  strokeWidth={isActive ? 2.5 : 2}
                  style={isActive ? { filter: `drop-shadow(0 0 6px ${item.color})` } : {}}
                />
              </motion.div>
              <span
                className={`text-xs ${
                  isActive ? 'text-primary' : 'text-muted'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}