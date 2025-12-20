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
  const authAttemptedRef = useRef(false);

  const walletAddress = publicKey?.toBase58() || null;

  // Get only Phantom and Solflare from available wallets
  const phantomWallet = wallets.find(w => w.adapter.name === 'Phantom');
  const solflareWallet = wallets.find(w => w.adapter.name === 'Solflare');

  // Check if wallets are available
  const hasPhantom = !!phantomWallet;
  const hasSolflare = !!solflareWallet;

  // Authenticate wallet with backend after connection
  useEffect(() => {
    // Skip if:
    // 1. Not connected
    // 2. No wallet address from adapter
    // 3. Already authenticating
    // 4. Already attempted auth for this connection
    // 5. Wallet address matches what's already in our app store (already authenticated)
    if (!connected || !walletAddress || isAuthenticating || authAttemptedRef.current) {
      return;
    }

    // If the connected wallet address matches our stored wallet, we're already authenticated
    if (wallet === walletAddress) {
      console.log('Already authenticated with this wallet');
      return;
    }

    // Mark that we're attempting auth
    authAttemptedRef.current = true;

    const doAuth = async () => {
      setIsAuthenticating(true);

      try {
        // Check if signMessage is available
        if (!adapterSignMessage) {
          console.error('signMessage not available yet, retrying...');
          // Retry after a short delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (!adapterSignMessage) {
            throw new Error('Wallet does not support message signing');
          }
        }

        const timestamp = Date.now();
        const message = `Sign this message to authenticate with Hussayn Alpha.\n\nWallet: ${walletAddress}\nTimestamp: ${timestamp}`;

        console.log('Requesting signature...');
        const encodedMessage = new TextEncoder().encode(message);
        const signatureBytes = await adapterSignMessage(encodedMessage);
        console.log('Signature received');

        // Convert to base58
        const bs58 = await import('bs58');
        const signature = bs58.default.encode(signatureBytes);

        console.log('Verifying with backend...');
        const response = await verifyWallet(walletAddress, signature, message);

        if (!response.success) {
          throw new Error(response.error || 'Authentication failed');
        }

        console.log('Backend verified, setting wallet state...');
        const walletName = adapterWallet?.adapter?.name?.toLowerCase() || 'phantom';
        setWallet(walletAddress, walletName as 'phantom' | 'solflare');

        // Get session info
        const sessionResponse = await getSession();
        if (sessionResponse.success && sessionResponse.data) {
          setIsAdmin(sessionResponse.data.isAdmin);
        }

        // Get subscription status
        const subResponse = await getSubscriptionStatus(walletAddress);
        if (subResponse.success && subResponse.data) {
          setSubscription(subResponse.data);
        }

        localStorage.setItem('lastActivity', Date.now().toString());
        addToast('success', 'Wallet connected');
        console.log('Connection complete!');

      } catch (error: any) {
        console.error('Authentication error:', error);
        authAttemptedRef.current = false; // Allow retry

        if (error?.message?.includes('User rejected') || error?.message?.includes('cancelled')) {
          addToast('error', 'Signing cancelled');
          // Disconnect since user rejected
          try { await adapterDisconnect(); } catch { }
        } else {
          addToast('error', error.message || 'Connection failed');
        }
      } finally {
        setIsAuthenticating(false);
      }
    };

    doAuth();
  }, [connected, walletAddress, wallet, isAuthenticating, adapterSignMessage, adapterWallet]);

  // Reset auth attempt flag when disconnected
  useEffect(() => {
    if (!connected) {
      authAttemptedRef.current = false;
    }
  }, [connected]);

  // Handle disconnection - clear our app state
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

  // Connect to specific wallet - select and then connect
  const connectToWallet = useCallback(async (walletName: 'Phantom' | 'Solflare') => {
    try {
      setShowWalletModal(false);

      const targetWallet = walletName === 'Phantom' ? phantomWallet : solflareWallet;

      if (!targetWallet) {
        // Wallet not installed - redirect to download
        const url = walletName === 'Phantom'
          ? 'https://phantom.app/'
          : 'https://solflare.com/';
        window.open(url, '_blank');
        return;
      }

      // Select the wallet adapter
      select(targetWallet.adapter.name);

      // Small delay then connect
      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger connect - this will cause the wallet to prompt for connection
      try {
        await adapterConnect();
      } catch (err: any) {
        // User might have rejected, or wallet might auto-connect
        if (!err?.message?.includes('rejected')) {
          console.log('Connect triggered, adapter will handle it');
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
