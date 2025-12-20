'use client';

import { useCallback, useEffect, useState } from 'react';
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
  const [needsAuth, setNeedsAuth] = useState(false);

  const walletAddress = publicKey?.toBase58() || null;

  // Get wallet adapters
  const phantomWallet = wallets.find(w => w.adapter.name === 'Phantom');
  const solflareWallet = wallets.find(w => w.adapter.name === 'Solflare');

  // Check if actually installed - only 'Installed' means the extension is present
  // 'Loadable' just means the adapter can be loaded, not that the wallet is installed
  const hasPhantom = phantomWallet?.readyState === 'Installed';
  const hasSolflare = solflareWallet?.readyState === 'Installed';

  // Track if we've already checked session for this wallet
  const [sessionCheckedFor, setSessionCheckedFor] = useState<string | null>(null);

  // When wallet connects, check if we need to authenticate
  useEffect(() => {
    if (connected && walletAddress) {
      // If wallet address matches our stored wallet, we're already authenticated
      if (wallet === walletAddress) {
        setNeedsAuth(false);
      } else if (sessionCheckedFor === walletAddress) {
        // Already checked session for this wallet and it failed - need auth
        setNeedsAuth(true);
      } else {
        // Check if this wallet has a valid session before asking for auth
        const checkExistingSession = async () => {
          const response = await getSession();
          if (response.success && response.data && response.data.wallet === walletAddress) {
            // Session is valid for this wallet - sync state without requiring re-auth
            setWallet(response.data.wallet, adapterWallet?.adapter?.name?.toLowerCase() as 'phantom' | 'solflare' || null);
            setIsAdmin(response.data.isAdmin);
            setNeedsAuth(false);

            // Also refresh subscription
            const subResponse = await getSubscriptionStatus(response.data.wallet);
            if (subResponse.success && subResponse.data) {
              setSubscription(subResponse.data);
            }
          } else {
            // No valid session - need to authenticate
            setNeedsAuth(true);
          }
          setSessionCheckedFor(walletAddress);
        };
        checkExistingSession();
      }
    } else {
      setNeedsAuth(false);
    }
  }, [connected, walletAddress, wallet, sessionCheckedFor, adapterWallet, setWallet, setIsAdmin, setSubscription]);

  // Clear state when disconnected - but NOT on initial page load
  // The wallet adapter takes time to reconnect on page refresh
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    // Mark as initialized after a short delay to allow autoConnect to work
    const timer = setTimeout(() => setHasInitialized(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Only logout if:
    // 1. We've passed the initial load period
    // 2. Wallet adapter is disconnected
    // 3. We have a stored wallet (meaning user was previously connected)
    // 4. Wallet adapter is not currently trying to connect
    if (hasInitialized && !connected && !connecting && wallet) {
      handleLogout();
    }
  }, [connected, connecting, wallet, hasInitialized]);

  // Note: Session check is now handled in the connection effect above
  // to prevent race conditions with autoConnect

  // === SESSION EXPIRATION: Auto-logout after 2 hours ===
  const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

  useEffect(() => {
    if (!wallet) return;

    // Check session expiration every minute
    const checkExpiration = () => {
      const lastActivity = localStorage.getItem('lastActivity');
      if (lastActivity) {
        const elapsed = Date.now() - parseInt(lastActivity, 10);
        if (elapsed > SESSION_TIMEOUT_MS) {
          addToast('info', 'Session expired. Please reconnect your wallet.');
          handleLogout();
          adapterDisconnect().catch(() => { });
          window.location.href = '/';
        }
      }
    };

    // Check immediately and then every minute
    checkExpiration();
    const interval = setInterval(checkExpiration, 60 * 1000);

    // Update lastActivity on user interaction
    const updateActivity = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
    };

    window.addEventListener('click', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('scroll', updateActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, [wallet, adapterDisconnect, addToast]);

  // MANUAL auth - called when user clicks "Sign to Continue"
  const authenticateWallet = useCallback(async () => {
    if (!connected || !walletAddress || !adapterSignMessage) {
      addToast('error', 'Wallet not ready');
      return;
    }

    setIsAuthenticating(true);

    try {
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
      setNeedsAuth(false);

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
      if (error?.message?.includes('User rejected') || error?.message?.includes('cancelled')) {
        addToast('error', 'Signing cancelled');
      } else {
        addToast('error', 'Connection failed');
      }
    } finally {
      setIsAuthenticating(false);
    }
  }, [connected, walletAddress, adapterSignMessage, adapterWallet, addToast, setWallet, setIsAdmin, setSubscription]);

  // Connect to specific wallet
  const connectToWallet = useCallback(async (walletName: 'Phantom' | 'Solflare') => {
    setShowWalletModal(false);

    const targetWallet = walletName === 'Phantom' ? phantomWallet : solflareWallet;

    if (!targetWallet) {
      const url = walletName === 'Phantom' ? 'https://phantom.app/' : 'https://solflare.com/';
      window.open(url, '_blank');
      return;
    }

    try {
      select(targetWallet.adapter.name);
      await new Promise(resolve => setTimeout(resolve, 200));
      await adapterConnect();
    } catch (err: any) {
      if (!err?.message?.includes('rejected')) {
        console.log('Connect initiated');
      }
    }
  }, [phantomWallet, solflareWallet, select, adapterConnect]);

  const connect = useCallback(() => {
    setShowWalletModal(true);
  }, []);

  const closeWalletModal = useCallback(() => {
    setShowWalletModal(false);
  }, []);

  const handleLogout = async () => {
    await logout();
    setWallet(null, null);
    setSubscription(null);
    setIsAdmin(false);
    setNeedsAuth(false);
    localStorage.removeItem('lastActivity');
  };

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
    // Modal
    connect,
    connectToWallet,
    disconnect,
    showWalletModal,
    closeWalletModal,
    // Manual auth
    needsAuth,
    authenticateWallet,
    // Wallet adapter stuff
    refreshSubscription,
    adapterWallet,
    publicKey,
    signMessage: adapterSignMessage,
    connection,
    walletAddress,
  };
}
