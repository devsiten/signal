'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '@/stores/app';
import {
  connectWallet,
  disconnectWallet,
  signMessage,
  getPhantomProvider,
  getSolflareProvider,
  formatWallet,
} from '@/lib/wallet';
import { verifyWallet, getSession, logout, getSubscriptionStatus } from '@/lib/api';
import type { WalletType } from '@/types';

export function useWallet() {
  const {
    wallet,
    walletType,
    setWallet,
    subscription,
    setSubscription,
    isAdmin,
    setIsAdmin,
    addToast,
  } = useAppStore();

  const [isConnecting, setIsConnecting] = useState(false);
  const [hasPhantom, setHasPhantom] = useState(false);
  const [hasSolflare, setHasSolflare] = useState(false);

  // Check wallet availability
  useEffect(() => {
    const checkWallets = () => {
      setHasPhantom(!!getPhantomProvider());
      setHasSolflare(!!getSolflareProvider());
    };

    checkWallets();

    // Re-check after a delay for slow-loading extensions
    const timeout = setTimeout(checkWallets, 1000);
    return () => clearTimeout(timeout);
  }, []);

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      const response = await getSession();
      if (response.success && response.data) {
        setWallet(response.data.wallet, walletType);
        setIsAdmin(response.data.isAdmin);

        // Get subscription status
        const subResponse = await getSubscriptionStatus(response.data.wallet);
        if (subResponse.success && subResponse.data) {
          setSubscription(subResponse.data);
        }

        // Set initial activity time
        localStorage.setItem('lastActivity', Date.now().toString());
      }
    };

    checkSession();
  }, []);

  // Auto-logout after 2 hours of inactivity
  useEffect(() => {
    if (!wallet) return;

    const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    const CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds

    // Check if should auto-logout (runs immediately on page load)
    const checkAndLogout = async () => {
      const lastActivity = localStorage.getItem('lastActivity');
      if (lastActivity) {
        const elapsed = Date.now() - parseInt(lastActivity, 10);
        if (elapsed >= INACTIVITY_TIMEOUT) {
          // Auto-logout
          if (walletType) {
            await disconnectWallet(walletType);
          }
          await logout();
          setWallet(null, null);
          setSubscription(null);
          setIsAdmin(false);
          localStorage.removeItem('lastActivity');
          window.location.href = '/';
          return true;
        }
      }
      return false;
    };

    // Check immediately on page load
    checkAndLogout();

    // Update last activity on user interactions
    const updateActivity = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
    };

    // Track activity events
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, updateActivity, { passive: true }));

    // Check for inactivity periodically
    const interval = setInterval(checkAndLogout, CHECK_INTERVAL);

    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity));
      clearInterval(interval);
    };
  }, [wallet, walletType, setWallet, setSubscription, setIsAdmin]);

  // Connect and authenticate
  const connect = useCallback(async (type: WalletType) => {
    if (isConnecting) return;

    setIsConnecting(true);
    try {
      const publicKey = await connectWallet(type);
      if (!publicKey) {
        addToast('error', 'Failed to connect wallet');
        return;
      }

      // Create sign message
      const timestamp = Date.now();
      const message = `Sign this message to authenticate with Hussayn Alpha.\n\nWallet: ${publicKey}\nTimestamp: ${timestamp}`;

      const signature = await signMessage(message, type);
      if (!signature) {
        addToast('error', 'Failed to sign message');
        return;
      }

      // Verify with backend
      const response = await verifyWallet(publicKey, signature, message);
      if (!response.success) {
        addToast('error', response.error || 'Authentication failed');
        return;
      }

      setWallet(publicKey, type);

      // Get session info
      const sessionResponse = await getSession();
      if (sessionResponse.success && sessionResponse.data) {
        setIsAdmin(sessionResponse.data.isAdmin);
      }

      // Get subscription status
      const subResponse = await getSubscriptionStatus(publicKey);
      if (subResponse.success && subResponse.data) {
        setSubscription(subResponse.data);
      }

      addToast('success', 'Wallet connected');
    } catch (error) {
      console.error('Connect error:', error);
      addToast('error', 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, setWallet, setIsAdmin, setSubscription, addToast]);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (walletType) {
      await disconnectWallet(walletType);
    }
    await logout();
    setWallet(null, null);
    setSubscription(null);
    setIsAdmin(false);
    addToast('info', 'Wallet disconnected');
  }, [walletType, setWallet, setSubscription, setIsAdmin, addToast]);

  // Refresh subscription
  const refreshSubscription = useCallback(async () => {
    if (!wallet) return;

    const response = await getSubscriptionStatus(wallet);
    if (response.success && response.data) {
      setSubscription(response.data);
    }
  }, [wallet, setSubscription]);

  return {
    wallet,
    walletType,
    formattedWallet: wallet ? formatWallet(wallet) : null,
    isConnected: !!wallet,
    isConnecting,
    hasPhantom,
    hasSolflare,
    subscription,
    isAdmin,
    isPremium: subscription?.isActive || false,
    connect,
    disconnect,
    refreshSubscription,
  };
}

