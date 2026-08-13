'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Clock,
  Users,
  Zap,
  Trophy,
  Check,
  AlertCircle,
  Share2,
  ChevronRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import Sidebar from '@/components/layout/Sidebar';
import {
  getPredictions,
  getPrediction,
  placeBet,
  isAuthenticated,
  getBalance,
  getStoredUser,
} from '@/lib/api';
import type {
  Prediction,
  PredictionListResponse,
  PredictionDetailResponse,
  BetResponse,
  PointBalanceResponse,
} from '@/lib/types';

// Helper: display a countdown-ish label
function formatDeadline(deadline?: string) {
  if (!deadline) return '已截止';
  const diff = new Date(deadline).getTime() - Date.now();
  const days = Math.floor(diff / 86400000);
  if (days < 0) return '已截止';
  if (days === 0) return '今天截止';
  if (days === 1) return '明天截止';
  return `${days} 天后截止`;
}

// Map backend prediction -> UI prediction
function mapPrediction(p: any): Prediction {
  const total = Math.max(1, (p.total_amount ?? p.volume ?? 0));
  // Estimate yes/no odds by querying bets from detail later; for list use 50/50 as fallback
  const yesPct = 50;
  const noPct = 50;
  return {
    id: p.id,
    question: p.question,
    description: p.settlement_logic || '',
    category: p.category || '综合',
    expires_at: p.expires_at,
    deadline: p.expires_at,
    status: p.status,
    isSettled: p.status === 'settled',
    result: p.result === 'yes' ? 'yes' : p.result === 'no' ? 'no' : undefined,
    volume: p.total_amount ?? 0,
    participants: p.total_bets ?? 0,
    currentOddsYes: yesPct,
    currentOddsNo: noPct,
    total_amount: p.total_amount,
    total_bets: p.total_bets,
  };
}

