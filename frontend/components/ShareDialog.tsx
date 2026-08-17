'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Share2, MessageCircle, Link as LinkIcon, Globe, Loader2 } from 'lucide-react';
import { generateShareLink } from '@/lib/api';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'news' | 'prediction' | 'card';
  targetId: string;
  title: string;
}

export default function ShareDialog({
  isOpen,
  onClose,
  targetType,
  targetId,
  title,
}: ShareDialogProps) {
  const [shareUrl, setShareUrl] = useState('');
  const [clickCount, setClickCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [wechatHint, setWechatHint] = useState(false);

  const fetchShareLink = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    setError(null);
    setCopied(false);
    setWechatHint(false);
    try {
      const data = await generateShareLink(targetType, targetId);
      setShareUrl(data.share_url);
      setClickCount(data.click_count ?? 0);
    } catch (err) {
      console.error('Failed to generate share link:', err);
      setError('生成分享链接失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId]);

  useEffect(() => {
    if (isOpen) {
      fetchShareLink();
    } else {
      setShareUrl('');
      setClickCount(0);
      setError(null);
      setCopied(false);
      setWechatHint(false);
    }
  }, [isOpen, fetchShareLink]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      const input = document.getElementById('share-url-input') as HTMLInputElement | null;
      if (input) {
        input.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setError('复制失败，请手动复制');
        }
      }
    }
  };

  const handleWechat = () => {
    handleCopy();
    setWechatHint(true);
    setTimeout(() => setWechatHint(false), 5000);
  };

  const handleQQ = () => {
    if (!shareUrl) return;
    const url = `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(
      shareUrl
    )}&title=${encodeURIComponent(title)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleWeibo = () => {
    if (!shareUrl) return;
    const url = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(
      shareUrl
    )}&title=${encodeURIComponent(title)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSystemShare = async () => {
    if (!shareUrl) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          url: shareUrl,
        });
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('System share failed:', err);
        }
      }
    } else {
      handleCopy();
    }
  };

  const socialButtons = [
    {
      id: 'wechat',
      label: '微信',
      icon: MessageCircle,
      color: '#07C160',
      onClick: handleWechat,
    },
    {
      id: 'qq',
      label: 'QQ',
      icon: LinkIcon,
      color: '#12B7F5',
      onClick: handleQQ,
    },
    {
      id: 'weibo',
      label: '微博',
      icon: Globe,
      color: '#E6162D',
      onClick: handleWeibo,
    },
  ];

  const hasSystemShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="glass-card rounded-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-white">分享</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-white/10 text-muted hover:text-white transition-colors"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div className="text-sm text-muted truncate">
                <span className="text-muted/70">分享内容：</span>
                <span className="text-white">{title}</span>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Loader2 className="w-7 h-7 text-primary animate-spin" />
                  <span className="text-muted text-sm">正在生成分享链接...</span>
                </div>
              ) : error ? (
                <div className="py-6 text-center">
                  <p className="text-red-400 text-sm mb-3">{error}</p>
                  <button
                    onClick={fetchShareLink}
                    className="btn-neon btn-neon-primary text-sm px-4 py-2"
                  >
                    重新生成
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-xs text-muted uppercase tracking-wider">
                      分享链接
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="share-url-input"
                        type="text"
                        value={shareUrl}
                        readOnly
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="flex-1 bg-surface/80 border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50 transition-colors min-w-0"
                      />
                      <button
                        onClick={handleCopy}
                        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                          copied
                            ? 'bg-primary/20 text-primary border border-primary/40'
                            : 'btn-neon btn-neon-primary'
                        }`}
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4" />
                            已复制
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            复制链接
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {clickCount > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <Share2 className="w-3.5 h-3.5" />
                      <span>
                        该链接已被点击 <span className="text-primary font-medium">{clickCount}</span> 次
                      </span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <label className="text-xs text-muted uppercase tracking-wider">
                      分享到
                    </label>
                    <div className="grid grid-cols-4 gap-3">
                      {socialButtons.map((btn) => {
                        const Icon = btn.icon;
                        return (
                          <motion.button
                            key={btn.id}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={btn.onClick}
                            className="flex flex-col items-center gap-2 py-3 rounded-xl bg-surface/60 border border-border hover:border-white/20 transition-colors"
                          >
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center"
                              style={{
                                background: `${btn.color}20`,
                                border: `1px solid ${btn.color}40`,
                              }}
                            >
                              <Icon
                                className="w-5 h-5"
                                style={{ color: btn.color }}
                              />
                            </div>
                            <span className="text-xs text-muted">{btn.label}</span>
                          </motion.button>
                        );
                      })}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSystemShare}
                        className="flex flex-col items-center gap-2 py-3 rounded-xl bg-surface/60 border border-border hover:border-white/20 transition-colors"
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{
                            background: 'rgba(0, 255, 209, 0.15)',
                            border: '1px solid rgba(0, 255, 209, 0.4)',
                          }}
                        >
                          <Share2 className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-xs text-muted">系统分享</span>
                      </motion.button>
                    </div>
                    {!hasSystemShare && (
                      <p className="text-xs text-muted/70 text-center">
                        当前浏览器不支持系统分享，点击将复制链接
                      </p>
                    )}
                  </div>

                  <AnimatePresence>
                    {wechatHint && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30"
                      >
                        <MessageCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-primary">
                          链接已复制到剪贴板，请打开微信粘贴到聊天中发送给好友。
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
