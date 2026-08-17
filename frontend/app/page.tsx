'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Zap, ArrowRight, Sparkles, TrendingUp, Users, Newspaper, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getPublicStats, publicTriggerCollection } from '@/lib/api';

export default function LandingPage() {
  const features = [
    { icon: Newspaper, title: '精选 AI 资讯', desc: '每日更新最前沿的人工智能新闻' },
    { icon: Sparkles, title: '卡牌收集系统', desc: '阅读解锁稀有卡牌，收藏你的 AI 世界' },
    { icon: TrendingUp, title: '预测市场', desc: '对 AI 趋势进行预测，赚取积分奖励' },
    { icon: Users, title: '社区排行榜', desc: '与全球 AI 爱好者同台竞技' }
  ];

  const [stats, setStats] = useState<{ news_count: number; users_count: number; bets_count: number } | null>(null);
  const [triggerMsg, setTriggerMsg] = useState<{ type: 'ok' | 'skip' | 'err'; text: string } | null>(null);

  // 每次用户打开（挂载）首页：匿名触发一次采集+推送
  // 服务端自带 20min 最小间隔，不用担心被刷
  useEffect(() => {
    let cancelled = false;
    publicTriggerCollection()
      .then((r) => {
        if (cancelled) return;
        if (r.status === 'ok') {
          const saved = r.detail?.saved_cards ?? 0;
          setTriggerMsg({
            type: 'ok',
            text: saved > 0 ? `✓ 后台已完成一轮采集，新增 ${saved} 条资讯并尝试推送` : '✓ 后台已完成一轮采集与推送，若 20 分钟内已跑过则会跳过。',
          });
        } else {
          setTriggerMsg({ type: 'skip', text: r.detail?.reason || '最近已执行过采集，本次跳过。' });
        }
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e?.response?.data?.detail ?? e?.message ?? '请求失败';
        setTriggerMsg({ type: 'err', text: `采集触发失败：${String(msg).slice(0, 60)}` });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    getPublicStats()
      .then(setStats)
      .catch(() => setStats({ news_count: 0, users_count: 0, bets_count: 0 }));
  }, []);

  const formatNumber = (n: number) => {
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + 'W';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toString();
  };

  const realStats = stats ?? { news_count: 0, users_count: 0, bets_count: 0 };

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 20% 20%, rgba(0,255,209,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(191,0,255,0.15) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(255,0,110,0.08) 0%, transparent 70%)'
        }}
      />

      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-6">
        <div className="flex items-center gap-2">
          <Zap className="w-8 h-8 text-primary animate-neon-glow" />
          <span className="text-xl font-bold tracking-wider gradient-text-primary">NEXUS AI</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/news" className="text-muted hover:text-white transition-colors text-sm hidden sm:block">
            资讯
          </Link>
          <Link href="/cards" className="text-muted hover:text-white transition-colors text-sm hidden sm:block">
            卡牌
          </Link>
          <Link href="/predictions" className="text-muted hover:text-white transition-colors text-sm hidden sm:block">
            预测
          </Link>
          <Link href="/news" className="btn-neon btn-neon-primary text-sm">
            开始探索
          </Link>
        </div>
      </nav>

      <section className="relative z-10 flex flex-col items-center justify-center px-6 pt-16 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center"
            style={{ boxShadow: '0 0 30px #00FFD1, 0 0 60px #BF00FF' }}
          >
            <Zap className="w-10 h-10 text-background" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6"
          >
            <span className="gradient-text-primary">Discover</span>{' '}
            <span className="text-white">AI News</span>
            <br />
            <span className="text-muted text-3xl sm:text-4xl md:text-5xl">Shape the Future</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-muted text-lg sm:text-xl mb-8 max-w-2xl mx-auto"
          >
            发现人工智能的最新前沿。精选资讯、预测市场、卡牌收集，一站式体验 AI 世界。
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/news" className="btn-neon btn-neon-primary text-lg px-8 py-3.5">
              开始探索
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
            <Link href="/predictions" className="btn-neon btn-neon-secondary text-lg px-8 py-3.5">
              预测 AI 趋势
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="mt-8 w-full max-w-3xl"
        >
          {triggerMsg && (
            <div
              className={`mx-auto flex items-center gap-2 text-sm rounded-xl px-4 py-3 border backdrop-blur ${
                triggerMsg.type === 'ok'
                  ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200'
                  : triggerMsg.type === 'skip'
                  ? 'bg-sky-500/10 border-sky-400/30 text-sky-200'
                  : 'bg-rose-500/10 border-rose-400/30 text-rose-200'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${triggerMsg.type === 'err' ? '' : 'animate-spin-slow'}`} />
              <span>{triggerMsg.text}</span>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-20 w-full max-w-6xl"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + index * 0.1 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="glass-card rounded-2xl p-6 cursor-pointer group"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,255,209,0.2), rgba(191,0,255,0.2))',
                  border: '1px solid rgba(0,255,209,0.3)'
                }}
              >
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="grid grid-cols-3 gap-4 sm:gap-16 mt-20 text-center"
        >
          {stats === null ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ))
          ) : (
            [
              { label: '资讯总数', value: formatNumber(realStats.news_count) },
              { label: '注册用户', value: formatNumber(realStats.users_count) },
              { label: '预测参与', value: formatNumber(realStats.bets_count) }
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl sm:text-4xl font-bold gradient-text-primary">{stat.value}</div>
                <div className="text-muted text-sm mt-1">{stat.label}</div>
              </div>
            ))
          )}
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-border py-8 px-6 text-center text-muted text-sm">
        <p>&copy; 2026 NEXUS AI. 探索人工智能的无限可能。</p>
      </footer>
    </main>
  );
}