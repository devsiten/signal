import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SubscriptionStatus, SiteSettings, Toast, WalletType } from '@/types';

interface AppState {
  // Wallet
  wallet: string | null;
  walletType: WalletType | null;
  setWallet: (wallet: string | null, type: WalletType | null) => void;

  // Subscription
  subscription: SubscriptionStatus | null;
  setSubscription: (sub: SubscriptionStatus | null) => void;

  // Settings
  settings: SiteSettings | null;
  setSettings: (settings: SiteSettings | null) => void;

  // Admin
  isAdmin: boolean;
  setIsAdmin: (isAdmin: boolean) => void;

  // UI
  toasts: Toast[];
  addToast: (type: Toast['type'], message: string) => void;
  removeToast: (id: string) => void;

  // Selected month filter
  selectedMonth: string | null;
  setSelectedMonth: (month: string | null) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Wallet
      wallet: null,
      walletType: null,
      setWallet: (wallet, type) => set({ wallet, walletType: type }),

      // Subscription
      subscription: null,
      setSubscription: (subscription) => set({ subscription }),

      // Settings
      settings: null,
      setSettings: (settings) => set({ settings }),

      // Admin
      isAdmin: false,
      setIsAdmin: (isAdmin) => set({ isAdmin }),

      // UI
      toasts: [],
      addToast: (type, message) => {
        const id = Math.random().toString(36).substring(7);
        set({ toasts: [...get().toasts, { id, type, message }] });
        setTimeout(() => {
          set({ toasts: get().toasts.filter((t) => t.id !== id) });
        }, 5000);
      },
      removeToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

      // Month filter
      selectedMonth: null,
      setSelectedMonth: (selectedMonth) => set({ selectedMonth }),

      // Loading
      isLoading: false,
      setIsLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'hussayn-signal-storage',
      partialize: (state) => ({
        wallet: state.wallet,
        walletType: state.walletType,
      }),
    }
  )
);
