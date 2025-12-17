import type {
  ApiResponse,
  Post,
  PostPreview,
  SubscriptionStatus,
  SiteSettings,
  PaymentReference,
  PaymentVerification,
  MonthGroup,
  AdminStats,
  UploadUrl,
} from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Request failed' };
    }

    return { success: true, data };
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, error: 'Network error' };
  }
}

// Auth
export async function verifyWallet(
  wallet: string,
  signature: string,
  message: string
): Promise<ApiResponse<{ token: string }>> {
  return fetchApi('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ wallet, signature, message }),
  });
}

export async function getSession(): Promise<ApiResponse<{ wallet: string; isAdmin: boolean }>> {
  return fetchApi('/api/auth/session');
}

export async function logout(): Promise<ApiResponse<void>> {
  return fetchApi('/api/auth/logout', { method: 'POST' });
}

// Subscription
export async function getSubscriptionStatus(
  wallet: string
): Promise<ApiResponse<SubscriptionStatus>> {
  return fetchApi(`/api/subscription/status?wallet=${wallet}`);
}

// Payments
export async function createPaymentReference(
  wallet: string
): Promise<ApiResponse<PaymentReference>> {
  return fetchApi('/api/payment/create', {
    method: 'POST',
    body: JSON.stringify({ wallet }),
  });
}

export async function verifyPayment(
  reference: string,
  txSignature: string
): Promise<ApiResponse<PaymentVerification>> {
  return fetchApi('/api/payment/verify', {
    method: 'POST',
    body: JSON.stringify({ reference, txSignature }),
  });
}

// Settings
export async function getSettings(): Promise<ApiResponse<SiteSettings>> {
  return fetchApi('/api/settings');
}

// Posts (Public)
export async function getPosts(
  month?: string
): Promise<ApiResponse<{ posts: PostPreview[]; months: MonthGroup[] }>> {
  const params = month ? `?month=${month}` : '';
  return fetchApi(`/api/posts${params}`);
}

export async function getPost(id: number, wallet?: string): Promise<ApiResponse<Post>> {
  const params = wallet ? `?wallet=${wallet}` : '';
  return fetchApi(`/api/posts/${id}${params}`);
}

// Admin APIs
export async function adminGetStats(): Promise<ApiResponse<AdminStats>> {
  return fetchApi('/api/admin/stats');
}

export async function adminGetPosts(): Promise<ApiResponse<Post[]>> {
  return fetchApi('/api/admin/posts');
}

export async function adminCreatePost(post: {
  title: string;
  content: string;
  images: string[];
  month: string;
  is_premium: boolean;
}): Promise<ApiResponse<Post>> {
  return fetchApi('/api/admin/posts', {
    method: 'POST',
    body: JSON.stringify(post),
  });
}

export async function adminUpdatePost(
  id: number,
  post: Partial<{
    title: string;
    content: string;
    images: string[];
    month: string;
    is_premium: boolean;
  }>
): Promise<ApiResponse<Post>> {
  return fetchApi(`/api/admin/posts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(post),
  });
}

export async function adminDeletePost(id: number): Promise<ApiResponse<void>> {
  return fetchApi(`/api/admin/posts/${id}`, { method: 'DELETE' });
}

export async function adminUpdateSettings(settings: {
  is_paused?: boolean;
  pause_message?: string;
}): Promise<ApiResponse<SiteSettings>> {
  return fetchApi('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export async function adminGetUploadUrl(
  filename: string,
  contentType: string
): Promise<ApiResponse<UploadUrl>> {
  return fetchApi('/api/admin/upload-url', {
    method: 'POST',
    body: JSON.stringify({ filename, contentType }),
  });
}

export async function uploadToR2(
  uploadUrl: string,
  file: File
): Promise<boolean> {
  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
