'use client';

import { motion } from 'framer-motion';
import { Star, Trophy, Sparkles } from 'lucide-react';

interface LevelBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  showGlow?: boolean;
}

const levelColors = (level: number) => {
  if (level >= 50) return { primary: '#FF006E', secondary: '#BF00FF', glow: '#FF006E' };
  if (level >= 30) return { primary: '#BF00FF', secondary: '#00FFD1', glow: '#BF00FF' };
  if (level >= 15) return { primary: '#00FFD1', secondary: '#00BFFF', glow: '#00FFD1' };
  return { primary: '#00BFFF', secondary: '#FFFFFF', glow: '#00BFFF' };
};

const sizeMap = {
  sm: { w: 24, h: 24, icon: 12, text: 'text-[10px]', padding: 'px-1' },
  md: { w: 32, h: 32, icon: 16, text: 'text-xs', padding: 'px-2' },
  lg: { w: 48, h: 48, icon: 24, text: 'text-base', padding: 'px-3 py-1.5' }
};

export default function LevelBadge({ level, size = 'md', showGlow = true }: LevelBadgeProps) {
  const colors = levelColors(level);
  const s = sizeMap[size];

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`inline-flex items-center gap-1 rounded-full font-bold text-background ${s.text} ${s.padding}`}
      style={{
        width: size === 'lg' ? 'auto' : s.w,
        height: s.h,
        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
        boxShadow: showGlow ? `0 0 10px ${colors.glow}80, 0 0 20px ${colors.glow}40` : 'none'
      }}
    >
      <Trophy className="w-3 h-3" style={{ width: s.icon, height: s.icon }} strokeWidth={2.5} />
      <span className="font-black">Lv.{level}</span>
    </motion.div>
  );
}