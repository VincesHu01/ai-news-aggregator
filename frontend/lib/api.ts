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
    if (error.response) {
      switch (error.response.status) {
        case 401:
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
          }
          break;
        case 403:
          console.warn('Access forbidden:', error.config?.url);
          break;
        case 429:
          console.warn('Rate limited:', error.config?.url);
          break;
        case 500:
          console.error('Server error:', error.config?.url);
          break;
      }
    } else if (error.request) {
      console.error('Network error:', error.message);
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

export default apiClient;
