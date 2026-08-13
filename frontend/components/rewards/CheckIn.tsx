'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Check, Zap, Sparkles, Flame } from 'lucide-react';
import { useState } from 'react';
import type { CheckInRecord } from '@/lib/types';

interface CheckInProps {
  currentStreak: number;
  lastCheckIn?: string;
  onCheckIn: () => void;
}

const checkInDays = [
  { day: 1, reward: 10, icon: Zap },
  { day: 2, reward: 15, icon: Zap },
  { day: 3, reward: 20, icon: Sparkles },
  { day: 4, reward: 25, icon: Sparkles },
  { day: 5, reward: 30, icon: Sparkles },
  { day: 6, reward: 50, icon: Flame },
  { day: 7, reward: 100, icon: Flame }
];

export default function CheckIn({ currentStreak, lastCheckIn, onCheckIn }: CheckInProps) {
  const [showCelebration, setShowCelebration] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const today = new Date().toDateString();
  const canCheckIn = lastCheckIn !== today;

  const handleCheckIn = () => {
    if (!canCheckIn || isChecking) return;
    setIsChecking(true);
    setShowCelebration(true);
    onCheckIn();
    setTimeout(() => {
      setIsChecking(false);
      setTimeout(() => setShowCelebration(false), 1500);
    }, 500);
  };

  const getCompletedDays = () => {
    const days: CheckInRecord[] = [];
    for (let i = 0; i < 7; i++) {
      days.push({
        date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0],
        day: i + 1,
        reward: checkInDays[i].reward,
        completed: i < currentStreak
      });
    }
    return days;
  };

  const records = getCompletedDays();

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Calendar className="w-5 h-5 text-background" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">每日签到</h3>
            <p className="text-sm text-muted">
              当前连续签到 <span className="text-primary font-semibold">{currentStreak}</span> 天
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: canCheckIn ? 1.05 : 1 }}
          whileTap={{ scale: canCheckIn ? 0.95 : 1 }}
          onClick={handleCheckIn}
          disabled={!canCheckIn || isChecking}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
            canCheckIn
              ? 'btn-neon btn-neon-primary'
              : 'bg-surface text-muted cursor-not-allowed border border-border'
          }`}
        >
          {isChecking ? '签到中...' : canCheckIn ? '立即签到' : '今日已签到'}
        </motion.button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {checkInDays.map((day, index) => {
          const Icon = day.icon;
          const isCompleted = index < currentStreak;
          const isToday = index === currentStreak;
          const isLocked = index > currentStreak;

          return (
            <motion.div
              key={day.day}
              whileHover={{ scale: isToday && canCheckIn ? 1.05 : 1 }}
              className={`relative flex flex-col items-center p-3 rounded-xl transition-all ${
                isCompleted
                  ? 'bg-primary/20 border border-primary/30'
                  : isToday
                  ? 'bg-secondary/20 border border-secondary/30 animate-pulse'
                  : 'bg-surface/50 border border-border'
              }`}
            >
              {isCompleted && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                  style={{ boxShadow: '0 0 8px #00FFD1' }}
                >
                  <Check className="w-3 h-3 text-background" strokeWidth={3} />
                </motion.div>
              )}

              {isLocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-xl">
                  <span className="text-muted text-xs">🔒</span>
                </div>
              )}

              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1 ${
                  isCompleted
                    ? 'bg-primary/30'
                    : isToday
                    ? 'bg-secondary/30'
                    : 'bg-surface'
                }`}
              >
                <Icon
                  className="w-4 h-4"
                  style={{
                    color: isCompleted ? '#00FFD1' : isToday ? '#BF00FF' : '#8888A0'
                  }}
                />
              </div>
              <span className="text-xs font-medium text-muted">Day {day.day}</span>
              <span
                className={`text-xs font-bold ${
                  isCompleted ? 'text-primary' : isToday ? 'text-secondary' : 'text-muted'
                }`}
              >
                +{day.reward}
              </span>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ y: 0 }}
              animate={{ y: -150 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="flex flex-col items-center"
            >
              <div
                className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4"
                style={{ boxShadow: '0 0 40px #00FFD1, 0 0 80px #BF00FF' }}
              >
                <Sparkles className="w-10 h-10 text-background" />
              </div>
              <div className="px-6 py-3 rounded-full bg-gradient-to-r from-primary to-secondary text-background font-bold text-lg">
                +{checkInDays[currentStreak]?.reward || 10} 积分
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}