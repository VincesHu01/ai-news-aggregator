'use client';

import { motion } from 'framer-motion';
import { Star, Sparkles, Lock } from 'lucide-react';
import { useState } from 'react';
import type { CardItem, CardSeries, Rarity } from '@/lib/types';

const rarityConfig: Record<string, { color: string; label: string; glow: string }> = {
  SSR: { color: '#FF00FF', label: 'SSR', glow: 'rainbow' },
  SR: { color: '#FFD700', label: 'SR', glow: 'gold' },
  R: { color: '#00BFFF', label: 'R', glow: 'blue' },
  N: { color: '#FFFFFF', label: 'N', glow: 'white' }
};

interface CardCollectionProps {
  cards: CardItem[];
  series: CardSeries[];
  onSeriesFilter?: (seriesId: string | null) => void;
}

export default function CardCollection({ cards, series, onSeriesFilter }: CardCollectionProps) {
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);
  const [activeSeries, setActiveSeries] = useState<string | null>(null);

  const filteredCards = activeSeries
    ? cards.filter((c) => c.series === activeSeries)
    : cards;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">卡牌收藏</h2>
          <p className="text-muted text-sm mt-1">
            共 {cards.length} 张卡牌 · {series.filter((s) => s.completed).length}/{series.length} 系列完成
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="btn-neon btn-neon-secondary"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          抽取新卡
        </motion.button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hidden">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setActiveSeries(null);
            onSeriesFilter?.(null);
          }}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
            activeSeries === null
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'bg-surface text-muted border border-border hover:text-white'
          }`}
        >
          全部
        </motion.button>
        {series.map((s) => (
          <motion.button
            key={s.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setActiveSeries(s.id);
              onSeriesFilter?.(s.id);
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              activeSeries === s.id
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-surface text-muted border border-border hover:text-white'
            }`}
          >
            {s.name}
            {s.completed && <Star className="w-3 h-3 inline ml-1 text-accent" />}
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredCards.map((card, index) => {
          const config = rarityConfig[card.rarity] || rarityConfig.N;
          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, scale: 0.8, rotateY: -30 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              transition={{ delay: index * 0.05, type: 'spring', stiffness: 200 }}
              whileHover={{ scale: 1.05, y: -5 }}
              onClick={() => setSelectedCard(card)}
              className="relative cursor-pointer group"
            >
              <div
                className={`aspect-[3/4] rounded-xl overflow-hidden relative ${
                  card.isNew ? 'animate-neon-glow' : ''
                }`}
                style={{
                  background: `linear-gradient(145deg, #1A1A24 0%, #252530 100%)`,
                  border: `2px solid ${config.color}`,
                  boxShadow: `0 0 15px ${config.color}40, inset 0 0 15px ${config.color}10`
                }}
              >
                <div
                  className="absolute top-0 right-0 px-2 py-1 rounded-bl-lg text-xs font-bold"
                  style={{ backgroundColor: config.color, color: '#0A0A0F' }}
                >
                  {config.label}
                </div>

                {card.rarity === 'SSR' && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'conic-gradient(from 0deg, #FF00FF, #00FFFF, #FFFF00, #FF00FF)',
                      opacity: 0.2
                    }}
                  />
                )}

                <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                  <div
                    className="w-16 h-16 rounded-full mb-3 flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${config.color}40, ${config.color}20)`,
                      border: `1px solid ${config.color}60`
                    }}
                  >
                    <Sparkles className="w-8 h-8" style={{ color: config.color }} />
                  </div>
                  <h3 className="text-sm font-bold text-white leading-tight mb-1 line-clamp-2">
                    {card.name}
                  </h3>
                  <p className="text-xs text-muted line-clamp-2">{card.description}</p>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">{card.series}</span>
                    <span className="text-muted">
                      {new Date(card.obtainedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {Array.from({ length: Math.max(0, 20 - filteredCards.length) }).map((_, i) => (
          <motion.div
            key={`empty-${i}`}
            whileHover={{ scale: 1.02 }}
            className="aspect-[3/4] rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-muted hover:text-white transition-colors cursor-pointer"
          >
            <Lock className="w-8 h-8 mb-2" />
            <span className="text-xs">未解锁</span>
          </motion.div>
        ))}
      </div>

      {selectedCard && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedCard(null)}
        >
          <motion.div
            initial={{ scale: 0.5, rotateY: -180 }}
            animate={{ scale: 1, rotateY: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card rounded-2xl p-6 max-w-sm w-full"
            style={{
              borderColor: rarityConfig[selectedCard.rarity].color,
              boxShadow: `0 0 30px ${rarityConfig[selectedCard.rarity].color}60`
            }}
          >
            <div className="flex flex-col items-center text-center">
              <div
                className="w-32 h-32 rounded-2xl mb-4 flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${rarityConfig[selectedCard.rarity].color}40, ${rarityConfig[selectedCard.rarity].color}10)`,
                  border: `2px solid ${rarityConfig[selectedCard.rarity].color}`
                }}
              >
                <Sparkles
                  className="w-16 h-16"
                  style={{ color: rarityConfig[selectedCard.rarity].color }}
                />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">{selectedCard.name}</h3>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="px-2 py-0.5 rounded text-xs font-bold"
                  style={{
                    backgroundColor: rarityConfig[selectedCard.rarity].color,
                    color: '#0A0A0F'
                  }}
                >
                  {rarityConfig[selectedCard.rarity].label}
                </span>
                <span className="text-sm text-muted">{selectedCard.series}</span>
              </div>
              <p className="text-muted text-sm mb-4">{selectedCard.description}</p>
              <div className="flex items-center gap-4 text-sm text-muted">
                <span>获得时间</span>
                <span>{new Date(selectedCard.obtainedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="btn-neon btn-neon-secondary"
                >
                  分享
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="btn-neon btn-neon-accent"
                >
                  赠送好友
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}