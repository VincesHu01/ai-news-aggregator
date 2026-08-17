import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  TokenResponse,
  User,
  NewsCard as NewsCardType,
  NewsCardListResponse,
  ReadingResponse,
  PointBalanceResponse,
  DrawCardResponse,
  CheckinResponse,
  CardCollection,
  LeaderboardEntry,
  PredictionListResponse,
  PredictionDetailResponse,
  BetResponse,
  GenerateShareResponse,
  ShareClickResponse,
  ShareStatsResponse,
  InvitationResponse,
  UseInvitationResponse,
} from './types';

const PROD_API_BASE_URL = 'https://ai-news-db-egqx.onrender.com/api';
const LOCAL_DEV_API_BASE_URL = 'http://localhost:8000/api';

/**
 * 安全解析并校验前端 API_BASE_URL。
 * 规则（兜底）：
 *  - 任何以 "localhost" 或 "127.0.0.1" 开头的 URL，若当前 hostname 不是 localhost（即 Vercel/线上），
 *    视为错误配置，强制切到生产地址，避免全站 404。
 *  - 任何以 "/" 开头的相对路径（例如 "/api"），会打到 Vercel 自己，而 Vercel 下并无这些 route，
 *    强制切到生产地址。
 *  - 若环境变量非空但缺少结尾的 "/api" 路径段，自动补齐，避免 "/auth/register" 等请求被拼到根路径。
 *  - 空字符串/undefined → 回退到生产地址。
 */
function resolveApiBaseUrl(): string {
  const raw =
    typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_BASE_URL : undefined;

  const isBrowser = typeof window !== 'undefined';
  const isLocalDev =
    isBrowser &&
    Boolean(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (!raw || typeof raw !== 'string') {
    return isLocalDev ? LOCAL_DEV_API_BASE_URL : PROD_API_BASE_URL;
  }

  let value = raw.trim();
  if (!value) {
    return isLocalDev ? LOCAL_DEV_API_BASE_URL : PROD_API_BASE_URL;
  }

  // 情况 1：相对路径（/api 或 /）→ 强制生产
  if (value.startsWith('/')) {
    return PROD_API_BASE_URL;
  }

  // 情况 2：线上环境但指向 localhost → 强制生产
  const lower = value.toLowerCase();
  if (!isLocalDev && (lower.includes('localhost') || lower.includes('127.0.0.1'))) {
    return PROD_API_BASE_URL;
  }

  // 情况 3：缺少 "/api" 段 → 自动补齐
  // 例如用户填 https://ai-news-db-egqx.onrender.com → 补成 /api
  try {
    const u = new URL(value);
    if (!u.pathname || u.pathname === '/' || !u.pathname.endsWith('/api')) {
      // 去掉末尾斜杠后补 /api
      const base = u.origin;
      let path = u.pathname.replace(/\/$/, '');
      if (!path.endsWith('/api')) {
        path = `${path}/api`;
      }
      value = `${base}${path}`;
    }
  } catch {
    // 非 URL 格式 → 直接 fallback
    return isLocalDev ? LOCAL_DEV_API_BASE_URL : PROD_API_BASE_URL;
  }

  return value;
}

const API_BASE_URL = resolveApiBaseUrl();

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 运行时二次兜底：确保最终请求 URL 永远不会打到 Vercel 同源或 localhost
    if (typeof window !== 'undefined' && config.url) {
      const finalUrl = (config.baseURL || API_BASE_URL) + config.url;
      if (finalUrl.startsWith('/')) {
        // 相对路径：强制改为生产绝对地址
        config.baseURL = PROD_API_BASE_URL;
      } else {
        try {
          const u = new URL(finalUrl);
          const isLocalHostname = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
          const selfHost = window.location.hostname;
          const onVercel = selfHost !== 'localhost' && selfHost !== '127.0.0.1';
          if (isLocalHostname && onVercel) {
            // 线上环境但请求打到 localhost，强制改生产
            config.baseURL = PROD_API_BASE_URL;
          }
        } catch {
          /* ignore malformed */
        }
      }
    }
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error: AxiosError) => {
    // 统一把 401 转成"请先登录"的文本错误，避免前端页面永远显示"Network Error"
    const makePrettyError = (msg: string, status?: number) => {
      const err = new Error(msg) as any;
      err.response = error.response || { data: { detail: msg }, status: status || 0 };
      err.message = msg;
      err.status = status || (error.response as any)?.status || 0;
      return err;
    };

    if (error.response) {
      const status = (error.response as any).status;
      const detail = ((error.response as any).data as any)?.detail;
      switch (status) {
        case 401: {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
          }
          return Promise.reject(makePrettyError(detail || '请先登录', 401));
        }
        case 403:
          return Promise.reject(makePrettyError(detail || '权限不足', 403));
        case 429:
          return Promise.reject(makePrettyError(detail || '请求过于频繁，请稍后再试', 429));
        case 500:
          return Promise.reject(makePrettyError(detail || '服务器内部错误，请稍后重试', 500));
        default:
          if (detail) {
            return Promise.reject(makePrettyError(detail, status));
          }
          console.warn('HTTP error:', status, error.config?.url);
          break;
      }
    } else if (error.request) {
      // 真实 network 层错误
      const urlHint = error.config?.url ? `（${error.config.url}）` : '';
      return Promise.reject(makePrettyError(`无法连接到后端服务${urlHint}。请检查网络或稍后重试。`, 0));
    }
    return Promise.reject(error);
  }
);

