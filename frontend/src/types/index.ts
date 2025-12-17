// User types
export interface User {
  wallet: string;
  created_at: string;
}

// Subscription types
export interface Subscription {
  id: number;
  wallet: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionStatus {
  isActive: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
}

// Post types
export interface Post {
  id: number;
  title: string;
  content: string;
  images: string[];
  month: string; // Format: "2025-07"
  is_premium: boolean;
  created_at: string;
  updated_at: string;
}

export interface PostPreview {
  id: number;
  title: string;
  preview: string;
  month: string;
  is_premium: boolean;
  created_at: string;
  image_count: number;
}

// Payment types
export interface PaymentReference {
  reference: string;
  amount: number;
  wallet: string;
  created_at: string;
  expires_at: string;
}

export interface PaymentVerification {
  success: boolean;
  txSignature?: string;
  newExpiry?: string;
  error?: string;
}

// Settings types
export interface SiteSettings {
  is_paused: boolean;
  pause_message: string;
  price_sol: number;
  subscription_days: number;
}

// Month grouping
export interface MonthGroup {
  month: string;
  label: string;
  postCount: number;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Admin types
export interface AdminStats {
  totalUsers: number;
  activeSubscribers: number;
  totalPosts: number;
  totalPayments: number;
  revenue: number;
}

// Upload types
export interface UploadUrl {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

// Wallet adapter types
export type WalletType = 'phantom' | 'solflare';

export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  wallet: WalletType | null;
}

// Toast types
export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}
