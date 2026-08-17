'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  User,
  Mail,
  Calendar,
  Gift,
  Shield,
  BellRing,
  ChevronRight,
  LogOut,
  Loader2,
  Check,
  Edit3,
  Zap,
  Copy,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import { getStoredUser, isAuthenticated, logout } from '@/lib/api';
import type { User as UserType } from '@/lib/types';

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return iso;
  }
}

export default function SettingsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);
  const [savedNickname, setSavedNickname] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/auth');
      return;
    }
    setUser(getStoredUser());
    setReady(true);
  }, [router]);

  const handleSaveNickname = () => {
    const trimmed = nicknameDraft.trim();
    if (!trimmed || !user) return;
    setSavingNickname(true);
    try {
      const updated: UserType = { ...user, nickname: trimmed };
      localStorage.setItem('auth_user', JSON.stringify(updated));
      setUser(updated);
      setEditingNickname(false);
      setSavedNickname(true);
      setTimeout(() => setSavedNickname(false), 2000);
    } finally {
      setSavingNickname(false);
    }
  };

  const handleCancelNickname = () => {
    setEditingNickname(false);
    setNicknameDraft(user?.nickname || '');
  };

  const handleLogout = () => {
    if (!confirm('确认退出登录？')) return;
    logout();
    router.push('/auth');
  };

  const handleCopyInviteCode = async () => {
    if (!user?.invite_code) return;
    try {
      await navigator.clipboard.writeText(user.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center glass-card rounded-2xl p-8">
          <p className="text-muted text-sm mb-4">未获取到用户信息，请重新登录。</p>
          <Link href="/auth" className="btn-neon btn-neon-primary">
            去登录
          </Link>
        </div>
      </div>
    );
  }

  const displayNickname = user.nickname || user.username || (user.email ? user.email.split('@')[0] : 'AI探索者');

  const accountItems = [
    {
      icon: Mail,
      label: '邮箱',
      value: user.email || '—',
      color: '#00FFD1',
    },
    {
      icon: Gift,
      label: '邀请码',
      value: user.invite_code || '—',
      color: '#FFD93D',
      action: user.invite_code ? handleCopyInviteCode : undefined,
      actionLabel: copied ? '已复制' : '复制',
    },
  ];

  const preferenceItems = [
    {
      icon: BellRing,
      label: '推送设置',
      desc: '邮件 / 微信 / 触发时机 / 兴趣标签',
      href: '/profile',
      color: '#00FFD1',
    },
    {
      icon: User,
      label: '个人主页',
      desc: '查看等级、积分、签到、卡牌收藏',
      href: '/profile',
      color: '#BF00FF',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header showSearch={false} />
      <Sidebar />

      <main className="pt-16 lg:pl-64 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(0,255,209,0.25), rgba(191,0,255,0.25))',
                border: '1px solid rgba(0,255,209,0.35)',
              }}
            >
              <SettingsIcon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">账号设置</h1>
              <p className="text-muted text-sm mt-0.5">管理你的账号信息与偏好</p>
            </div>
          </div>

          {/* 用户信息卡 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-6 mb-6"
          >
            <div className="flex items-center gap-2 mb-4 text-xs uppercase tracking-wider text-muted">
              <User className="w-3.5 h-3.5" />
              个人信息
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #00FFD1 0%, #BF00FF 100%)',
                  boxShadow: '0 0 25px rgba(0,255,209,0.4), 0 0 50px rgba(191,0,255,0.25)',
                }}
              >
                <User className="w-10 h-10 text-background" />
              </div>

              <div className="flex-1 min-w-0 w-full">
                {editingNickname ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={nicknameDraft}
                      onChange={(e) => setNicknameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveNickname();
                        if (e.key === 'Escape') handleCancelNickname();
                      }}
                      maxLength={32}
                      placeholder="输入新昵称"
                      className="flex-1 bg-background/60 border border-border rounded-xl px-4 py-2.5 text-base text-white placeholder:text-muted/70 focus:outline-none focus:border-primary/60"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveNickname}
                        disabled={savingNickname || !nicknameDraft.trim()}
                        className="btn-neon btn-neon-primary text-sm py-2 px-4 disabled:opacity-60"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        保存
                      </button>
                      <button
                        onClick={handleCancelNickname}
                        className="px-4 py-2 rounded-xl text-sm border border-border text-muted hover:text-white hover:border-white/30 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl font-bold text-white truncate">{displayNickname}</h2>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ scale: 1.1 }}
                      onClick={() => {
                        setNicknameDraft(displayNickname);
                        setEditingNickname(true);
                      }}
                      className="p-1.5 rounded-lg bg-surface/60 text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                      title="编辑昵称"
                    >
                      <Edit3 className="w-4 h-4" />
                    </motion.button>
                    {savedNickname && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-1 text-xs text-primary"
                      >
                        <Check className="w-3.5 h-3.5" /> 已保存
                      </motion.span>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/20 text-primary border border-primary/30">
                    <Zap className="w-3.5 h-3.5" />
                    Lv.{user.level ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-surface text-muted border border-border">
                    <Mail className="w-3.5 h-3.5" />
                    {user.email}
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-surface text-muted border border-border">
                    <Calendar className="w-3.5 h-3.5" />
                    加入于 {formatDate(user.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 账号信息 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass-card rounded-2xl overflow-hidden mb-6"
          >
            <div className="flex items-center gap-2 px-6 pt-6 pb-4 text-xs uppercase tracking-wider text-muted">
              <Shield className="w-3.5 h-3.5" />
              账号
            </div>
            <div className="divide-y divide-border">
              {accountItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-4 px-6 py-4"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `${item.color}15`,
                      border: `1px solid ${item.color}40`,
                    }}
                  >
                    <item.icon className="w-5 h-5" style={{ color: item.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{item.label}</div>
                    <div className="text-sm text-muted truncate font-mono break-all">
                      {item.value}
                    </div>
                  </div>
                  {item.action && (
                    <button
                      onClick={item.action}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-border text-muted hover:text-primary hover:border-primary/40 hover:bg-primary/10 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {item.actionLabel}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* 偏好设置 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card rounded-2xl overflow-hidden mb-6"
          >
            <div className="flex items-center gap-2 px-6 pt-6 pb-4 text-xs uppercase tracking-wider text-muted">
              <BellRing className="w-3.5 h-3.5" />
              偏好设置
            </div>
            <div className="divide-y divide-border">
              {preferenceItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors group"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `${item.color}15`,
                      border: `1px solid ${item.color}40`,
                    }}
                  >
                    <item.icon className="w-5 h-5" style={{ color: item.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{item.label}</div>
                    <div className="text-xs text-muted truncate">{item.desc}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted flex-shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
            </div>
          </motion.div>

          {/* 退出登录 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4 justify-between border border-accent/20"
          >
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-accent/10 border border-accent/30 flex-shrink-0">
                <LogOut className="w-5 h-5 text-accent" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">退出登录</div>
                <div className="text-xs text-muted">退出当前账号，需要重新登录后访问</div>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              onClick={handleLogout}
              className="btn-neon btn-neon-accent w-full sm:w-auto"
            >
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </motion.button>
          </motion.div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
