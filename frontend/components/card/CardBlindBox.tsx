'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Zap, Star } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Rarity } from '@/lib/types';

const rarityData: Record<Rarity, { color: string; label: string; animationClass: string; probability: number }> = {
  SSR: { color: '#FF00FF', label: 'SSR', animationClass: 'animate-rarity-ssr', probability: 1 },
  SR: { color: '#FFD700', label: 'SR', animationClass: 'animate-neon-glow', probability: 5 },
  R: { color: '#00BFFF', label: 'R', animationClass: 'animate-neon-glow', probability: 20 },
  N: { color: '#FFFFFF', label: 'N', animationClass: '', probability: 74 }
};

interface CardBlindBoxProps {
  isOpen: boolean;
  onClose: () => void;
  /** Async draw function that returns the real rarity; fallback uses local random if not provided */
  onDraw?: () => Promise<Rarity | string>;
  onComplete?: (rarity: Rarity) => void;
}

export default function CardBlindBox({ isOpen, onClose, onDraw, onComplete }: CardBlindBoxProps) {
  const [phase, setPhase] = useState<'idle' | 'shaking' | 'revealing' | 'revealed' | 'error'>('idle');
  const [revealedRarity, setRevealedRarity] = useState<Rarity>('N');
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPhase('idle');
      setErrorMsg(null);
    }
  }, [isOpen]);

  const fallbackRarity = (): Rarity => {
    const rand = Math.random() * 100;
    let cumulative = 0;
    const rarities: Rarity[] = ['SSR', 'SR', 'R', 'N'];
    for (const r of rarities) {
      cumulative += rarityData[r].probability;
      if (rand <= cumulative) return r;
    }
    return 'N';
  };

  const drawCard = async () => {
    setPhase('shaking');
    setParticles([]);
    setErrorMsg(null);

    try {
      let rarityResult: Rarity;
      if (onDraw) {
        const result = await Promise.race([
          onDraw(),
          new Promise<Rarity>((resolve) => setTimeout(() => resolve(fallbackRarity()), 1800)),
        ]);
        const r = String(result || 'N').toUpperCase() as Rarity;
        rarityResult = ['SSR', 'SR', 'R', 'N'].includes(r) ? r : 'N';
      } else {
        await new Promise((r) => setTimeout(r, 1500));
        rarityResult = fallbackRarity();
      }

      setRevealedRarity(rarityResult);
      setPhase('revealing');

      const newParticles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100
      }));
      setParticles(newParticles);

      setTimeout(() => {
        setPhase('revealed');
        onComplete?.(rarityResult);
      }, 800);
    } catch (e: any) {
      setErrorMsg(e?.message || '抽卡失败');
      setPhase('error');
      setTimeout(() => {
        setPhase('idle');
      }, 1500);
    }
  };

  const getGlowStyle = (rarity: Rarity) => {
    const color = rarityData[rarity].color;
    return {
      boxShadow: `0 0 20px ${color}, 0 0 40px ${color}80, 0 0 60px ${color}40, inset 0 0 20px ${color}20`
    };
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => (phase === 'revealed' || phase === 'error') && onClose()}
        >
          <div className="relative w-full max-w-md aspect-square flex flex-col items-center justify-center">
            <motion.div
              animate={
                phase === 'shaking'
                  ? {
                      x: [0, -10, 10, -8, 8, -5, 5, -3, 3, 0],
                      rotate: [0, -5, 5, -3, 3, -2, 2, -1, 1, 0]
                    }
                  : {}
              }
              transition={{ duration: 1.5, repeat: phase === 'shaking' ? Infinity : 0 }}
              className="relative"
            >
              <div
                className="w-48 h-64 rounded-2xl relative overflow-hidden"
                style={{
                  background: 'linear-gradient(145deg, #1A1A24 0%, #0F0F18 100%)',
                  border: '3px solid #2A2A38',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(180deg, rgba(0,255,209,0.1) 0%, rgba(191,0,255,0.1) 50%, rgba(255,0,110,0.1) 100%)'
                  }}
                />

                <AnimatePresence>
                  {(phase === 'revealing' || phase === 'revealed') && (
                    <>
                      {particles.map((p) => (
                        <motion.div
                          key={p.id}
                          initial={{
                            opacity: 1,
                            x: 0,
                            y: 0,
                            scale: 1
                          }}
                          animate={{
                            opacity: 0,
                            x: (p.x - 50) * 4,
                            y: (p.y - 50) * 4 - 100,
                            scale: 0
                          }}
                          transition={{ duration: 1.5, ease: 'easeOut' }}
                          className="absolute w-2 h-2 rounded-full"
                          style={{ backgroundColor: rarityData[revealedRarity].color }}
                        />
                      ))}
                    </>
                  )}
                </AnimatePresence>

                <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                  {phase === 'idle' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center"
                    >
                      <Zap className="w-16 h-16 text-primary mb-3" style={{ filter: 'drop-shadow(0 0 15px #00FFD1)' }} />
                      <span className="text-white font-bold text-lg">AI 卡牌盲盒</span>
                      <span className="text-muted text-sm mt-1">点击下方开启</span>
                    </motion.div>
                  )}

                  {phase === 'shaking' && (
                    <div className="flex flex-col items-center">
                      <Sparkles className="w-16 h-16 text-secondary animate-pulse" />
                      <span className="text-white font-bold text-lg mt-2">抽取中...</span>
                    </div>
                  )}

                  {phase === 'error' && (
                    <div className="flex flex-col items-center text-accent">
                      <Zap className="w-12 h-12 mb-2" />
                      <span className="font-bold text-sm">{errorMsg || '出错了'}</span>
                      <span className="text-xs text-muted mt-1">请重试</span>
                    </div>
                  )}

                  {(phase === 'revealing' || phase === 'revealed') && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0, rotateY: 180 }}
                      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      className="flex flex-col items-center"
                    >
                      <div
                        className="w-24 h-24 rounded-2xl flex items-center justify-center mb-3"
                        style={{
                          background: `linear-gradient(135deg, ${rarityData[revealedRarity].color}40, ${rarityData[revealedRarity].color}10)`,
                          border: `2px solid ${rarityData[revealedRarity].color}`,
                          ...getGlowStyle(revealedRarity)
                        }}
                      >
                        {revealedRarity === 'SSR' ? (
                          <Sparkles className="w-12 h-12" style={{ color: rarityData[revealedRarity].color }} />
                        ) : (
                          <Star className="w-12 h-12" style={{ color: rarityData[revealedRarity].color }} />
                        )}
                      </div>
                      <div
                        className="text-2xl font-bold"
                        style={{
                          color: rarityData[revealedRarity].color,
                          textShadow: `0 0 20px ${rarityData[revealedRarity].color}`
                        }}
                      >
                        {rarityData[revealedRarity].label}
                      </div>
                      <span className="text-white mt-1">恭喜获得!</span>
                    </motion.div>
                  )}
                </div>

                <div
                  className="absolute bottom-0 left-0 right-0 h-1"
                  style={{
                    background: 'linear-gradient(90deg, #00FFD1, #BF00FF, #FF006E)'
                  }}
                />
              </div>
            </motion.div>

            <div className="flex gap-4 mt-8">
              {phase === 'idle' && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    drawCard();
                  }}
                  className="btn-neon btn-neon-primary text-base px-8 py-3"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  开启盲盒 (100 积分)
                </motion.button>
              )}

              {phase === 'revealed' && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      drawCard();
                    }}
                    className="btn-neon btn-neon-secondary"
                  >
                    再开一次
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    className="btn-neon"
                    style={{ background: '#2A2A38', color: '#FFFFFF' }}
                  >
                    关闭
                  </motion.button>
                </>
              )}
            </div>

            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 text-xs text-muted">
              {(['SSR', 'SR', 'R', 'N'] as Rarity[]).map((r) => (
                <span
                  key={r}
                  className={`flex items-center gap-1 ${phase === 'revealed' && revealedRarity === r ? 'font-bold' : ''}`}
                  style={{
                    color: phase === 'revealed' && revealedRarity === r ? rarityData[r].color : undefined
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: rarityData[r].color }}
                  />
                  {r} ({rarityData[r].probability}%)
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
