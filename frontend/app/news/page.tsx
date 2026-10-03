'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, PauseCircle, PlayCircle, Search, ShieldCheck } from 'lucide-react';

import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import NewsCard from '@/components/card/NewsCard';
import type { DeliveryControl, NewsCard as NewsCardType } from '@/lib/types';
import { getDeliveryControl, getNews, isAuthenticated, setDeliveryControl } from '@/lib/api';

const categories = ['全部', 'AI产业', '金融商业', '宏观国际'];

export default function NewsPage() {
  const router = useRouter();
  const [news, setNews] = useState<NewsCardType[]>([]);
  const [control, setControl] = useState<DeliveryControl | null>(null);
  const [category, setCategory] = useState('全部');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getNews(1, 50), getDeliveryControl()])
      .then(([result, status]) => {
        setNews(result.items);
        setControl(status);
      })
      .catch((err) => setError(err?.message || '资讯加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => news.filter((item) => {
    const inCategory = category === '全部' || item.category === category;
    const text = `${item.title} ${item.summary || ''} ${item.source}`.toLowerCase();
    return inCategory && text.includes(query.trim().toLowerCase());
  }), [news, category, query]);

  const toggleDelivery = async () => {
    if (!isAuthenticated()) {
      router.push('/auth?next=/news');
      return;
    }
    if (!control) return;
    setToggling(true);
    setError('');
    try {
      setControl(await setDeliveryControl(!control.enabled));
    } catch (err: any) {
      setError(err?.message || '开关更新失败');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#17241d]">
      <Header showSearch={false} />
      <Sidebar />
      <main className="min-h-screen pb-24 pt-20 lg:pl-64 lg:pb-12">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
          <section className="mb-8 overflow-hidden rounded-3xl border border-[#d9d4c8] bg-[#17241d] p-6 text-white sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#a8c8b3]">
                  <ShieldCheck className="h-4 w-4" /> NEXUS KNOWLEDGE BRIEF
                </div>
                <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-5xl">少刷信息，多理解行业。</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[#c7d2ca] sm:text-base">精选硬核来源，用事实摘要、背景知识、术语解释与求职视角，帮助你真正读懂一条新闻。</p>
              </div>
              <button
                onClick={toggleDelivery}
                disabled={!control || toggling}
                className={`inline-flex min-w-44 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition disabled:opacity-60 ${control?.enabled ? 'bg-[#f0c66e] text-[#2c2415] hover:bg-[#f5d58e]' : 'bg-[#9fd2b2] text-[#173523] hover:bg-[#b7dec5]'}`}
              >
                {toggling ? <Loader2 className="h-4 w-4 animate-spin" /> : control?.enabled ? <PauseCircle className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />}
                {control?.enabled ? '暂停全部更新与推送' : '恢复更新与推送'}
              </button>
            </div>
            {control && <p className="mt-4 text-xs text-[#a8b8ad]">当前状态：{control.enabled ? '运行中。定时任务会使用本地模型生成并推送。' : '已截停。历史内容仍可正常阅读，不会消耗本地模型。'}</p>}
          </section>

          <section className="mb-8 flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2 overflow-x-auto">
              {categories.map((item) => (
                <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${category === item ? 'bg-[#285b40] text-white' : 'bg-[#f3f1eb] text-[#58675d] hover:bg-[#e8eee9]'}`}>{item}</button>
              ))}
            </div>
            <label className="flex min-w-64 items-center gap-2 rounded-full border border-stone-300 bg-[#faf9f6] px-4 py-2.5">
              <Search className="h-4 w-4 text-[#6d7d72]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索主题、公司或来源" className="w-full bg-transparent text-sm outline-none placeholder:text-[#9a9f9b]" />
            </label>
          </section>

          {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {loading ? (
            <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#285b40]" /></div>
          ) : filtered.length ? (
            <div className="grid gap-7 xl:grid-cols-2">
              {filtered.map((item, index) => <NewsCard key={item.id} card={item} priority={index < 2} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-[#6d7d72]">没有匹配的资讯。调整搜索条件，或恢复更新后等待下一期简报。</div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
