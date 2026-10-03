'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import DreamNav from '@/components/experience/DreamNav';
import DreamCollection from '@/components/experience/DreamCollection';
import { getBookmarkIds, getNewsCard } from '@/lib/api';
import type { NewsCard } from '@/lib/types';

export default function BookmarksPage() {
  const [stories, setStories] = useState<NewsCard[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { Promise.all(getBookmarkIds().map((id) => getNewsCard(id).catch(() => null))).then((items) => setStories(items.filter((item): item is NewsCard => Boolean(item)))).finally(() => setLoading(false)); }, []);
  return <main className="dream-library private-map"><DreamNav /><header className="library-hero"><span>YOUR PRIVATE CONSTELLATION</span><h1>私人星图</h1><p>不是收藏夹，而是你亲手标记的知识坐标。每一次保存，都在画出你的职业兴趣与认知边界。</p></header>{loading ? <div className="dream-loading"><Loader2 className="animate-spin" /></div> : <DreamCollection stories={stories} empty="你的星图仍是一片未命名的夜空" />}</main>;
}
