export type NewsCategory = 'hot' | 'tech' | 'business' | 'finance' | 'academic';

export interface NewsSource {
  id: string;
  name: string;
  url: string;
  favicon?: string;
}

export interface NewsCard {
  id: string;
  title: string;
  summary?: string | null;
  category?: string | null;
  source: string;
  source_url: string;
  heat_score: number;
  ai_value_score: number;
  interest_tags: string[];
  cover_image?: string | null;
  published_at?: string | null;
  created_at: string;
  is_read: boolean;
}

export interface NewsCardListResponse {
  total: number;
  page: number;
  page_size: number;
  items: NewsCard[];
}

export interface ReadingResponse {
  card_id: string;
  read_duration: number;
  points_earned: number;
  experience_earned: number;
  new_balance: number;
}

export interface User {
  id: string;
  email: string;
  nickname?: string | null;
  avatar_url?: string | null;
  level: number;
  experience: number;
  points: number;
  intelligence: number;
  invite_code: string;
  created_at: string;
  // Legacy fields for mock data
  username?: string;
  avatar?: string;
  experienceToNext?: number;
  streak?: number;
  lastCheckIn?: string;
  collectionsCount?: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface PointBalanceResponse {
  points: number;
  experience: number;
  level: number;
  intelligence: number;
  next_level_experience: number;
  total_checkins: number;
  cards_collected: number;
}

export type Rarity = 'N' | 'R' | 'SR' | 'SSR';

export interface CardCollection {
  id: string;
  card_name: string;
  card_rarity: string;
  card_series?: string | null;
  card_image?: string | null;
  source_card_id?: string | null;
  obtained_at: string;
  card_type?: string | null;
  description?: string | null;
  lore?: string | null;
  trivia_question?: string | null;
  trivia_answer?: string | null;
  is_synthesized?: boolean;
}

export interface DrawCardResponse {
  card: CardCollection;
  points_remaining: number;
}

export interface CheckinResponse {
  id: string;
  checkin_date: string;
  streak_days: number;
  earned_points: number;
  earned_experience: number;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id?: string;
  userId?: string;
  nickname?: string | null;
  username?: string;
  avatar_url?: string | null;
  avatar?: string;
  score?: number;
  points?: number;
  experience: number;
  level: number;
  weeklyChange?: number;
}

export type PredictionStatus = 'pending' | 'settled' | 'cancelled';

export interface Prediction {
  id: string;
  question: string;
  description?: string | null;
  category: string;
  status?: PredictionStatus;
  expires_at?: string;
  created_at?: string;
  total_bets?: number;
  total_amount?: number;
  // Legacy fields for mock data
  currentOddsYes?: number;
  currentOddsNo?: number;
  deadline?: string;
  isSettled?: boolean;
  result?: 'yes' | 'no';
  volume?: number;
  participants?: number;
}

export interface PredictionListResponse {
  total: number;
  items: Prediction[];
}

export interface BetResponse {
  id: string;
  user_id: string;
  prediction_id: string;
  choice: string;
  amount: number;
  odds: number;
  created_at: string;
  status?: string;
  payout?: number;
  // Legacy fields for mock data
  direction?: string;
  placedAt?: string;
  potentialWin?: number;
}

export interface Bet {
  id: string;
  predictionId: string;
  direction: string;
  amount: number;
  odds: number;
  placedAt: string;
  potentialWin: number;
}

export interface PredictionDetailResponse extends Prediction {
  my_bets?: BetResponse[];
}

// Legacy types for mock data compatibility
export interface CardItem {
  id: string;
  name: string;
  description: string;
  rarity: string;
  series: string;
  imageUrl?: string;
  obtainedAt: string;
  isNew?: boolean;
  [key: string]: any;
}

export interface CardSeries {
  id: string;
  name: string;
  description: string;
  cardCount: number;
  completed: boolean;
}

export interface CheckInRecord {
  date: string;
  day: number;
  reward: number;
  completed: boolean;
}

// Shares
export interface GenerateShareResponse {
  token: string;
  share_url: string;
  click_count: number;
}

export interface ShareClickResponse {
  target_type: string;
  target_id: string;
  click_count: number;
}

export interface ShareStatsItem {
  token: string;
  target_type: string;
  target_id: string;
  click_count: number;
  created_at: string;
}

export interface ShareStatsResponse {
  total_shares: number;
  total_clicks: number;
  pending_invitations: number;
  used_invitations: number;
  shares: ShareStatsItem[];
}

export interface InvitationResponse {
  invite_code: string;
  share_url: string;
  reward_points: number;
}

export interface UseInvitationResponse {
  message: string;
  reward_points: number;
}
