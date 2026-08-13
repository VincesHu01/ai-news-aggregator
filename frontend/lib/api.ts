import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  TokenResponse,
  User,
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';

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

export default apiClient;
