'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Share2, ArrowRight, ExternalLink, AlertCircle, Sparkles } from 'lucide-react';
import { trackShareClick } from '@/lib/api';
import type { ShareClickResponse } from '@/lib/types';

export default function ShareLandingPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ShareClickResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const resolveShare = async () => {
      try {
        const resp = await trackShareClick(token);
        setData(resp);
      } catch (e: any) {
        setError(e?.response?.data?.detail || '分享链接无效或已过期');
      } finally {
        setLoading(false);
      }
    };
    resolveShare();
  }, [token]);

  const handleRedirect = () => {
    setRedirecting(true);
    if (data?.target_type === 'news') {
      router.push('/news');
    } else if (data?.target_type === 'prediction') {
      router.push('/predictions');
    } else {
      router.push('/');
    }
  };

  const targetTypeLabels: Record<string, { label: string; emoji: string; color: string }> = {
    news: { label: 'AI 新闻资讯', emoji: '📰', color: '#00FFD1' },
    prediction: { label: 'AI 预测市场', emoji: '🎯', color: '#BF00FF' },
    card: { label: '稀有卡片', emoji: '✨', color: '#FFD93D' },
  };

  const meta = data ? targetTypeLabels[data.target_type] || { label: '内容', emoji: '🔗', color: '#00FFD1' } : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div
          className="glass-card rounded-3xl p-8 relative overflow-hidden"
          style={{
            boxShadow: meta
              ? `0 0 40px ${meta.color}20, inset 0 0 60px ${meta.color}08`
              : undefined,
          }}
        >
          {meta && (
            <div
              className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-30"
              style={{ backgroundColor: meta.color }}
            />
          )}

          <div className="relative z-10">
            {loading ? (
              <div className="flex flex-col items-center py-16">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                  className="w-16 h-16 mb-6 rounded-full border-4 border-primary/30 border-t-primary flex items-center justify-center"
                >
                  <Share2 className="w-7 h-7 text-primary" />
                </motion.div>
                <p className="text-muted text-sm">正在解析分享链接...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="w-20 h-20 mb-6 rounded-full bg-accent/15 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-accent" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">链接无效</h2>
                <p className="text-muted text-sm mb-8 max-w-xs">{error}</p>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => router.push('/')}
                  className="w-full px-6 py-3 rounded-xl bg-primary text-background font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                  <ArrowRight className="w-5 h-5" />
                  前往首页
                </motion.button>
              </div>
            ) : (
              <div className="flex flex-col items-center py-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                  className="w-20 h-20 mb-5 rounded-full flex items-center justify-center text-4xl"
                  style={{
                    background: `linear-gradient(135deg, ${meta?.color}40, ${meta?.color}10)`,
                    border: `2px solid ${meta?.color}50`,
                    boxShadow: `0 0 30px ${meta?.color}30`,
                  }}
                >
                  {meta?.emoji}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-center mb-2"
                >
                  <h2 className="text-2xl font-bold text-white mb-1">发现好内容！</h2>
                  <p className="text-sm" style={{ color: meta?.color }}>
                    {meta?.label}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="w-full my-6 p-4 rounded-xl bg-surface/60 border border-border"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">分享点击次数</span>
                    <span className="font-bold text-white">{data?.click_count ?? 0}</span>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="w-full space-y-3"
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleRedirect}
                    disabled={redirecting}
                    className="w-full px-6 py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-70"
                    style={{
                      background: `linear-gradient(135deg, ${meta?.color}, #BF00FF)`,
                      color: '#0a0a0f',
                      boxShadow: `0 0 25px ${meta?.color}50`,
                    }}
                  >
                    {redirecting ? (
                      <>
                        <Sparkles className="w-5 h-5 animate-pulse" />
                        正在跳转...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-5 h-5" />
                        立即查看
                      </>
                    )}
                  </motion.button>

                  <button
                    onClick={() => router.push('/')}
                    className="w-full px-6 py-3 rounded-xl bg-surface text-muted font-medium text-sm hover:text-white transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    先逛逛首页
                  </button>
                </motion.div>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted mt-6">
          N AI · 让资讯更有价值
        </p>
      </motion.div>
    </div>
  );
}
