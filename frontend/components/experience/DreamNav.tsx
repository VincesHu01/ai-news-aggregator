'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Archive, Bookmark, Compass, Settings } from 'lucide-react';

const links = [
  { href: '/news', label: '今日世界', icon: Compass },
  { href: '/push-history', label: '往期宇宙', icon: Archive },
  { href: '/bookmarks', label: '私人星图', icon: Bookmark },
  { href: '/settings', label: '控制台', icon: Settings },
];

export default function DreamNav() {
  const pathname = usePathname();
  return (
    <nav className="dream-nav" aria-label="主导航">
      <Link href="/news" className="dream-brand"><span>N</span><strong>NEXUS</strong></Link>
      <div className="dream-nav-links">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={pathname === href ? 'active' : ''} title={label}>
            <Icon aria-hidden="true" /><span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
