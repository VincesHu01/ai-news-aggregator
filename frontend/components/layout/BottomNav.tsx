'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Archive, Bookmark, Newspaper, Settings } from 'lucide-react';

const items = [
  { href: '/news', icon: Newspaper, label: '简报' },
  { href: '/push-history', icon: Archive, label: '往期' },
  { href: '/bookmarks', icon: Bookmark, label: '收藏' },
  { href: '/settings', icon: Settings, label: '设置' },
];

export default function BottomNav() {
  const pathname = usePathname();
  return <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#dedacf] bg-[#f7f5ef]/95 backdrop-blur lg:hidden"><div className="flex h-16 items-center justify-around">{items.map((item) => {
    const active = pathname?.startsWith(item.href);
    return <Link key={item.href} href={item.href} className={`flex min-w-16 flex-col items-center gap-1 text-xs ${active ? 'text-[#285b40]' : 'text-[#78847d]'}`}><item.icon className="h-5 w-5" /><span>{item.label}</span></Link>;
  })}</div></nav>;
}