export default function PredictionsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'active' | 'settled' | 'mybets'>('active');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [myBets, setMyBets] = useState<BetResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<PointBalanceResponse | null>(null);

  const [selectedPrediction, setSelectedPrediction] = useState<PredictionDetailResponse | null>(null);
  const [betAmount, setBetAmount] = useState(50);
  const [betDirection, setBetDirection] = useState<'yes' | 'no'>('yes');
  const [betting, setBetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const tasks: Promise<any>[] = [getPredictions()];
      if (isAuthenticated()) {
        tasks.push(getBalance().catch(() => null));
      }
      const [resp, bal] = await Promise.all(tasks);
      const list = (resp as PredictionListResponse).items.map(mapPrediction);
      setPredictions(list);

      if (bal) setBalance(bal as PointBalanceResponse);

      if (isAuthenticated()) {
        // Fetch detail for all pending predictions to get my bets
        const pending = list.filter((p) => p.status === 'pending').slice(0, 10);
        const bets: BetResponse[] = [];
        for (const p of pending) {
          try {
            const d = (await getPrediction(p.id)) as any;
            if (d?.my_bets?.length) {
              bets.push(...d.my_bets);
            }
          } catch {
            /* ignore */
          }
        }
        setMyBets(bets);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const activeList = predictions.filter((p) => p.status === 'pending');
  const settledList = predictions.filter((p) => p.status === 'settled');

  // Calculate yes/no odds for a single prediction via detail
  const openBetting = async (prediction: Prediction) => {
    if (!isAuthenticated()) {
      router.push('/auth');
      return;
    }
    try {
      const d = (await getPrediction(prediction.id)) as any;
      const yesAmount = d.my_bets?.filter((b: BetResponse) => b.choice === 'yes').reduce((a: number, b: BetResponse) => a + b.amount, 0) || 0;
      const noAmount = d.my_bets?.filter((b: BetResponse) => b.choice === 'no').reduce((a: number, b: BetResponse) => a + b.amount, 0) || 0;
      const pool = yesAmount + noAmount + 1;
      const detail: PredictionDetailResponse = {
        ...(prediction as any),
        currentOddsYes: Math.round((yesAmount + 1) / pool * 100),
        currentOddsNo: Math.round((noAmount + 1) / pool * 100),
        my_bets: d.my_bets || [],
      };
      setSelectedPrediction(detail);
      setBetDirection('yes');
      setBetAmount(Math.min(50, balance?.points ?? 50));
      setErrorMsg(null);
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.detail || e?.message || '无法加载预测详情');
    }
  };

  const confirmBet = async () => {
    if (!selectedPrediction || betting) return;
    setBetting(true);
    setErrorMsg(null);
    try {
      await placeBet(selectedPrediction.id, betDirection, betAmount);
      setSelectedPrediction(null);
      setBetting(false);
      await loadList(); // refresh
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.detail || e?.message || '投注失败');
      setBetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar />

      <main className="pt-16 lg:pl-64 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">预测市场</h1>
              <p className="text-muted text-sm">预测 AI 趋势，赢取积分奖励</p>
            </div>
            {isAuthenticated() && balance && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">我的积分</span>
                <span className="text-primary font-bold gradient-text-primary">{balance.points.toLocaleString()}</span>
              </div>
            )}
            {!isAuthenticated() && (
              <button onClick={() => router.push('/auth')} className="btn-neon btn-neon-primary text-sm">
                登录参与
              </button>
            )}
          </div>

          <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hidden">
            {[
              { id: 'active', label: '进行中', count: activeList.length },
              { id: 'mybets', label: '我的投注', count: myBets.length, needAuth: true },
              { id: 'settled', label: '已结算', count: settledList.length }
            ].map((tab) => {
              const disabled = tab.needAuth && !isAuthenticated();
              return (
                <motion.button
                  key={tab.id}
                  whileTap={{ scale: disabled ? 1 : 0.95 }}
                  onClick={() => !disabled && setActiveTab(tab.id as any)}
                  disabled={disabled}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : disabled
                      ? 'bg-surface/50 text-muted/50 border border-border/50 cursor-not-allowed'
                      : 'bg-surface text-muted border border-border hover:text-white'
                  }`}
                >
                  {tab.label} ({tab.count})
                </motion.button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-muted text-sm">加载预测中...</span>
            </div>
          ) : errorMsg ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <AlertCircle className="w-10 h-10 text-accent mx-auto mb-3" />
              <div className="text-accent font-bold mb-2">{errorMsg}</div>
              <button onClick={loadList} className="btn-neon btn-neon-primary mt-2">重试</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeTab === 'active' && activeList.length === 0 && (
                <div className="col-span-2 glass-card rounded-2xl p-12 text-center text-muted">
                  暂无进行中的预测
                </div>
              )}

              {activeTab === 'active' && activeList.map((prediction, idx) => (
                <motion.div
                  key={prediction.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  whileHover={{ scale: 1.01 }}
                  className="glass-card rounded-2xl p-5 cursor-pointer"
                  onClick={() => openBetting(prediction)}
                >
                  <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs bg-secondary/20 text-secondary border border-secondary/30">
                        {prediction.category}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-muted">
                        <Clock className="w-3 h-3" />
                        {formatDeadline(prediction.expires_at || prediction.deadline)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted">
                      <Users className="w-3 h-3" />
                      {(prediction.participants || prediction.total_bets || 0).toLocaleString()}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2 leading-snug">{prediction.question}</h3>
                  {prediction.description && (
                    <p className="text-sm text-muted mb-4 line-clamp-2">{prediction.description}</p>
                  )}

                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-secondary font-medium">YES {prediction.currentOddsYes}%</span>
                      <span className="text-muted">交易量: {(prediction.volume || prediction.total_amount || 0).toLocaleString()}</span>
                      <span className="text-accent font-medium">NO {prediction.currentOddsNo}%</span>
                    </div>
                    <div className="h-2 bg-surface rounded-full overflow-hidden flex">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${prediction.currentOddsYes}%` }}
                        transition={{ duration: 0.8, delay: idx * 0.05 }}
                        className="h-full rounded-l-full"
                        style={{ background: 'linear-gradient(90deg, #BF00FF, #00FFD1)' }}
                      />
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${prediction.currentOddsNo}%` }}
                        transition={{ duration: 0.8, delay: idx * 0.05 + 0.08 }}
                        className="h-full rounded-r-full"
                        style={{ background: 'linear-gradient(90deg, #FF006E, #FF6B35)' }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => { e.stopPropagation(); openBetting(prediction); }}
                      className="flex-1 py-2 rounded-lg text-sm font-medium bg-secondary/20 text-secondary border border-secondary/30 hover:bg-secondary/30 transition-colors"
                    >
                      投注 YES
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => { e.stopPropagation(); openBetting(prediction); }}
                      className="flex-1 py-2 rounded-lg text-sm font-medium bg-accent/20 text-accent border border-accent/30 hover:bg-accent/30 transition-colors"
                    >
                      投注 NO
                    </motion.button>
                  </div>
                </motion.div>
              ))}

              {activeTab === 'settled' && settledList.map((prediction, idx) => (
                <motion.div
                  key={prediction.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  className="glass-card rounded-2xl p-5"
                  style={{ borderColor: prediction.result === 'yes' ? '#00FFD160' : '#FF006E60' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      prediction.result === 'yes'
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'bg-accent/20 text-accent border border-accent/30'
                    }`}>
                      {prediction.result === 'yes' ? '✓ 结果: 是 (YES)' : '✗ 结果: 否 (NO)'}
                    </span>
                    <span className="text-xs text-muted">
                      {prediction.deadline ? new Date(prediction.deadline).toLocaleDateString('zh-CN') : ''}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{prediction.question}</h3>
                  {prediction.description && (
                    <p className="text-sm text-muted mb-4">{prediction.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted">
                    <span>交易量: {(prediction.volume || prediction.total_amount || 0).toLocaleString()}</span>
                    <span>参与者: {(prediction.participants || prediction.total_bets || 0).toLocaleString()}</span>
                  </div>
                </motion.div>
              ))}

              {activeTab === 'mybets' && (
                <>
                  {!isAuthenticated() ? (
                    <div className="col-span-2 glass-card rounded-2xl p-12 text-center">
                      <AlertCircle className="w-10 h-10 text-secondary mx-auto mb-3" />
                      <div className="font-bold text-white mb-1">请先登录</div>
                      <div className="text-muted text-sm mb-4">登录后可查看您的投注记录</div>
                      <button onClick={() => router.push('/auth')} className="btn-neon btn-neon-primary">
                        去登录
                      </button>
                    </div>
                  ) : myBets.length === 0 ? (
                    <div className="col-span-2 glass-card rounded-2xl p-12 text-center text-muted">
                      暂无投注记录，快去下注吧！
                    </div>
                  ) : (
                    myBets.map((bet, idx) => {
                      const pred = predictions.find((p) => p.id === bet.prediction_id);
                      return (
                        <motion.div
                          key={bet.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="glass-card rounded-2xl p-5"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              bet.choice === 'yes'
                                ? 'bg-secondary/20 text-secondary'
                                : 'bg-accent/20 text-accent'
                            }`}>
                              {bet.choice === 'yes' ? 'YES' : 'NO'}
                            </span>
                            <span className={`text-xs font-medium ${
                              bet.status === 'won' ? 'text-primary' :
                              bet.status === 'lost' ? 'text-accent' : 'text-muted'
                            }`}>
                              {bet.status === 'won' ? '✓ 已赢' : bet.status === 'lost' ? '✗ 已输' :
                               bet.status === 'pending' ? '进行中' : bet.status}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-white mb-3">
                            {pred?.question || '预测'}
                          </h3>
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <div className="text-xs text-muted mb-1">投注额</div>
                              <div className="font-bold text-white">{bet.amount.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted mb-1">赔率</div>
                              <div className="font-bold text-primary">{(bet.odds * 100).toFixed(0)}%</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted mb-1">预计收益</div>
                              <div className="font-bold text-secondary">
                                {bet.payout ? bet.payout.toLocaleString() : (bet.amount * bet.odds).toFixed(0)}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>

      <BottomNav />

      <AnimatePresence>
        {selectedPrediction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !betting && setSelectedPrediction(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              className="glass-card rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-2 leading-snug">{selectedPrediction.question}</h3>
              {selectedPrediction.description && (
                <p className="text-sm text-muted mb-4">{selectedPrediction.description}</p>
              )}

              <div className="flex items-center justify-between text-xs text-muted mb-4">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDeadline(selectedPrediction.expires_at as any)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {(selectedPrediction as any).total_bets || 0} 笔投注
                </span>
              </div>

              <div className="flex gap-3 mb-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setBetDirection('yes')}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                    betDirection === 'yes'
                      ? 'bg-secondary text-white shadow-[0_0_20px_rgba(191,0,255,0.4)]'
                      : 'bg-surface text-muted border border-border'
                  }`}
                >
                  YES {selectedPrediction.currentOddsYes ?? 50}%
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setBetDirection('no')}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                    betDirection === 'no'
                      ? 'bg-accent text-white shadow-[0_0_20px_rgba(255,0,110,0.4)]'
                      : 'bg-surface text-muted border border-border'
                  }`}
                >
                  NO {selectedPrediction.currentOddsNo ?? 50}%
                </motion.button>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <label className="text-muted">投注金额</label>
                  <span className="text-primary text-xs">
                    当前余额: {(balance?.points ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setBetAmount(Math.max(10, betAmount - 50))}
                    className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-white hover:bg-border transition-colors"
                  >
                    -
                  </motion.button>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="flex-1 h-10 bg-surface rounded-lg text-center text-white font-bold outline-none border border-border focus:border-primary transition-colors"
                  />
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setBetAmount(betAmount + 50)}
                    className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-white hover:bg-border transition-colors"
                  >
                    +
                  </motion.button>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[20, 50, 100, 200, 500, balance?.points].map((v) =>
                    v === undefined ? null : (
                      <motion.button
                        key={v}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setBetAmount(v)}
                        className={`px-3 py-1 rounded text-xs transition-colors ${
                          betAmount === v
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'bg-surface text-muted hover:text-white'
                        }`}
                      >
                        {v === balance?.points ? '全部' : v}
                      </motion.button>
                    )
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-surface/50 mb-4">
                <span className="text-sm text-muted">预计收益（赔率结算时）</span>
                <span className="text-lg font-bold gradient-text-primary">
                  ~{Math.round(betAmount * (betDirection === 'yes'
                    ? (100 / Math.max(1, selectedPrediction.currentOddsYes ?? 50) - 1)
                    : (100 / Math.max(1, selectedPrediction.currentOddsNo ?? 50) - 1)
                  ))} 积分
                </span>
              </div>

              {errorMsg && (
                <div className="text-accent text-sm mb-4 flex items-center gap-2 p-2 rounded-lg bg-accent/10">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedPrediction(null)}
                  disabled={betting}
                  className="flex-1 py-3 rounded-xl font-medium bg-surface text-white border border-border disabled:opacity-50"
                >
                  取消
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={confirmBet}
                  disabled={betting}
                  className="flex-1 py-3 rounded-xl font-bold btn-neon btn-neon-primary disabled:opacity-50"
                >
                  {betting ? '投注中...' : '确认投注'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
