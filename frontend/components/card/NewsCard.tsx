'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, BookOpen, BriefcaseBusiness, CheckCircle2 } from 'lucide-react';

import type { NewsCard as NewsCardType } from '@/lib/types';

interface NewsCardProps {
  card: NewsCardType;
  priority?: boolean;
}

function formatDate(value?: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(value));
}

export default function NewsCard({ card, priority = false }: NewsCardProps) {
  const tag = card.interest_tags?.[0] || card.category || '行业动态';
  return (
    <article className="group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_18px_60px_rgba(43,52,43,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_70px_rgba(43,52,43,0.1)]">
      <div className="relative aspect-[16/8] overflow-hidden bg-[#dce6dc]">
        {card.cover_image ? (
          <Image
            src={card.cover_image}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="absolute inset-0 flex items-end bg-[radial-gradient(circle_at_20%_10%,#d9ede0,transparent_45%),linear-gradient(135deg,#e9e2d2,#c9d9ce)] p-6">
            <span className="font-serif text-3xl font-semibold tracking-tight text-[#284b3b]/80">NEXUS / {tag}</span>
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#28553d] backdrop-blur">{tag}</span>
          <span className="rounded-full bg-[#17241d]/75 px-3 py-1 text-xs text-white backdrop-blur">{formatDate(card.published_at)}</span>
        </div>
      </div>

      <div className="space-y-5 p-6">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#6d7d72]">{card.source}</div>
          <Link href={`/news/${card.id}`}>
            <h2 className="font-serif text-2xl font-semibold leading-snug text-[#17241d] transition group-hover:text-[#28724d]">{card.title}</h2>
          </Link>
          <p className="mt-3 text-[15px] leading-7 text-[#526158]">{card.summary || '暂无摘要'}</p>
        </div>

        {card.key_facts?.length > 0 && (
          <div className="rounded-xl bg-[#f5f3ed] p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wide text-[#365846]">
              <CheckCircle2 className="h-4 w-4" /> 关键事实
            </div>
            <ul className="space-y-2 text-sm leading-6 text-[#526158]">
              {card.key_facts.slice(0, 2).map((fact) => <li key={fact}>• {fact}</li>)}
            </ul>
          </div>
        )}

        {card.why_it_matters && (
          <div className="flex gap-3 border-l-2 border-[#80a88e] pl-4 text-sm leading-6 text-[#526158]">
            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[#3d7554]" />
            <p><strong className="text-[#263a30]">为什么重要：</strong>{card.why_it_matters}</p>
          </div>
        )}

        {card.career_lens && (
          <div className="flex gap-3 border-l-2 border-[#c8a96b] pl-4 text-sm leading-6 text-[#526158]">
            <BriefcaseBusiness className="mt-0.5 h-4 w-4 shrink-0 text-[#987536]" />
            <p><strong className="text-[#263a30]">求职启示：</strong>{card.career_lens}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 pt-4">
          <Link href={`/news/${card.id}`} className="rounded-full bg-[#285b40] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1e4832]">阅读全文与术语解释</Link>
          <a href={card.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-[#365846] hover:border-[#648d72]">
            原始信息源 <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </article>
  );
}
