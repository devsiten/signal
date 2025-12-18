import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

// Solana RPC endpoint
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const TREASURY_WALLET = process.env.NEXT_PUBLIC_TREASURY_WALLET || '';

export const connection = new Connection(RPC_ENDPOINT, 'confirmed');

// Get wallet provider
export function getPhantomProvider(): any | null {
  if (typeof window === 'undefined') return null;
  const provider = (window as any).phantom?.solana;
  if (provider?.isPhantom) return provider;
  return null;
}

export function getSolflareProvider(): any | null {
  if (typeof window === 'undefined') return null;
  const provider = (window as any).solflare;
  if (provider?.isSolflare) return provider;
  return null;
}

// Connect wallet
export async function connectWallet(type: 'phantom' | 'solflare'): Promise<string | null> {
  try {
    const provider = type === 'phantom' ? getPhantomProvider() : getSolflareProvider();
    if (!provider) {
      // Wallet extension not found - open install page
      if (type === 'phantom') {
        window.open('https://phantom.app/', '_blank');
      } else {
        window.open('https://solflare.com/', '_blank');
      }
      throw new Error(`${type} wallet not installed`);
    }

    const response = await provider.connect();
    return response.publicKey.toString();
  } catch (error: any) {
    console.error('Connect error:', error);
    // Re-throw with useful message
    if (error?.message?.includes('User rejected')) {
      throw new Error('Connection cancelled');
    }
    throw error;
  }
}

// Disconnect wallet
export async function disconnectWallet(type: 'phantom' | 'solflare'): Promise<void> {
  try {
    const provider = type === 'phantom' ? getPhantomProvider() : getSolflareProvider();
    if (provider) {
      await provider.disconnect();
    }
  } catch (error) {
    console.error('Disconnect error:', error);
  }
}

// Sign message for authentication
export async function signMessage(
  message: string,
  type: 'phantom' | 'solflare'
): Promise<string | null> {
  try {
    const provider = type === 'phantom' ? getPhantomProvider() : getSolflareProvider();
    if (!provider) return null;

    const encodedMessage = new TextEncoder().encode(message);
    const signedMessage = await provider.signMessage(encodedMessage, 'utf8');

    return bs58.encode(signedMessage.signature);
  } catch (error) {
    console.error('Sign message error:', error);
    return null;
  }
}

// Create payment transaction
export async function createPaymentTransaction(
  fromWallet: string,
  amountSol: number,
  reference: string
): Promise<Transaction | null> {
  try {
    if (!TREASURY_WALLET) {
      throw new Error('Treasury wallet not configured');
    }

    const fromPubkey = new PublicKey(fromWallet);
    const toPubkey = new PublicKey(TREASURY_WALLET);
    const referencePubkey = new PublicKey(reference);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const transaction = new Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: fromPubkey,
    });

    transaction.add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
      })
    );

    // Add reference for tracking
    transaction.instructions[0].keys.push({
      pubkey: referencePubkey,
      isSigner: false,
      isWritable: false,
    });

    return transaction;
  } catch (error) {
    console.error('Create transaction error:', error);
    return null;
  }
}

// Sign and send transaction
export async function signAndSendTransaction(
  transaction: Transaction,
  type: 'phantom' | 'solflare'
): Promise<string | null> {
  try {
    const provider = type === 'phantom' ? getPhantomProvider() : getSolflareProvider();
    if (!provider) return null;

    const { signature } = await provider.signAndSendTransaction(transaction);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');

    if (confirmation.value.err) {
      throw new Error('Transaction failed');
    }

    return signature;
  } catch (error) {
    console.error('Sign and send error:', error);
    return null;
  }
}

// Format wallet address
export function formatWallet(wallet: string, chars = 4): string {
  if (!wallet) return '';
  return `${wallet.slice(0, chars)}...${wallet.slice(-chars)}`;
}

// Validate Solana address
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

