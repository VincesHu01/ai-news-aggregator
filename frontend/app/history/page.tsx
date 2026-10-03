'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import DreamNav from '@/components/experience/DreamNav';
import DreamCollection from '@/components/experience/DreamCollection';
import { getReadingHistory, isAuthenticated } from '@/lib/api';
import type { NewsCard } from '@/lib/types';

export default function ReadingHistoryPage() {
  const [stories, setStories] = useState<NewsCard[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (!isAuthenticated()) { setLoading(false); return; } getReadingHistory(1, 100).then((result) => setStories(result.items)).finally(() => setLoading(false)); }, []);
  return <main className="dream-library memory-river"><DreamNav /><header className="library-hero"><span>MEMORY RIVER</span><h1>阅读回声</h1><p>你读过的世界不会消失。它们在这里汇成一条时间河流，等待被重新理解。</p></header>{loading ? <div className="dream-loading"><Loader2 className="animate-spin" /></div> : <DreamCollection stories={stories} empty="还没有留下阅读足迹" />}</main>;
}
