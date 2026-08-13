'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, Zap, Bell, User, Menu, X, LogIn } from 'lucide-react';
import { useState, useEffect } from 'react';
import { isAuthenticated, getStoredUser, logout } from '@/lib/api';

const categories = [
  { id: 'hot', label: '🔥 热门' },
  { id: 'tech', label: '⚡ 技术' },
  { id: 'business', label: '💼 商业' },
  { id: 'finance', label: '📈 财经' },
  { id: 'academic', label: '🎓 学术' }
];

interface HeaderProps {
  activeCategory?: string;
  onCategoryChange?: (category: string) => void;
  showSearch?: boolean;
}

export default function Header({
  activeCategory,
  onCategoryChange,
  showSearch = true
}: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState(getStoredUser());

  useEffect(() => {
    setAuthed(isAuthenticated());
    setUser(getStoredUser());
  }, []);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="fixed top-0 left-0 right-0 z-50 glass-nav"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative">
              <Zap className="w-8 h-8 text-primary animate-neon-glow" />
            </div>
            <span className="text-xl font-bold tracking-wider gradient-text-primary">
              NEXUS AI
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onCategoryChange?.(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeCategory === cat.id
                    ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_rgba(0,255,209,0.3)]'
                    : 'text-muted hover:text-white hover:bg-white/5'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {showSearch && (
              <div className="relative">
                {searchOpen ? (
                  <motion.div
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    className="flex items-center bg-surface/80 rounded-full px-4 py-2 border border-border"
                  >
                    <Search className="w-4 h-4 text-muted mr-2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索 AI 资讯..."
                      className="bg-transparent outline-none text-sm text-white placeholder-muted w-48"
                      autoFocus
                    />
                    <button onClick={() => setSearchOpen(false)}>
                      <X className="w-4 h-4 text-muted ml-2 hover:text-white" />
                    </button>
                  </motion.div>
                ) : (
                  <button
                    onClick={() => setSearchOpen(true)}
                    className="p-2 rounded-full hover:bg-white/5 text-muted hover:text-white transition-colors"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            <button className="p-2 rounded-full hover:bg-white/5 text-muted hover:text-white transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full animate-pulse" />
            </button>

            {authed ? (
              <Link
                href="/profile"
                className="p-2 rounded-full hover:bg-white/5 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <User className="w-4 h-4 text-background" />
                </div>
              </Link>
            ) : (
              <Link
                href="/auth"
                className="flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">登录</span>
              </Link>
            )}

            <button
              className="md:hidden p-2 rounded-full hover:bg-white/5 text-muted hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="md:hidden overflow-hidden pb-4"
          >
            <div className="flex flex-col gap-1 pt-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    onCategoryChange?.(cat.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`px-4 py-3 rounded-lg text-left text-sm font-medium transition-all ${
                    activeCategory === cat.id
                      ? 'bg-primary/20 text-primary'
                      : 'text-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </motion.header>
  );
}