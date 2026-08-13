'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { register, login } from '@/lib/api';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        await register(email, password, nickname || undefined);
      } else {
        await login(email, password);
      }
      router.push('/news');
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e.message;
      setError(msg || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <Sparkles className="w-10 h-10 text-primary" style={{ filter: 'drop-shadow(0 0 10px #00FFD1)' }} />
            <span className="text-3xl font-bold gradient-text-primary">NEXUS AI</span>
          </Link>
          <p className="text-muted">AI 新闻聚合 · 阅读即奖励</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-8"
        >
          <div className="flex gap-2 mb-6 p-1 bg-surface rounded-xl">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'login' ? 'bg-primary/20 text-primary' : 'text-muted hover:text-white'
              }`}
            >
              登录
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'register' ? 'bg-primary/20 text-primary' : 'text-muted hover:text-white'
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-muted mb-2">昵称</label>
                <div className="relative">
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="可选"
                    className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-3 text-white placeholder-muted focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-muted mb-2">邮箱</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                  className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-3 text-white placeholder-muted focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted mb-2">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="至少 6 位"
                  className="w-full bg-surface border border-border rounded-xl pl-10 pr-12 py-3 text-white placeholder-muted focus:outline-none focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-3 rounded-xl bg-accent/10 border border-accent/30 text-accent text-sm"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-secondary text-background disabled:opacity-50"
              style={{ boxShadow: '0 0 20px rgba(0,255,209,0.3)' }}
            >
              {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </motion.button>
          </form>

          <p className="text-center text-xs text-muted mt-6">
            {mode === 'login' ? '还没有账号？' : '已有账号？'}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              className="text-primary ml-1 hover:underline"
            >
              {mode === 'login' ? '立即注册' : '返回登录'}
            </button>
          </p>
        </motion.div>

        <p className="text-center text-xs text-muted mt-6">
          登录后可获得积分、收集卡牌、参与预测市场
        </p>
      </div>
    </div>
  );
}
