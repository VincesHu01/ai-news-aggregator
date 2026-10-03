'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import type { NewsCard } from '@/lib/types';
import { getStoryTheme } from '@/lib/story-theme';

export default function DreamCollection({ stories, empty }: { stories: NewsCard[]; empty: string }) {
  if (!stories.length) return <div className="collection-empty"><Sparkles /><h2>{empty}</h2><p>这里会保存你曾经抵达过的新闻世界。</p><Link href="/news">返回今日世界</Link></div>;
  return <div className="dream-collection">{stories.map((card, index) => {
    const theme = getStoryTheme(card);
    return <Link href={`/news/${card.id}`} key={card.id} className={`collection-story world-${theme.world}`} style={{ '--story-accent': theme.accent, '--story-secondary': theme.secondary } as React.CSSProperties}>
      {card.cover_image ? <Image src={card.cover_image} alt="" fill sizes="(max-width: 900px) 100vw, 50vw" className="collection-cover" /> : null}
      <div className="collection-veil" /><span className="collection-index">{String(index + 1).padStart(2, '0')}</span>
      <div className="collection-copy"><span>{card.interest_tags?.[0] || theme.atmosphere}</span><h2>{card.title}</h2><p>{card.summary}</p><div>{card.source}<ArrowUpRight /></div></div>
    </Link>;
  })}</div>;
}
