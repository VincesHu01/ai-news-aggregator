'use client';

import Link from 'next/link';
import { Archive, BookOpenText, LogIn, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isAuthenticated } from '@/lib/api';

export default function Header({ showSearch: _showSearch = true }: { showSearch?: boolean }) {
  const [authed, setAuthed] = useState(false);
  useEffect(() => setAuthed(isAuthenticated()), []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#dedacf] bg-[#f7f5ef]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        <Link href="/news" className="flex items-center gap-3 text-[#17241d]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#285b40] text-white"><BookOpenText className="h-5 w-5" /></span>
          <span><strong className="font-serif text-lg">NEXUS</strong><small className="ml-2 hidden text-xs tracking-wide text-[#708078] sm:inline">行业知识简报</small></span>
        </Link>
        <nav className="flex items-center gap-2 text-sm font-semibold text-[#526158]">
          <Link href="/news" className="rounded-full px-3 py-2 hover:bg-white">今日资讯</Link>
          <Link href="/push-history" className="hidden items-center gap-1.5 rounded-full px-3 py-2 hover:bg-white sm:flex"><Archive className="h-4 w-4" />往期</Link>
          <Link href={authed ? '/settings' : '/auth?next=/news'} className="flex items-center gap-1.5 rounded-full border border-[#c8c3b8] bg-white px-3 py-2 hover:border-[#74917f]">
            {authed ? <User className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}{authed ? '设置' : '登录'}
          </Link>
        </nav>
      </div>
    </header>
  );
}
