'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pause, Play, Radio, ShieldCheck } from 'lucide-react';
import DreamNav from '@/components/experience/DreamNav';
import { getDeliveryControl, isAuthenticated, setDeliveryControl } from '@/lib/api';
import type { DeliveryControl } from '@/lib/types';

export default function SettingsPage() {
  const router = useRouter();
  const [control, setControl] = useState<DeliveryControl | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { getDeliveryControl().then(setControl).catch((e) => setMessage(e?.message || '无法连接控制系统')); }, []);
  const toggle = async () => { if (!isAuthenticated()) { router.push('/auth?next=/settings'); return; } if (!control) return; setBusy(true); try { const next = await setDeliveryControl(!control.enabled); setControl(next); setMessage(next.enabled ? '生成与推送已经恢复。' : '所有生成与推送已截停，历史完整保留。'); } catch (e: any) { setMessage(e?.message || '操作失败'); } finally { setBusy(false); } };
  return <main className="dream-library control-room"><DreamNav /><header className="library-hero"><span>NEXUS CONTROL ROOM</span><h1>世界引擎控制台</h1><p>这里不管理积分、等级或卡牌，只管理一件真正重要的事：什么时候让本地模型开始工作。</p></header><section className="control-core"><div className={`control-reactor ${control?.enabled ? 'live' : 'paused'}`}><div><Radio /><span>{control?.enabled ? 'LIVE' : 'SUSPENDED'}</span></div><strong>{control?.enabled ? '世界引擎正在待命' : '世界引擎已经休眠'}</strong><p>{control?.enabled ? '定时任务会抓取新闻，调用本地 Ollama 深度分析，再同步网页和飞书。' : '不会启动 Ollama，不会抓取、生成、同步或推送。已有世界不会被删除。'}</p><button onClick={toggle} disabled={!control || busy}>{busy ? <Loader2 className="animate-spin" /> : control?.enabled ? <Pause /> : <Play />}{control?.enabled ? '立即截停全部生成' : '重新点亮世界引擎'}</button>{message ? <small>{message}</small> : null}</div><aside><ShieldCheck /><h2>本地优先协议</h2><p>所有新闻分析与视觉导演方案都由你电脑上的模型生成。云端只保存结果，不接入付费外部大模型。</p><ul><li>开关关闭时，定时任务在模型启动前终止</li><li>网页与飞书共享同一个总开关</li><li>恢复后从下一次任务继续，不清空历史</li></ul></aside></section></main>;
}
