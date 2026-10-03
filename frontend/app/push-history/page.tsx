'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import DreamNav from '@/components/experience/DreamNav';
import DreamCollection from '@/components/experience/DreamCollection';
import { getNews } from '@/lib/api';
import type { NewsCard } from '@/lib/types';

export default function ArchivePage() {
  const [stories, setStories] = useState<NewsCard[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getNews(1, 100).then((result) => setStories(result.items)).finally(() => setLoading(false)); }, []);
  return <main className="dream-library"><DreamNav /><header className="library-hero"><span>THE INFINITE ARCHIVE</span><h1>往期宇宙</h1><p>每条新闻都是被封存的一整个世界。沿着时间向后走，重新进入当时的技术、资本、制度与人的选择。</p></header>{loading ? <div className="dream-loading"><Loader2 className="animate-spin" /></div> : <DreamCollection stories={stories} empty="档案馆还没有收录世界" />}</main>;
}