// Auth
export async function register(email: string, password: string, nickname?: string): Promise<TokenResponse> {
  const resp = await apiClient.post('/auth/register', {
    email,
    password,
    nickname,
  });
  const data = resp as unknown as TokenResponse;
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
  }
  return data;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const resp = await apiClient.post('/auth/login', {
    email,
    password,
  });
  const data = resp as unknown as TokenResponse;
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
  }
  return data;
}

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('auth_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('auth_token');
}

// News
export async function getNews(page = 1, pageSize = 20): Promise<NewsCardListResponse> {
  const resp = await apiClient.get('/news/', {
    params: { page, page_size: pageSize },
  });
  return resp as unknown as NewsCardListResponse;
}

export async function getReadingHistory(page = 1, pageSize = 20): Promise<NewsCardListResponse> {
  const resp = await apiClient.get('/news/history', { params: { page, page_size: pageSize } });
  return resp as unknown as NewsCardListResponse;
}

export async function getNewsCard(cardId: string): Promise<NewsCardType> {
  const resp = await apiClient.get(`/news/${cardId}`);
  return resp as unknown as NewsCardType;
}

export async function markAsRead(cardId: string, readDuration: number): Promise<ReadingResponse> {
  const resp = await apiClient.post(`/news/${cardId}/read`, {
    read_duration: readDuration,
  });
  return resp as unknown as ReadingResponse;
}

// Rewards
export async function getBalance(): Promise<PointBalanceResponse> {
  const resp = await apiClient.get('/rewards/balance');
  return resp as unknown as PointBalanceResponse;
}

// Daily Tasks
export interface DailyTask {
  id: string;
  title: string;
  progress: number;
  target: number;
  reward_points: number;
  reward_experience: number;
  completed: boolean;
  claimed: boolean;
  claimable: boolean;
}

export interface DailyTasksResponse {
  date: string;
  tasks: DailyTask[];
  total_reward_available: number;
}

export async function getDailyTasks(): Promise<DailyTasksResponse> {
  const resp = await apiClient.get('/rewards/daily-tasks');
  return resp as unknown as DailyTasksResponse;
}

export async function claimDailyTask(taskId: string): Promise<{
  status: string;
  message: string;
  points_earned: number;
  experience_earned: number;
  new_balance: number;
}> {
  const resp = await apiClient.post('/rewards/claim-daily-task', null, { params: { task_id: taskId } });
  return resp as unknown as any;
}

// Bookmarks (localStorage-based)
export function getBookmarkIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('nexus_bookmarks');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleBookmark(cardId: string): boolean {
  if (typeof window === 'undefined') return false;
  const ids = getBookmarkIds();
  const idx = ids.indexOf(cardId);
  if (idx >= 0) {
    ids.splice(idx, 1);
    localStorage.setItem('nexus_bookmarks', JSON.stringify(ids));
    return false;
  } else {
    ids.push(cardId);
    localStorage.setItem('nexus_bookmarks', JSON.stringify(ids));
    return true;
  }
}

export function isBookmarked(cardId: string): boolean {
  return getBookmarkIds().includes(cardId);
}

