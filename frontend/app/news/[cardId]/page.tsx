'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight, Bookmark, Check, ChevronDown, Compass, Loader2, Orbit, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import DreamNav from '@/components/experience/DreamNav';
import type { NewsCard } from '@/lib/types';
import { getNewsCard, isBookmarked, toggleBookmark } from '@/lib/api';
import { getAnalysisSections, getStoryTheme } from '@/lib/story-theme';

export default function NewsDetailPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const [card, setCard] = useState<NewsCard | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { getNewsCard(cardId).then((item) => { setCard(item); setSaved(isBookmarked(item.id)); }).catch((err) => setError(err?.message || '加载失败')); }, [cardId]);
  const theme = useMemo(() => card ? getStoryTheme(card) : null, [card]);
  if (error) return <main className="dream-empty"><h1>{error}</h1><Link href="/news">返回今日世界</Link></main>;
  if (!card || !theme) return <main className="dream-loading"><Loader2 className="animate-spin" /><span>世界正在展开…</span></main>;

  const sections = getAnalysisSections(card);
  const style = { '--story-accent': theme.accent, '--story-secondary': theme.secondary, '--story-ink': theme.ink } as CSSProperties;
  const tag = card.interest_tags?.[0] || '行业现场';
  return (
    <main className={`story-dossier world-${theme.world}`} style={style}>
      <DreamNav />
      <section className="dossier-hero">
        {card.cover_image ? <Image src={card.cover_image} alt="" fill priority sizes="100vw" className="story-cover" /> : null}
        <div className="story-veil" /><div className="story-grain" /><div className="story-orbit orbit-a" /><div className="story-orbit orbit-b" />
        <div className="dossier-top"><Link href="/news"><ArrowLeft />返回新闻宇宙</Link><button onClick={() => setSaved(toggleBookmark(card.id))}>{saved ? <Check /> : <Bookmark />}{saved ? '已加入私人星图' : '收藏这颗星'}</button></div>
        <motion.div className="dossier-title" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8 }}>
          <div className="story-kicker"><span>{theme.label}</span><i /><span>{tag}</span></div>
          <h1>{card.title}</h1><p>{card.summary}</p>
          <div className="dossier-source"><span>{card.source}</span><a href={card.source_url} target="_blank" rel="noopener noreferrer">阅读第一手原文<ArrowUpRight /></a></div>
        </motion.div>
        <a href="#deep-dive" className="descent">向深处阅读<ChevronDown /></a>
      </section>

      <section id="deep-dive" className="dossier-body">
        <header className="chapter-intro"><span>DEEP READING PROTOCOL</span><h2>不止告诉你发生了什么，<br />还要解释世界为何这样运转。</h2><p>{card.visual_direction?.scene_prompt || `本地模型把这条新闻导演成「${theme.atmosphere}」，用${theme.motif}承载它的逻辑。`}</p></header>
        <div className="fact-constellation">{(card.key_facts || []).map((fact, index) => <motion.article key={fact} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}><b>FACT {String(index + 1).padStart(2, '0')}</b><p>{fact}</p></motion.article>)}</div>
        <div className="analysis-chapters">{sections.map((section, index) => <motion.article key={`${section.title}-${index}`} initial={{ opacity: 0, y: 45 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .2 }}><div className="chapter-index">{String(index + 1).padStart(2, '0')}</div><div><span>ANALYSIS CHAPTER</span><h3>{section.title}</h3>{section.thesis ? <blockquote>{section.thesis}</blockquote> : null}<p>{section.explanation}</p>{section.evidence ? <aside><strong>证据锚点</strong>{section.evidence}</aside> : null}{section.implication ? <aside><strong>继续推演</strong>{section.implication}</aside> : null}</div></motion.article>)}</div>
        {card.timeline?.length ? <section className="timeline-river"><header><Orbit /><span>时间河流</span></header>{card.timeline.map((item, index) => <article key={`${item.label}-${index}`}><time>{item.label}</time><div><h3>{item.title}</h3><p>{item.description}</p></div></article>)}</section> : null}
        {card.stakeholders?.length ? <section className="stakeholder-orbit"><header><Compass /><span>利益关系星图</span></header><div>{card.stakeholders.map((item) => <article key={item.name}><h3>{item.name}</h3><b>{item.role}</b><p>{item.impact}</p></article>)}</div></section> : null}
        <section className="knowledge-vault"><div><span>CONTEXT VAULT</span><h2>背景与术语不是脚注，<br />它们决定你能看多深。</h2><p>{card.background || '旧记录暂未生成完整背景。下一批新闻将由本地模型扩展为不定长的历史与行业脉络。'}</p></div><dl>{card.glossary?.length ? card.glossary.map((item) => <div key={item.term}><dt>{item.term}</dt><dd>{item.explanation}</dd></div>) : <div><dt>继续查证</dt><dd>原始材料中没有需要单列的术语；可回到第一手信息核对事实。</dd></div>}</dl></section>
        <section className="career-portal"><Sparkles /><span>CAREER TRANSLATION</span><h2>把新闻变成面试中的判断力</h2><p>{card.career_lens || '尝试从这条新闻中识别岗位、技能、组织变化与新的业务约束。'}</p><a href={card.source_url} target="_blank" rel="noopener noreferrer">带着问题回到原文<ArrowUpRight /></a></section>
      </section>
    </main>
  );
}
