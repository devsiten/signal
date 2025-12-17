'use client';

import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useAppStore } from '@/stores/app';
import { createPaymentReference, verifyPayment } from '@/lib/api';
import { createPaymentTransaction, signAndSendTransaction } from '@/lib/wallet';
import { cn } from '@/lib/utils';

interface PaymentButtonProps {
  className?: string;
  onSuccess?: () => void;
}

export function PaymentButton({ className, onSuccess }: PaymentButtonProps) {
  const { wallet, walletType, isConnected, refreshSubscription } = useWallet();
  const { settings, addToast } = useAppStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'idle' | 'creating' | 'signing' | 'verifying'>('idle');

  const isPaused = settings?.is_paused;
  const price = settings?.price_sol || 0.5;

  const handlePayment = async () => {
    if (!wallet || !walletType || isProcessing || isPaused) return;

    setIsProcessing(true);
    try {
      // Step 1: Create payment reference
      setStep('creating');
      const refResponse = await createPaymentReference(wallet);
      if (!refResponse.success || !refResponse.data) {
        throw new Error(refResponse.error || 'Failed to create payment reference');
      }

      const { reference, amount } = refResponse.data;

      // Step 2: Create and sign transaction
      setStep('signing');
      const transaction = await createPaymentTransaction(wallet, amount, reference);
      if (!transaction) {
        throw new Error('Failed to create transaction');
      }

      const signature = await signAndSendTransaction(transaction, walletType);
      if (!signature) {
        throw new Error('Transaction cancelled or failed');
      }

      // Step 3: Verify payment on server
      setStep('verifying');
      const verifyResponse = await verifyPayment(reference, signature);
      if (!verifyResponse.success || !verifyResponse.data?.success) {
        throw new Error(verifyResponse.error || 'Payment verification failed');
      }

      // Success!
      await refreshSubscription();
      addToast('success', 'Subscription activated! Welcome to Premium.');
      onSuccess?.();
    } catch (error) {
      console.error('Payment error:', error);
      addToast('error', error instanceof Error ? error.message : 'Payment failed');
    } finally {
      setIsProcessing(false);
      setStep('idle');
    }
  };

  if (!isConnected) {
    return (
      <button disabled className={cn('btn bg-bg-tertiary text-text-muted cursor-not-allowed', className)}>
        Connect wallet to subscribe
      </button>
    );
  }

  if (isPaused) {
    return (
      <button disabled className={cn('btn bg-bg-tertiary text-text-muted cursor-not-allowed', className)}>
        Subscriptions Paused
      </button>
    );
  }

  return (
    <button
      onClick={handlePayment}
      disabled={isProcessing}
      className={cn(
        'btn btn-primary relative overflow-hidden',
        isProcessing && 'cursor-wait',
        className
      )}
    >
      {isProcessing && (
        <div className="absolute inset-0 shimmer" />
      )}
      <span className="relative flex items-center gap-2">
        {step === 'creating' && (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Creating payment...
          </>
        )}
        {step === 'signing' && (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Sign in wallet...
          </>
        )}
        {step === 'verifying' && (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Verifying...
          </>
        )}
        {step === 'idle' && (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Subscribe for {price} SOL
          </>
        )}
      </span>
    </button>
  );
}
