// Payment routes with Solana on-chain verification

import type { RequestContext, Payment } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { withAuth, requireAuth } from './auth';
import { getSettings, ensureUser, extendSubscription } from '../utils/db';
import { randomHex, isValidSolanaAddress, base58Decode } from '../utils/crypto';

// Generate a new keypair for payment reference
function generateReference(): string {
  // Generate 32 random bytes and encode as base58-like string
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  
  let result = '';
  let value = BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''));
  
  while (value > 0n) {
    result = ALPHABET[Number(value % 58n)] + result;
    value = value / 58n;
  }
  
  // Pad to standard Solana pubkey length
  while (result.length < 32) {
    result = ALPHABET[0] + result;
  }
  
  return result.slice(0, 44); // Solana pubkey length
}

// Verify transaction on-chain
async function verifyTransaction(
  rpcUrl: string,
  signature: string,
  expectedReference: string,
  expectedAmount: number,
  treasuryWallet: string
): Promise<{ verified: boolean; error?: string }> {
  try {
    // Fetch transaction from Solana RPC
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          signature,
          { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
        ],
      }),
    });

    const data = await response.json() as any;

    if (!data.result) {
      return { verified: false, error: 'Transaction not found' };
    }

    const tx = data.result;

    // Check if transaction was successful
    if (tx.meta?.err) {
      return { verified: false, error: 'Transaction failed' };
    }

    // Get the transfer instruction
    const instructions = tx.transaction?.message?.instructions || [];
    const accountKeys = tx.transaction?.message?.accountKeys || [];
    
    // Look for a system program transfer
    let foundTransfer = false;
    let transferAmount = 0;
    let toAddress = '';

    for (const ix of instructions) {
      // Check parsed transfer
      if (ix.parsed?.type === 'transfer' && ix.program === 'system') {
        const info = ix.parsed.info;
        toAddress = info.destination;
        transferAmount = info.lamports / 1e9; // Convert lamports to SOL
        foundTransfer = true;
        break;
      }
    }

    if (!foundTransfer) {
      return { verified: false, error: 'No transfer found in transaction' };
    }

    // Verify recipient
    if (toAddress.toLowerCase() !== treasuryWallet.toLowerCase()) {
      return { verified: false, error: 'Invalid recipient' };
    }

    // Verify amount (allow small variance for rounding)
    if (Math.abs(transferAmount - expectedAmount) > 0.001) {
      return { verified: false, error: `Invalid amount: expected ${expectedAmount}, got ${transferAmount}` };
    }

    // Check for reference in account keys
    const allKeys = accountKeys.map((k: any) => 
      typeof k === 'string' ? k : k.pubkey
    );
    
    const hasReference = allKeys.some((key: string) => 
      key === expectedReference
    );

    if (!hasReference) {
      return { verified: false, error: 'Reference not found in transaction' };
    }

    return { verified: true };
  } catch (error) {
    console.error('Transaction verification error:', error);
    return { verified: false, error: 'Verification failed' };
  }
}

export async function handlePayments(ctx: RequestContext): Promise<Response> {
  const { request, url, env } = ctx;
  const path = url.pathname;

  // POST /api/payment/create - Create payment reference
  if (path === '/api/payment/create' && request.method === 'POST') {
    // Check auth
    const authError = await requireAuth(ctx);
    if (authError) return authError;

    try {
      const body = await request.json() as { wallet: string };
      const { wallet } = body;

      if (!wallet || !isValidSolanaAddress(wallet)) {
        return errorResponse('Invalid wallet', 400, request);
      }

      // Check if paused
      const settings = await getSettings(env.DB);
      if (settings.is_paused) {
        return errorResponse('Subscriptions are currently paused', 400, request);
      }

      // Generate unique reference
      const reference = generateReference();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

      // Ensure user exists
      await ensureUser(env.DB, wallet);

      // Create payment record
      await env.DB
        .prepare(
          `INSERT INTO payments (reference, wallet, amount, status, expires_at)
           VALUES (?, ?, ?, 'pending', ?)`
        )
        .bind(reference, wallet, settings.price_sol, expiresAt)
        .run();

      return jsonResponse({
        reference,
        amount: settings.price_sol,
        wallet,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      }, request);
    } catch (error) {
      console.error('Create payment error:', error);
      return errorResponse('Failed to create payment', 500, request);
    }
  }

  // POST /api/payment/verify - Verify payment and activate subscription
  if (path === '/api/payment/verify' && request.method === 'POST') {
    // Rate limit: could add KV-based rate limiting here
    
    try {
      const body = await request.json() as { 
        reference: string;
        txSignature: string;
      };

      const { reference, txSignature } = body;

      if (!reference || !txSignature) {
        return errorResponse('Missing reference or signature', 400, request);
      }

      // Get payment record
      const payment = await env.DB
        .prepare('SELECT * FROM payments WHERE reference = ?')
        .bind(reference)
        .first<Payment>();

      if (!payment) {
        return errorResponse('Payment reference not found', 404, request);
      }

      if (payment.status === 'completed') {
        return errorResponse('Payment already processed', 400, request);
      }

      if (new Date(payment.expires_at) < new Date()) {
        return errorResponse('Payment reference expired', 400, request);
      }

      // Verify on-chain
      const treasuryWallet = env.TREASURY_WALLET;
      if (!treasuryWallet) {
        return errorResponse('Treasury wallet not configured', 500, request);
      }

      const verification = await verifyTransaction(
        env.SOLANA_RPC,
        txSignature,
        reference,
        payment.amount,
        treasuryWallet
      );

      if (!verification.verified) {
        // Mark as failed
        await env.DB
          .prepare(
            `UPDATE payments SET status = 'failed' WHERE reference = ?`
          )
          .bind(reference)
          .run();

        return errorResponse(verification.error || 'Verification failed', 400, request);
      }

      // Get settings for subscription duration
      const settings = await getSettings(env.DB);

      // Extend subscription
      const newExpiry = await extendSubscription(
        env.DB,
        payment.wallet,
        settings.subscription_days
      );

      // Mark payment as completed
      await env.DB
        .prepare(
          `UPDATE payments 
           SET status = 'completed', tx_signature = ?, completed_at = datetime('now')
           WHERE reference = ?`
        )
        .bind(txSignature, reference)
        .run();

      return jsonResponse({
        success: true,
        txSignature,
        newExpiry,
      }, request);
    } catch (error) {
      console.error('Verify payment error:', error);
      return errorResponse('Payment verification failed', 500, request);
    }
  }

  return errorResponse('Not found', 404, request);
}
