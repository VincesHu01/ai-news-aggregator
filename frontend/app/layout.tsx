import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'NEXUS - 行业知识简报',
  description: '用事实摘要、背景知识、术语解释和求职视角读懂 AI、商业与国际资讯。',
  keywords: ['AI', '行业研究', '知识简报', '新闻解读', 'NEXUS'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#f7f5ef',
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={inter.variable}>
      <head>
        <meta name="theme-color" content="#f7f5ef" />
      </head>
      <body className="antialiased">
        <div className="min-h-screen bg-background">
          {children}
        </div>
      </body>
    </html>
  );
}
