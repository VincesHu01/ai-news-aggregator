'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import Sidebar from '@/components/layout/Sidebar';
import NewsCard from '@/components/card/NewsCard';
import type { NewsCard as NewsCardType, ReadingResponse } from '@/lib/types';
import { getNews, isAuthenticated } from '@/lib/api';

const categories = ['all', 'hot', 'tech', 'business', 'finance', 'academic'];
const categoryLabels: Record<string, string> = {
  all: '全部',
  hot: '🔥 热门',
  tech: '⚡ 技术',
  business: '💼 商业',
  finance: '📈 财经',
  academic: '🎓 学术',
};

export default function NewsPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isAnimating, setIsAnimating] = useState(false);
  const [newsList, setNewsList] = useState<NewsCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<{ points: number; experience: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [-200, 0, 200], [0.5, 1, 0.5]);

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('Fetching news...');
        const data = await getNews(1, 50);
        console.log('News data:', data);
        setNewsList(data.items);
      } catch (e: any) {
        console.error('News error:', e);
        const msg = e?.response?.data?.detail || e.message;
        if (e?.response?.status === 401) {
          setError('请先登录后查看资讯');
        } else {
          setError(msg || '加载失败');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  const filteredNews = activeCategory === 'all'
    ? newsList
    : newsList.filter((n) => n.category === activeCategory);

  const paginatedNews = filteredNews.length > 0 ? filteredNews : newsList;

  const goToNext = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => Math.min(prev + 1, Math.max(0, paginatedNews.length - 1)));
    setTimeout(() => setIsAnimating(false), 400);
  }, [isAnimating, paginatedNews.length]);

  const goToPrev = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
    setTimeout(() => setIsAnimating(false), 400);
  }, [isAnimating]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (isAnimating) return;
      if (e.deltaY > 50) {
        e.preventDefault();
        goToNext();
      } else if (e.deltaY < -50) {
        e.preventDefault();
        goToPrev();
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [goToNext, goToPrev, isAnimating]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        goToPrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev]);

  const handleTouchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    handleTouchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!handleTouchStart.current || isAnimating) return;
    const deltaY = e.changedTouches[0].clientY - handleTouchStart.current.y;
    if (deltaY < -50) {
      goToNext();
    } else if (deltaY > 50) {
      goToPrev();
    }
    handleTouchStart.current = null;
  };

  const handleReward = (resp: ReadingResponse) => {
    setBalance({ points: resp.new_balance, experience: resp.experience_earned });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        activeCategory={activeCategory}
        onCategoryChange={(cat) => {
          setActiveCategory(cat);
          setCurrentIndex(0);
        }}
      />
      <Sidebar />

      <main className="pt-16 lg:pl-64 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">AI 资讯</h1>
              <p className="text-muted text-sm">阅读资讯，获取积分，收集卡牌</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              实时更新中
            </div>
          </div>

          <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 scrollbar-hidden">
            {categories.map((cat) => (
              <motion.button
                key={cat}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setActiveCategory(cat);
                  setCurrentIndex(0);
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeCategory === cat
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-surface text-muted border border-border'
                }`}
              >
                {categoryLabels[cat]}
              </motion.button>
            ))}
          </div>

          <div
            ref={containerRef}
            className="relative h-[calc(100vh-180px)] lg:h-[calc(100vh-200px)] overflow-hidden perspective-1000"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                  <p className="text-muted">加载资讯中...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3 text-center">
                  <p className="text-accent">加载失败: {error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 rounded-lg bg-primary/20 text-primary border border-primary/30"
                  >
                    重试
                  </button>
                </div>
              </div>
            ) : paginatedNews.length > 0 ? (
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, y: 100, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -100, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="absolute inset-0"
                >
                  <NewsCard
                    card={paginatedNews[currentIndex]}
                    index={currentIndex}
                    isActive={true}
                    onSwipe={() => goToNext()}
                    onReward={handleReward}
                  />
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="flex items-center justify-center h-full text-muted">
                暂无资讯
              </div>
            )}

            <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-4 z-20">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={goToPrev}
                disabled={currentIndex === 0}
                className="w-12 h-12 rounded-full glass-card flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:text-primary transition-colors"
              >
                <ChevronUp className="w-6 h-6" />
              </motion.button>
              <span className="text-muted text-sm font-mono">
                {currentIndex + 1} / {paginatedNews.length}
              </span>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={goToNext}
                disabled={currentIndex === paginatedNews.length - 1}
                className="w-12 h-12 rounded-full glass-card flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:text-primary transition-colors"
              >
                <ChevronDown className="w-6 h-6" />
              </motion.button>
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 lg:hidden z-20">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full glass-card">
                {paginatedNews.map((_, idx) => (
                  <motion.div
                    key={idx}
                    animate={{
                      backgroundColor: idx === currentIndex ? '#00FFD1' : '#2A2A38',
                      width: idx === currentIndex ? 20 : 8,
                    }}
                    className="h-1.5 rounded-full transition-all"
                  />
                ))}
              </div>
            </div>

            <div className="absolute bottom-20 right-4 hidden lg:flex flex-col items-center gap-1 z-20">
              {paginatedNews.map((_, idx) => (
                <motion.div
                  key={idx}
                  animate={{
                    backgroundColor: idx === currentIndex ? '#00FFD1' : '#2A2A38',
                    height: idx === currentIndex ? 20 : 8,
                  }}
                  className="w-1.5 rounded-full transition-all cursor-pointer"
                  onClick={() => setCurrentIndex(idx)}
                />
              ))}
            </div>
          </div>

          <div className="lg:hidden mt-4 text-center text-xs text-muted">
            滑动或使用方向键浏览更多资讯
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
