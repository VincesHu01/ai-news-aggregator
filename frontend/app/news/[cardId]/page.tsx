'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, BriefcaseBusiness, CheckCircle2, Loader2 } from 'lucide-react';

import type { NewsCard } from '@/lib/types';
import { getNewsCard } from '@/lib/api';

export default function NewsDetailPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const [card, setCard] = useState<NewsCard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getNewsCard(cardId).then(setCard).catch((err) => setError(err?.message || '加载失败'));
  }, [cardId]);

  if (error) return <main className="min-h-screen bg-[#f7f5ef] p-8 text-center text-red-700">{error}<div className="mt-5"><Link href="/news" className="underline">返回资讯</Link></div></main>;
  if (!card) return <main className="flex min-h-screen items-center justify-center bg-[#f7f5ef]"><Loader2 className="h-8 w-8 animate-spin text-[#285b40]" /></main>;

  const tag = card.interest_tags?.[0] || card.category || '行业动态';
  return (
    <main className="min-h-screen bg-[#f7f5ef] pb-20 text-[#17241d]">
      <header className="sticky top-0 z-20 border-b border-[#dedacf] bg-[#f7f5ef]/95 backdrop-blur"><div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4"><Link href="/news" className="flex items-center gap-2 text-sm font-semibold text-[#526158]"><ArrowLeft className="h-4 w-4" />返回简报</Link><a href={card.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full bg-[#285b40] px-4 py-2 text-sm font-semibold text-white">阅读原文<ArrowUpRight className="h-4 w-4" /></a></div></header>

      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#6d7d72]"><span className="rounded-full bg-[#dfeadf] px-3 py-1 text-[#285b40]">{tag}</span><span>{card.source}</span><span>{card.published_at ? new Date(card.published_at).toLocaleDateString('zh-CN') : ''}</span></div>
        <h1 className="font-serif text-4xl font-semibold leading-tight sm:text-5xl">{card.title}</h1>
        <p className="mt-6 text-lg leading-9 text-[#526158]">{card.summary}</p>

        <div className="relative my-10 aspect-[16/8] overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#e9e2d2,#c9d9ce)]">
          {card.cover_image ? <Image src={card.cover_image} alt="" fill priority sizes="(max-width: 896px) 100vw, 896px" className="object-cover" /> : <div className="flex h-full items-end p-8 font-serif text-4xl text-[#285b40]/70">NEXUS / {tag}</div>}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Section icon={<CheckCircle2 />} title="关键事实">
            {card.key_facts?.length ? <ul className="space-y-3">{card.key_facts.map((fact) => <li key={fact}>• {fact}</li>)}</ul> : <p>原始材料暂未提供更多可核实细节。</p>}
          </Section>
          <Section icon={<BookOpen />} title="背景与来龙去脉"><p>{card.background || '这条资讯暂时没有额外背景说明，可通过原文继续查证。'}</p></Section>
          <Section icon={<BookOpen />} title="术语小词典">
            {card.glossary?.length ? <dl className="space-y-4">{card.glossary.map((item) => <div key={item.term}><dt className="font-bold text-[#294a38]">{item.term}</dt><dd className="mt-1">{item.explanation}</dd></div>)}</dl> : <p>本条资讯没有必须额外解释的专业术语。</p>}
          </Section>
          <Section icon={<BriefcaseBusiness />} title="为什么重要 / 求职视角"><p>{card.why_it_matters || '关注它对行业结构和岗位需求的后续影响。'}</p>{card.career_lens && <p className="mt-4 border-t border-stone-200 pt-4"><strong>求职启示：</strong>{card.career_lens}</p>}</Section>
        </div>

        <div className="mt-10 rounded-2xl border border-[#ccd8cf] bg-[#eaf1eb] p-6"><h2 className="font-serif text-2xl font-semibold">回到第一手信息</h2><p className="mt-2 text-sm leading-7 text-[#526158]">摘要帮助你建立框架，但重要判断仍应回到原始公告、研究论文或报道。NEXUS 不用价值分替你下结论。</p><a href={card.source_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 font-bold text-[#285b40]">打开 {card.source} 原文<ArrowUpRight className="h-4 w-4" /></a></div>
      </article>
    </main>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-stone-200 bg-white p-6 text-[15px] leading-7 text-[#526158]"><div className="mb-4 flex items-center gap-2 font-serif text-xl font-semibold text-[#263a30]"><span className="[&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-[#49745b]">{icon}</span>{title}</div>{children}</section>;
}
