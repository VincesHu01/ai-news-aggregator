'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUpRight, BookOpen, Orbit, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { NewsCard } from '@/lib/types';
import { getAnalysisSections, getStoryTheme } from '@/lib/story-theme';

export default function StoryScene({ card, index, total }: { card: NewsCard; index: number; total: number }) {
  const theme = getStoryTheme(card);
  const sections = getAnalysisSections(card);
  const style = { '--story-accent': theme.accent, '--story-secondary': theme.secondary, '--story-ink': theme.ink } as CSSProperties;
  const tag = card.interest_tags?.[0] || '行业现场';

  return (
    <section className={`story-scene world-${theme.world}`} style={style}>
      {card.cover_image ? <Image src={card.cover_image} alt="" fill priority={index === 0} sizes="100vw" className="story-cover" /> : null}
      <div className="story-veil" />
      <div className="story-grain" />
      <div className="story-orbit orbit-a" /><div className="story-orbit orbit-b" />
      <motion.div className="story-number" initial={{ opacity: 0 }} whileInView={{ opacity: .16 }} viewport={{ once: true }}>{String(index + 1).padStart(2, '0')}</motion.div>

      <div className="story-content">
        <motion.div initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ amount: .35 }} transition={{ duration: .7 }}>
          <div className="story-kicker"><span>{theme.label}</span><i /> <span>{index + 1} / {total}</span></div>
          <div className="story-meta"><span>{tag}</span><span>{card.source}</span><span>{theme.atmosphere}</span></div>
          <h1>{card.title}</h1>
          <p className="story-deck">{card.summary}</p>
          <div className="story-actions">
            <Link href={`/news/${card.id}`} className="story-primary"><Sparkles />进入这条新闻的世界</Link>
            <a href={card.source_url} target="_blank" rel="noopener noreferrer" className="story-secondary">第一手信源<ArrowUpRight /></a>
          </div>
        </motion.div>

        <motion.aside className="story-intel" initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ amount: .35 }} transition={{ delay: .18 }}>
          <div className="intel-heading"><Orbit />情报切片</div>
          {(card.key_facts || []).slice(0, 3).map((fact, i) => <p key={fact}><b>0{i + 1}</b>{fact}</p>)}
          <div className="intel-signal"><BookOpen /><span>{sections[0]?.thesis || card.why_it_matters}</span></div>
        </motion.aside>
      </div>
      <div className="story-footer"><span>视觉导演：本地模型 · {theme.motif}</span>{index < total - 1 ? <span className="story-scroll">继续下潜 <ArrowDown /></span> : <span>本期终章</span>}</div>
    </section>
  );
}
