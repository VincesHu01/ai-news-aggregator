import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'NEXUS AI - AI 新闻聚合',
  description: 'AI 新闻聚合平台，阅读资讯获取积分，收集卡牌，参与预测市场',
  keywords: ['AI', 'Artificial Intelligence', 'News', 'Aggregator', 'NEXUS'],
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={inter.variable}>
      <head>
        <meta name="theme-color" content="#0A0A0F" />
      </head>
      <body className="antialiased">
        <div className="min-h-screen bg-background">
          {children}
        </div>
      </body>
    </html>
  );
}