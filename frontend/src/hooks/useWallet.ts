'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react';
import { useAppStore } from '@/stores/app';
import { verifyWallet, getSession, logout, getSubscriptionStatus } from '@/lib/api';
import { formatWallet } from '@/lib/wallet';

export function useWallet() {
  const {
    wallet: adapterWallet,
    publicKey,
    connected,
    connecting,
    disconnect: adapterDisconnect,
    signMessage: adapterSignMessage,
    select,
    wallets,
  } = useSolanaWallet();

  const { connection } = useConnection();

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

  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const hasAuthenticated = useRef(false);

  const walletAddress = publicKey?.toBase58() || null;

  // Get only Phantom and Solflare from available wallets
  const phantomWallet = wallets.find(w => w.adapter.name === 'Phantom');
  const solflareWallet = wallets.find(w => w.adapter.name === 'Solflare');

  // Check if wallets are available (installed or can deep-link)
  const hasPhantom = !!phantomWallet;
  const hasSolflare = !!solflareWallet;

  // Authenticate wallet with backend after connection
  useEffect(() => {
    const authenticate = async () => {
      if (connected && walletAddress && !wallet && !isAuthenticating && !hasAuthenticated.current) {
        hasAuthenticated.current = true;
        setIsAuthenticating(true);

        try {
          // Wait a bit for signMessage to be available
          await new Promise(resolve => setTimeout(resolve, 500));

          if (!adapterSignMessage) {
            console.error('signMessage not available');
            addToast('error', 'Please try connecting again');
            await adapterDisconnect();
            hasAuthenticated.current = false;
            setIsAuthenticating(false);
            return;
          }

          const timestamp = Date.now();
          const message = `Sign this message to authenticate with Hussayn Alpha.\n\nWallet: ${walletAddress}\nTimestamp: ${timestamp}`;

          const encodedMessage = new TextEncoder().encode(message);
          const signatureBytes = await adapterSignMessage(encodedMessage);

          // Convert to base58
          const bs58 = await import('bs58');
          const signature = bs58.default.encode(signatureBytes);

          const response = await verifyWallet(walletAddress, signature, message);
          if (!response.success) {
            addToast('error', response.error || 'Authentication failed');
            hasAuthenticated.current = false;
            setIsAuthenticating(false);
            return;
          }

          const walletName = adapterWallet?.adapter?.name?.toLowerCase() || 'phantom';
          setWallet(walletAddress, walletName as 'phantom' | 'solflare');

          const sessionResponse = await getSession();
          if (sessionResponse.success && sessionResponse.data) {
            setIsAdmin(sessionResponse.data.isAdmin);
          }

          const subResponse = await getSubscriptionStatus(walletAddress);
          if (subResponse.success && subResponse.data) {
            setSubscription(subResponse.data);
          }

          localStorage.setItem('lastActivity', Date.now().toString());
          addToast('success', 'Wallet connected');
        } catch (error: any) {
          console.error('Authentication error:', error);
          if (error?.message?.includes('User rejected')) {
            addToast('error', 'Signing cancelled');
          } else {
            addToast('error', 'Connection failed. Please try again.');
          }
          hasAuthenticated.current = false;
        } finally {
          setIsAuthenticating(false);
        }
      }
    };

    authenticate();
  }, [connected, walletAddress, wallet, adapterSignMessage]);

  // Reset auth flag when disconnected
  useEffect(() => {
    if (!connected) {
      hasAuthenticated.current = false;
    }
  }, [connected]);

  // Handle disconnection
  useEffect(() => {
    if (!connected && wallet) {
      handleLogout();
    }
  }, [connected, wallet]);

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

  // Connect to specific wallet
  const connectToWallet = useCallback(async (walletName: 'Phantom' | 'Solflare') => {
    try {
      const targetWallet = walletName === 'Phantom' ? phantomWallet : solflareWallet;
      if (targetWallet) {
        select(targetWallet.adapter.name);
        setShowWalletModal(false);
      } else {
        // Wallet not installed - redirect to download
        const url = walletName === 'Phantom'
          ? 'https://phantom.app/'
          : 'https://solflare.com/';
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Connect error:', error);
      addToast('error', 'Failed to connect wallet');
    }
  }, [phantomWallet, solflareWallet, select, addToast]);

  // Open custom wallet modal
  const connect = useCallback(() => {
    setShowWalletModal(true);
  }, []);

  // Close wallet modal
  const closeWalletModal = useCallback(() => {
    setShowWalletModal(false);
  }, []);

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
    isConnecting: connecting || isAuthenticating,
    hasPhantom,
    hasSolflare,
    subscription,
    isAdmin,
    isPremium: subscription?.isActive || false,
    connect,
    connectToWallet,
    disconnect,
    refreshSubscription,
    // Custom modal state
    showWalletModal,
    closeWalletModal,
    // Expose adapter for payment transactions
    adapterWallet,
    publicKey,
    signMessage: adapterSignMessage,
    connection,
  };
}