export async function checkin(): Promise<CheckinResponse> {
  const resp = await apiClient.post('/rewards/checkin');
  return resp as unknown as CheckinResponse;
}

export async function drawCard(cardSeries?: string): Promise<DrawCardResponse> {
  const resp = await apiClient.post('/rewards/draw-card', null, {
    params: cardSeries ? { card_series: cardSeries } : {},
  });
  return resp as unknown as DrawCardResponse;
}

export async function getCards(rarity?: string): Promise<CardCollection[]> {
  const resp = await apiClient.get('/rewards/cards', {
    params: rarity ? { rarity } : {},
  });
  return resp as unknown as CardCollection[];
}

export async function getLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  const resp = await apiClient.get('/rewards/leaderboard', {
    params: { limit },
  });
  return resp as unknown as LeaderboardEntry[];
}

// Predictions
export async function getPredictions(statusFilter?: string): Promise<PredictionListResponse> {
  const resp = await apiClient.get('/predictions/', {
    params: statusFilter ? { status_filter: statusFilter } : {},
  });
  return resp as unknown as PredictionListResponse;
}

export async function getPrediction(predictionId: string): Promise<PredictionDetailResponse> {
  const resp = await apiClient.get(`/predictions/${predictionId}`);
  return resp as unknown as PredictionDetailResponse;
}

export async function placeBet(predictionId: string, choice: string, amount: number): Promise<BetResponse> {
  const resp = await apiClient.post(`/predictions/${predictionId}/bet`, {
    choice,
    amount,
  });
  return resp as unknown as BetResponse;
}

// Shares
export async function generateShare(targetType: 'news' | 'prediction' | 'card', targetId: string): Promise<GenerateShareResponse> {
  const resp = await apiClient.post('/shares/generate', null, {
    params: { target_type: targetType, target_id: targetId },
  });
  return resp as unknown as GenerateShareResponse;
}

export async function trackShareClick(token: string): Promise<ShareClickResponse> {
  const resp = await apiClient.get(`/shares/${token}`);
  return resp as unknown as ShareClickResponse;
}

export async function getShareStats(): Promise<ShareStatsResponse> {
  const resp = await apiClient.get('/shares/stats');
  return resp as unknown as ShareStatsResponse;
}

export async function createInvitation(rewardPoints = 50): Promise<InvitationResponse> {
  const resp = await apiClient.post('/shares/invite', null, {
    params: { reward_points: rewardPoints },
  });
  return resp as unknown as InvitationResponse;
}

export async function useInvitation(inviteCode: string): Promise<UseInvitationResponse> {
  const resp = await apiClient.post(`/shares/invite/${inviteCode}/use`);
  return resp as unknown as UseInvitationResponse;
}

// Public stats
export async function getPublicStats(): Promise<{ news_count: number; users_count: number; bets_count: number }> {
  const resp = await apiClient.get('/public/stats');
  return resp as unknown as { news_count: number; users_count: number; bets_count: number };
}

// 匿名访问触发一次采集（带 20 分钟防刷）
export async function publicTriggerCollection(): Promise<{
  status: 'ok' | 'skipped';
  detail?: {
    ok: boolean;
    reason: string;
    trigger: string;
    saved_cards: number;
    push_history_id?: string | null;
    push_status?: string;
  };
}> {
  const resp = await apiClient.post('/public/trigger-collection');
  return resp as unknown as {
    status: 'ok' | 'skipped';
    detail?: {
      ok: boolean;
      reason: string;
      trigger: string;
      saved_cards: number;
      push_history_id?: string | null;
      push_status?: string;
    };
  };
}

// 推送历史
export interface PushHistoryEntry {
  id: string;
  trigger_type: 'auto_visit' | 'cron_00_00' | 'cron_interval' | 'manual';
  push_channel: string;
  status: 'pending' | 'sending' | 'success' | 'partial' | 'failed' | 'skipped';
  news_count: number;
  recipient_count: number;
  success_count: number;
  failed_count: number;
  title?: string | null;
  summary?: string | null;
  news_card_ids: string[];
  error_message?: string | null;
  created_at: string;
  sent_at?: string | null;
}

export async function listPushHistory(page = 1, pageSize = 20): Promise<PushHistoryEntry[]> {
  const resp = await apiClient.get('/push-history', { params: { page, page_size: pageSize } });
  return resp as unknown as PushHistoryEntry[];
}

