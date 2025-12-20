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
    connect: adapterConnect,
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

  // Track which wallet addresses we've already tried to authenticate
  const authenticatedAddressRef = useRef<string | null>(null);

  const walletAddress = publicKey?.toBase58() || null;

  // Get only Phantom and Solflare from available wallets
  const phantomWallet = wallets.find(w => w.adapter.name === 'Phantom');
  const solflareWallet = wallets.find(w => w.adapter.name === 'Solflare');

  // Check if wallets are available
  const hasPhantom = !!phantomWallet;
  const hasSolflare = !!solflareWallet;

  // Authenticate wallet with backend - ONE TIME ONLY per wallet address
  useEffect(() => {
    // Don't do anything if not connected or no address
    if (!connected || !walletAddress) {
      return;
    }

    // Already authenticated with this address in our store
    if (wallet === walletAddress) {
      return;
    }

    // Already attempted/completed auth for this specific address in this session
    if (authenticatedAddressRef.current === walletAddress) {
      return;
    }

    // Already in the middle of authenticating
    if (isAuthenticating) {
      return;
    }

    // Mark this address as being handled - NEVER reset this for the same address
    authenticatedAddressRef.current = walletAddress;

    const doAuth = async () => {
      setIsAuthenticating(true);

      try {
        // Wait for signMessage to be ready
        if (!adapterSignMessage) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (!adapterSignMessage) {
          addToast('error', 'Wallet does not support signing');
          setIsAuthenticating(false);
          return;
        }

        const timestamp = Date.now();
        const message = `Sign this message to authenticate with Hussayn Alpha.\n\nWallet: ${walletAddress}\nTimestamp: ${timestamp}`;

        const encodedMessage = new TextEncoder().encode(message);
        const signatureBytes = await adapterSignMessage(encodedMessage);

        const bs58 = await import('bs58');
        const signature = bs58.default.encode(signatureBytes);

        const response = await verifyWallet(walletAddress, signature, message);

        if (!response.success) {
          addToast('error', response.error || 'Authentication failed');
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
        console.error('Auth error:', error);
        // User rejected - disconnect
        if (error?.message?.includes('User rejected') || error?.message?.includes('cancelled')) {
          addToast('error', 'Signing cancelled');
          try { await adapterDisconnect(); } catch { }
        } else {
          addToast('error', 'Connection failed');
        }
        // DON'T reset authenticatedAddressRef - we don't want to retry automatically
      } finally {
        setIsAuthenticating(false);
      }
    };

    doAuth();
  }, [connected, walletAddress]); // Minimal dependencies

  // Clear auth tracking when wallet disconnects
  useEffect(() => {
    if (!connected && !walletAddress) {
      authenticatedAddressRef.current = null;
    }
  }, [connected, walletAddress]);

  // Handle disconnection - clear our app state
  useEffect(() => {
    if (!connected && wallet) {
      handleLogout();
    }
  }, [connected, wallet]);

  // Check session on mount
  useEffect(() => {
    const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000;

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

        // Mark as already authenticated
        authenticatedAddressRef.current = response.data.wallet;

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
      setShowWalletModal(false);

      const targetWallet = walletName === 'Phantom' ? phantomWallet : solflareWallet;

      if (!targetWallet) {
        const url = walletName === 'Phantom'
          ? 'https://phantom.app/'
          : 'https://solflare.com/';
        window.open(url, '_blank');
        return;
      }

      // Reset auth tracking for new connection attempt
      authenticatedAddressRef.current = null;

      select(targetWallet.adapter.name);

      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        await adapterConnect();
      } catch (err: any) {
        if (!err?.message?.includes('rejected')) {
          console.log('Connect triggered');
        }
      }

    } catch (error: any) {
      console.error('Connect error:', error);
      if (!error?.message?.includes('rejected')) {
        addToast('error', 'Failed to connect wallet');
      }
    }
  }, [phantomWallet, solflareWallet, select, adapterConnect, addToast]);

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
    authenticatedAddressRef.current = null;
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
    showWalletModal,
    closeWalletModal,
    adapterWallet,
    publicKey,
    signMessage: adapterSignMessage,
    connection,
  };
}
