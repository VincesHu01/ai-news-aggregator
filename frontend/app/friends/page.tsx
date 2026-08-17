'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Search,
  Check,
  X,
  User,
  Trash2,
  Loader2,
  Mail,
  Clock,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import LevelBadge from '@/components/rewards/LevelBadge';
import {
  listFriends,
  listFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  searchUsers,
  sendFriendRequest,
  isAuthenticated,
  type Friend,
  type FriendRequest,
} from '@/lib/api';

type TabId = 'friends' | 'requests' | 'search';

const tabs: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: 'friends', label: '好友列表', icon: Users },
  { id: 'requests', label: '好友请求', icon: UserPlus },
  { id: 'search', label: '搜索添加', icon: Search },
];

type SearchResult = {
  id: string;
  nickname: string;
  email: string;
  avatar_url?: string | null;
  level: number;
  is_friend: boolean;
};

export default function FriendsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingReq, setLoadingReq] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [authed, setAuthed] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAuthed(isAuthenticated());
  }, []);

  const fetchFriends = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await listFriends();
      setFriends(data);
    } catch (err) {
      console.error('Failed to load friends:', err);
      setFriends([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoadingReq(true);
    try {
      const data = await listFriendRequests();
      setRequests(data);
    } catch (err) {
      console.error('Failed to load friend requests:', err);
      setRequests([]);
    } finally {
      setLoadingReq(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) return;
    fetchFriends();
    fetchRequests();
  }, [fetchFriends, fetchRequests]);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await searchUsers(q);
        setSearchResults(data);
        setHasSearched(true);
      } catch (err) {
        console.error('Failed to search users:', err);
        setSearchResults([]);
        setHasSearched(true);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }
    };
  }, [searchQuery]);

  const flashMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAccept = async (friendshipId: string) => {
    setActionLoading(friendshipId);
    try {
      await acceptFriendRequest(friendshipId);
      flashMessage('success', '已添加好友');
      await Promise.all([fetchFriends(), fetchRequests()]);
    } catch (err) {
      console.error('Failed to accept friend request:', err);
      flashMessage('error', '接受请求失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (friendshipId: string) => {
    setActionLoading(friendshipId);
    try {
      await rejectFriendRequest(friendshipId);
      flashMessage('success', '已拒绝请求');
      await fetchRequests();
    } catch (err) {
      console.error('Failed to reject friend request:', err);
      flashMessage('error', '拒绝请求失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (friendId: string) => {
    setActionLoading(friendId);
    try {
      await removeFriend(friendId);
      flashMessage('success', '已删除好友');
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
    } catch (err) {
      console.error('Failed to remove friend:', err);
      flashMessage('error', '删除好友失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendRequest = async (userId: string) => {
    setActionLoading(userId);
    try {
      await sendFriendRequest(userId);
      flashMessage('success', '好友请求已发送');
      setSearchResults((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_friend: true } : u))
      );
    } catch (err) {
      console.error('Failed to send friend request:', err);
      flashMessage('error', '发送请求失败，可能已发送过');
    } finally {
      setActionLoading(null);
    }
  };

  const renderAvatar = (
    avatarUrl?: string | null,
    name?: string,
    sizeClass = 'w-12 h-12'
  ) => {
    const initial = (name || '?').charAt(0).toUpperCase();
    if (avatarUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name || 'avatar'}
          className={`${sizeClass} rounded-xl object-cover border border-border`}
        />
      );
    }
    return (
      <div
        className={`${sizeClass} rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/30 to-secondary/30 border border-border`}
      >
        <span className="font-bold text-white">{initial}</span>
      </div>
    );
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const now = Date.now();
      const diff = now - d.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return '刚刚';
      if (mins < 60) return `${mins} 分钟前`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours} 小时前`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days} 天前`;
      return d.toLocaleDateString('zh-CN');
    } catch {
      return '';
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <Sidebar />
        <main className="pt-16 lg:pl-64 pb-20 lg:pb-0 min-h-screen">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="glass-card rounded-2xl p-10 text-center">
              <User className="w-12 h-12 text-muted mx-auto mb-4" />
              <h2 className="text-lg font-bold text-white mb-2">请先登录</h2>
              <p className="text-muted text-sm">登录后即可使用好友功能</p>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar />

      <main className="pt-16 lg:pl-64 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Users
                  className="w-7 h-7 text-primary"
                  style={{ filter: 'drop-shadow(0 0 10px #00FFD1)' }}
                />
                好友
              </h1>
              <p className="text-muted text-sm mt-1">管理你的好友，一起探索 AI 世界</p>
            </div>
          </div>

          <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hidden">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const count =
                tab.id === 'friends'
                  ? friends.length
                  : tab.id === 'requests'
                    ? requests.length
                    : undefined;
              return (
                <motion.button
                  key={tab.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-surface text-muted border border-border hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {count !== undefined && count > 0 && (
                    <span
                      className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        activeTab === tab.id
                          ? 'bg-primary/30 text-primary'
                          : 'bg-white/10 text-muted'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'friends' && (
                <FriendsTab
                  friends={friends}
                  loading={loadingList}
                  actionLoading={actionLoading}
                  onRemove={handleRemove}
                  renderAvatar={renderAvatar}
                />
              )}

              {activeTab === 'requests' && (
                <RequestsTab
                  requests={requests}
                  loading={loadingReq}
                  actionLoading={actionLoading}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  renderAvatar={renderAvatar}
                  formatTime={formatTime}
                />
              )}

              {activeTab === 'search' && (
                <SearchTab
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  searching={searching}
                  hasSearched={hasSearched}
                  searchResults={searchResults}
                  actionLoading={actionLoading}
                  onSendRequest={handleSendRequest}
                  renderAvatar={renderAvatar}
                />
              )}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {message && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className={`fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl glass-card border ${
                  message.type === 'success'
                    ? 'border-primary/40 text-primary'
                    : 'border-red-500/40 text-red-400'
                } flex items-center gap-2 text-sm font-medium shadow-lg`}
              >
                {message.type === 'success' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

// ============ 好友列表 Tab ============
function FriendsTab({
  friends,
  loading,
  actionLoading,
  onRemove,
  renderAvatar,
}: {
  friends: Friend[];
  loading: boolean;
  actionLoading: string | null;
  onRemove: (friendId: string) => void;
  renderAvatar: (
    avatarUrl?: string | null,
    name?: string,
    sizeClass?: string
  ) => JSX.Element;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="text-muted text-sm">加载好友列表...</span>
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center">
        <Users className="w-12 h-12 text-muted mx-auto mb-4" />
        <h2 className="text-lg font-bold text-white mb-2">还没有好友</h2>
        <p className="text-muted text-sm">切换到「搜索添加」去找你的第一位好友吧</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {friends.map((friend, idx) => (
        <motion.div
          key={friend.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05 }}
          className="glass-card rounded-2xl p-4 flex items-center gap-4"
        >
          {renderAvatar(friend.avatar_url, friend.nickname)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-white truncate">
                {friend.nickname || friend.email.split('@')[0]}
              </span>
              <LevelBadge level={friend.level} size="sm" showGlow={false} />
            </div>
            <div className="flex items-center gap-1 text-xs text-muted truncate">
              <Mail className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{friend.email}</span>
            </div>
          </div>
          <button
            onClick={() => onRemove(friend.id)}
            disabled={actionLoading === friend.id}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading === friend.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            删除好友
          </button>
        </motion.div>
      ))}
    </div>
  );
}

// ============ 好友请求 Tab ============
function RequestsTab({
  requests,
  loading,
  actionLoading,
  onAccept,
  onReject,
  renderAvatar,
  formatTime,
}: {
  requests: FriendRequest[];
  loading: boolean;
  actionLoading: string | null;
  onAccept: (friendshipId: string) => void;
  onReject: (friendshipId: string) => void;
  renderAvatar: (
    avatarUrl?: string | null,
    name?: string,
    sizeClass?: string
  ) => JSX.Element;
  formatTime: (iso?: string | null) => string;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="text-muted text-sm">加载好友请求...</span>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center">
        <UserPlus className="w-12 h-12 text-muted mx-auto mb-4" />
        <h2 className="text-lg font-bold text-white mb-2">暂无好友请求</h2>
        <p className="text-muted text-sm">新的好友请求会在这里显示</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((req, idx) => (
        <motion.div
          key={req.friendship_id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.05 }}
          className="glass-card rounded-2xl p-4 flex items-center gap-4"
        >
          {renderAvatar(req.from_user.avatar_url, req.from_user.nickname)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-white truncate">
                {req.from_user.nickname || req.from_user.email.split('@')[0]}
              </span>
              <LevelBadge level={req.from_user.level} size="sm" showGlow={false} />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="flex items-center gap-1 truncate">
                <Mail className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{req.from_user.email}</span>
              </span>
              <span className="flex items-center gap-1 flex-shrink-0">
                <Clock className="w-3 h-3" />
                {formatTime(req.created_at)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onAccept(req.friendship_id)}
              disabled={actionLoading === req.friendship_id}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium btn-neon btn-neon-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading === req.friendship_id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              接受
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onReject(req.friendship_id)}
              disabled={actionLoading === req.friendship_id}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-surface text-muted border border-border hover:text-white hover:border-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-3.5 h-3.5" />
              拒绝
            </motion.button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ============ 搜索添加 Tab ============
function SearchTab({
  searchQuery,
  setSearchQuery,
  searching,
  hasSearched,
  searchResults,
  actionLoading,
  onSendRequest,
  renderAvatar,
}: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searching: boolean;
  hasSearched: boolean;
  searchResults: SearchResult[];
  actionLoading: string | null;
  onSendRequest: (userId: string) => void;
  renderAvatar: (
    avatarUrl?: string | null,
    name?: string,
    sizeClass?: string
  ) => JSX.Element;
}) {
  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center gap-2 bg-surface/80 rounded-xl px-4 py-3 border border-border focus-within:border-primary/50 transition-colors">
          <Search className="w-5 h-5 text-muted flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索邮箱或昵称..."
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder-muted min-w-0"
            autoFocus
          />
          {searching && (
            <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
          )}
          {searchQuery && !searching && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-muted hover:text-white transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {searching && !hasSearched && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
          <span className="text-muted text-sm">搜索中...</span>
        </div>
      )}

      {!searching && hasSearched && searchResults.length === 0 && (
        <div className="glass-card rounded-2xl p-10 text-center">
          <Search className="w-12 h-12 text-muted mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">未找到用户</h2>
          <p className="text-muted text-sm">试试其他关键词吧</p>
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="space-y-3">
          {searchResults.map((user, idx) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card rounded-2xl p-4 flex items-center gap-4"
            >
              {renderAvatar(user.avatar_url, user.nickname)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-white truncate">
                    {user.nickname || user.email.split('@')[0]}
                  </span>
                  <LevelBadge level={user.level} size="sm" showGlow={false} />
                </div>
                <div className="flex items-center gap-1 text-xs text-muted truncate">
                  <Mail className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
              </div>
              {user.is_friend ? (
                <div className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/30 flex-shrink-0">
                  <UserCheck className="w-3.5 h-3.5" />
                  已是好友
                </div>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSendRequest(user.id)}
                  disabled={actionLoading === user.id}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium btn-neon btn-neon-primary disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {actionLoading === user.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5" />
                  )}
                  添加好友
                </motion.button>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {!searchQuery && (
        <div className="glass-card rounded-2xl p-10 text-center">
          <Search className="w-12 h-12 text-muted mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">搜索用户</h2>
          <p className="text-muted text-sm">输入邮箱或昵称查找你的好友</p>
        </div>
      )}
    </div>
  );
}
