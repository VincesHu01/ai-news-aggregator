'use client';

import { useEffect, useState } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import DreamNav from '@/components/experience/DreamNav';
import StoryScene from '@/components/experience/StoryScene';
import { getDeliveryControl, getNews, isAuthenticated, setDeliveryControl } from '@/lib/api';
import type { DeliveryControl, NewsCard } from '@/lib/types';

export default function NewsPage() {
  const router = useRouter();
  const [stories, setStories] = useState<NewsCard[]>([]);
  const [control, setControl] = useState<DeliveryControl | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getNews(1, 50), getDeliveryControl()])
      .then(([result, status]) => { setStories(result.items); setControl(status); })
      .catch((err) => setError(err?.message || '资讯世界暂时无法连接'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async () => {
    if (!isAuthenticated()) { router.push('/auth?next=/news'); return; }
    if (!control) return;
    setToggling(true);
    try { setControl(await setDeliveryControl(!control.enabled)); }
    catch (err: any) { setError(err?.message || '开关更新失败'); }
    finally { setToggling(false); }
  };

  return (
    <main className="dream-root">
      <DreamNav />
      <button className={`world-control ${control?.enabled ? 'is-live' : 'is-paused'}`} onClick={toggle} disabled={!control || toggling}>
        {toggling ? <Loader2 className="animate-spin" /> : control?.enabled ? <Pause /> : <Play />}
        <span>{control?.enabled ? '截停生成与推送' : '恢复生成与推送'}</span>
      </button>
      {error ? <div className="dream-error">{error}</div> : null}
      {loading ? <div className="dream-loading"><Loader2 className="animate-spin" /><span>正在校准新闻宇宙…</span></div> : null}
      {!loading && stories.length === 0 ? <div className="dream-empty"><span>NO SIGNAL</span><h1>情报宇宙正在休眠</h1><p>历史仍被保留。恢复推送后，本地模型会为下一条新闻建造全新的世界。</p></div> : null}
      <div className="story-feed">{stories.map((story, index) => <StoryScene key={story.id} card={story} index={index} total={stories.length} />)}</div>
    </main>
  );
}
