'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Archive, Bookmark, History, Newspaper, Settings } from 'lucide-react';

const items = [
  { href: '/news', icon: Newspaper, label: '知识简报', detail: '摘要与深度解读' },
  { href: '/push-history', icon: Archive, label: '往期推送', detail: '保留所有历史记录' },
  { href: '/bookmarks', icon: Bookmark, label: '稍后阅读', detail: '收藏重要内容' },
  { href: '/history', icon: History, label: '阅读记录', detail: '回顾已读文章' },
  { href: '/settings', icon: Settings, label: '设置', detail: '推送与账号控制' },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed bottom-0 left-0 top-16 hidden w-64 border-r border-[#dedacf] bg-[#f1eee6] lg:block">
      <div className="p-5">
        <div className="mb-5 px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#829087]">阅读工作台</div>
        <nav className="space-y-2">
          {items.map((item) => {
            const active = pathname?.startsWith(item.href);
            return <Link key={item.href} href={item.href} className={`flex gap-3 rounded-xl p-3 transition ${active ? 'bg-white text-[#285b40] shadow-sm' : 'text-[#65736b] hover:bg-white/70'}`}>
              <item.icon className="mt-0.5 h-5 w-5 shrink-0" />
              <span><strong className="block text-sm">{item.label}</strong><small className="mt-0.5 block text-xs font-normal text-[#8a948e]">{item.detail}</small></span>
            </Link>;
          })}
        </nav>
      </div>
      <div className="absolute inset-x-5 bottom-6 rounded-xl border border-[#d9d4c8] bg-[#faf9f5] p-4 text-xs leading-5 text-[#6b776f]">没有积分、等级或抽卡。NEXUS 只记录内容与阅读历史。</div>
    </aside>
  );
}
