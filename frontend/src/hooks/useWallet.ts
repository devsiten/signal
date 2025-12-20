'use client';

import { useCallback, useEffect } from 'react';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useAppStore } from '@/stores/app';
import { verifyWallet, getSession, logout, getSubscriptionStatus } from '@/lib/api';
import { formatWallet, signMessageWithWallet } from '@/lib/wallet';

export function useWallet() {
  const {
    wallet: adapterWallet,
    publicKey,
    connected,
    connecting,
    disconnect: adapterDisconnect,
    signMessage: adapterSignMessage,
  } = useSolanaWallet();

  const { setVisible } = useWalletModal();

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

  const walletAddress = publicKey?.toBase58() || null;

  // Sync wallet adapter state with app store
  useEffect(() => {
    if (connected && walletAddress && !wallet) {
      // Wallet connected via adapter but not authenticated yet
      authenticateWallet(walletAddress);
    } else if (!connected && wallet) {
      // Wallet disconnected
      handleLogout();
    }
  }, [connected, walletAddress, wallet]);

  // Check session on mount
  useEffect(() => {
    const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours

    const checkSession = async () => {
      const lastActivity = localStorage.getItem('lastActivity');
      if (lastActivity) {
        const elapsed = Date.now() - parseInt(lastActivity, 10);
        if (elapsed >= INACTIVITY_TIMEOUT) {
          localStorage.removeItem('lastActivity');
          await logout();
          return;
        }
      }

      const response = await getSession();
      if (response.success && response.data) {
        setWallet(response.data.wallet, walletType);
        setIsAdmin(response.data.isAdmin);

        const subResponse = await getSubscriptionStatus(response.data.wallet);
        if (subResponse.success && subResponse.data) {
          setSubscription(subResponse.data);
        }

        if (!lastActivity) {
          localStorage.setItem('lastActivity', Date.now().toString());
        }
      }
    };

    checkSession();
  }, []);

  // Auto-logout after 2 hours of inactivity
  useEffect(() => {
    if (!wallet) return;

    const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000;
    const CHECK_INTERVAL = 30 * 1000;

    const checkAndLogout = async () => {
      const lastActivity = localStorage.getItem('lastActivity');
      if (lastActivity) {
        const elapsed = Date.now() - parseInt(lastActivity, 10);
        if (elapsed >= INACTIVITY_TIMEOUT) {
          await handleLogout();
          return true;
        }
      }
      return false;
    };

    checkAndLogout();

    const updateActivity = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, updateActivity, { passive: true }));

    const interval = setInterval(checkAndLogout, CHECK_INTERVAL);

    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity));
      clearInterval(interval);
    };
  }, [wallet]);

  // Authenticate wallet with backend
  const authenticateWallet = async (address: string) => {
    try {
      if (!adapterSignMessage) {
        addToast('error', 'Wallet does not support message signing');
        return;
      }

      const timestamp = Date.now();
      const message = `Sign this message to authenticate with Hussayn Alpha.\n\nWallet: ${address}\nTimestamp: ${timestamp}`;

      const encodedMessage = new TextEncoder().encode(message);
      const signatureBytes = await adapterSignMessage(encodedMessage);

      // Convert to base58
      const bs58 = await import('bs58');
      const signature = bs58.default.encode(signatureBytes);

      const response = await verifyWallet(address, signature, message);
      if (!response.success) {
        addToast('error', response.error || 'Authentication failed');
        return;
      }

      const walletName = adapterWallet?.adapter?.name?.toLowerCase() || 'phantom';
      setWallet(address, walletName as 'phantom' | 'solflare');

      const sessionResponse = await getSession();
      if (sessionResponse.success && sessionResponse.data) {
        setIsAdmin(sessionResponse.data.isAdmin);
      }

      const subResponse = await getSubscriptionStatus(address);
      if (subResponse.success && subResponse.data) {
        setSubscription(subResponse.data);
      }

      localStorage.setItem('lastActivity', Date.now().toString());
      addToast('success', 'Wallet connected');
    } catch (error) {
      console.error('Authentication error:', error);
      addToast('error', 'Failed to authenticate wallet');
    }
  };

  // Open wallet modal (works on desktop AND mobile)
  const connect = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  // Handle logout
  const handleLogout = async () => {
    await logout();
    setWallet(null, null);
    setSubscription(null);
    setIsAdmin(false);
    localStorage.removeItem('lastActivity');
  };

  // Disconnect
  const disconnect = useCallback(async () => {
    try {
      await adapterDisconnect();
    } catch (e) {
      console.error('Disconnect error:', e);
    }
    await handleLogout();
    addToast('info', 'Wallet disconnected');
    window.location.href = '/';
  }, [adapterDisconnect, addToast]);

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
    isConnecting: connecting,
    hasPhantom: true, // Always true - adapter handles availability
    hasSolflare: true, // Always true - adapter handles availability
    subscription,
    isAdmin,
    isPremium: subscription?.isActive || false,
    connect,
    disconnect,
    refreshSubscription,
    // Expose adapter for payment transactions
    adapterWallet,
    publicKey,
    signMessage: adapterSignMessage,
  };
}