export async function getPushHistory(historyId: string): Promise<PushHistoryEntry> {
  const resp = await apiClient.get(`/push-history/${historyId}`);
  return resp as unknown as PushHistoryEntry;
}

// 用户推送设置
export interface UserPushSettingsPayload {
  email_enabled?: boolean;
  email_override?: string | null;
  wechat_enabled?: boolean;
  push_on_visit?: boolean;
  push_on_daily_cron?: boolean;
  interest_tags_filter?: string[] | null;
  min_ai_value_score?: number;
}

export interface UserPushSettings {
  id?: string | null;
  email_enabled: boolean;
  email_override?: string | null;
  email_verified: boolean;
  wechat_enabled: boolean;
  wechat_userid?: string | null;
  push_on_visit: boolean;
  push_on_daily_cron: boolean;
  interest_tags_filter: string[];
  min_ai_value_score: number;
  updated_at?: string | null;
  created_at?: string | null;
}

export async function getPushSettings(): Promise<UserPushSettings> {
  const resp = await apiClient.get('/user/push-settings');
  return resp as unknown as UserPushSettings;
}

export async function updatePushSettings(payload: UserPushSettingsPayload): Promise<UserPushSettings> {
  const resp = await apiClient.put('/user/push-settings', payload);
  return resp as unknown as UserPushSettings;
}

export async function sendTestPushEmail(): Promise<{ status: string; message?: string }> {
  const resp = await apiClient.post('/user/push-settings/send-test-email');
  return resp as unknown as { status: string; message?: string };
}

// ==============================================================================
// 卡牌合成 & 赠送
// ==============================================================================
export async function synthesizeCards(cardIds: string[]): Promise<{
  status: string;
  message: string;
  new_card: CardCollection;
}> {
  const resp = await apiClient.post('/rewards/synthesize-cards', null, {
    params: { card_ids: cardIds },
  });
  return resp as unknown as any;
}

export async function giftCard(cardId: string, toUserId: string): Promise<{
  status: string;
  message: string;
}> {
  const resp = await apiClient.post('/rewards/gift-card', null, {
    params: { card_id: cardId, to_user_id: toUserId },
  });
  return resp as unknown as any;
}

// ==============================================================================
// 分享链接
// ==============================================================================
export async function generateShareLink(
  targetType: 'news' | 'prediction' | 'card',
  targetId: string,
): Promise<{ token: string; share_url: string; click_count: number }> {
  const resp = await apiClient.post('/shares/generate', null, {
    params: { target_type: targetType, target_id: targetId },
  });
  return resp as unknown as any;
}

// ==============================================================================
// 好友系统
// ==============================================================================
export interface FriendUser {
  id: string;
  nickname: string;
  email: string;
  avatar_url?: string | null;
  level: number;
}

export interface FriendRequest {
  friendship_id: string;
  from_user: FriendUser;
  created_at: string;
}

export interface Friend extends FriendUser {
  friendship_id: string;
  accepted_at?: string | null;
}

export async function searchUsers(q: string): Promise<(FriendUser & { is_friend: boolean })[]> {
  const resp = await apiClient.get('/friends/search', { params: { q } });
  return resp as unknown as any;
}

export async function sendFriendRequest(toUserId: string): Promise<{ status: string; message: string }> {
  const resp = await apiClient.post('/friends/request', null, { params: { to_user_id: toUserId } });
  return resp as unknown as any;
}

export async function acceptFriendRequest(friendshipId: string): Promise<{ status: string; message: string }> {
  const resp = await apiClient.post(`/friends/${friendshipId}/accept`);
  return resp as unknown as any;
}

export async function rejectFriendRequest(friendshipId: string): Promise<{ status: string; message: string }> {
  const resp = await apiClient.post(`/friends/${friendshipId}/reject`);
  return resp as unknown as any;
}

export async function listFriendRequests(): Promise<FriendRequest[]> {
  const resp = await apiClient.get('/friends/requests');
  return resp as unknown as any;
}

export async function listFriends(): Promise<Friend[]> {
  const resp = await apiClient.get('/friends/');
  return resp as unknown as any;
}

export async function removeFriend(friendId: string): Promise<{ status: string; message: string }> {
  const resp = await apiClient.delete(`/friends/${friendId}`);
  return resp as unknown as any;
}

export default apiClient;
