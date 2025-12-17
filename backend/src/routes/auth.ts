// Authentication routes and middleware

import type { RequestContext, Session } from '../types';
import { jsonResponse, errorResponse, setCookieHeader, deleteCookieHeader, corsHeaders } from '../utils/response';
import { verifySignature, generateSessionToken, isValidSolanaAddress } from '../utils/crypto';
import { ensureUser, isAdminWallet } from '../utils/db';

const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

// Get session from cookie
export async function getSession(ctx: RequestContext): Promise<Session | null> {
  const cookie = ctx.request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  
  if (!match) return null;

  const token = match[1];
  
  const session = await ctx.env.DB
    .prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > datetime("now")')
    .bind(token)
    .first<Session>();

  return session || null;
}

// Auth middleware - adds wallet and isAdmin to context
export async function withAuth(ctx: RequestContext): Promise<RequestContext> {
  const session = await getSession(ctx);
  
  if (session) {
    ctx.wallet = session.wallet;
    ctx.isAdmin = isAdminWallet(session.wallet, ctx.env);
  }

  return ctx;
}

// Require auth middleware
export async function requireAuth(ctx: RequestContext): Promise<Response | null> {
  await withAuth(ctx);
  
  if (!ctx.wallet) {
    return errorResponse('Unauthorized', 401, ctx.request);
  }

  return null;
}

// Require admin middleware
export async function requireAdmin(ctx: RequestContext): Promise<Response | null> {
  await withAuth(ctx);
  
  if (!ctx.wallet) {
    return errorResponse('Unauthorized', 401, ctx.request);
  }

  if (!ctx.isAdmin) {
    return errorResponse('Forbidden', 403, ctx.request);
  }

  return null;
}

// Handle auth routes
export async function handleAuth(ctx: RequestContext): Promise<Response> {
  const { request, url, env } = ctx;
  const path = url.pathname;

  // POST /api/auth/verify - Verify wallet signature and create session
  if (path === '/api/auth/verify' && request.method === 'POST') {
    try {
      const body = await request.json() as {
        wallet: string;
        signature: string;
        message: string;
      };

      const { wallet, signature, message } = body;

      // Validate inputs
      if (!wallet || !signature || !message) {
        return errorResponse('Missing required fields', 400, request);
      }

      if (!isValidSolanaAddress(wallet)) {
        return errorResponse('Invalid wallet address', 400, request);
      }

      // Verify message contains the wallet
      if (!message.includes(wallet)) {
        return errorResponse('Invalid message', 400, request);
      }

      // Verify timestamp is within 5 minutes
      const timestampMatch = message.match(/Timestamp: (\d+)/);
      if (timestampMatch) {
        const timestamp = parseInt(timestampMatch[1], 10);
        const now = Date.now();
        if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
          return errorResponse('Message expired', 400, request);
        }
      }

      // Verify signature
      const isValid = await verifySignature(message, signature, wallet);
      if (!isValid) {
        return errorResponse('Invalid signature', 401, request);
      }

      // Ensure user exists
      await ensureUser(env.DB, wallet);

      // Create session
      const token = generateSessionToken();
      const expiresAt = new Date(Date.now() + SESSION_DURATION * 1000).toISOString();

      await env.DB
        .prepare('INSERT INTO sessions (token, wallet, expires_at) VALUES (?, ?, ?)')
        .bind(token, wallet, expiresAt)
        .run();

      // Clean up old sessions for this wallet
      await env.DB
        .prepare('DELETE FROM sessions WHERE wallet = ? AND expires_at < datetime("now")')
        .bind(wallet)
        .run();

      // Set cookie
      const headers = corsHeaders(request);
      headers.set('Content-Type', 'application/json');
      headers.set('Set-Cookie', setCookieHeader('session', token, SESSION_DURATION));

      return new Response(JSON.stringify({ success: true }), { headers });
    } catch (error) {
      console.error('Auth verify error:', error);
      return errorResponse('Authentication failed', 500, request);
    }
  }

  // GET /api/auth/session - Get current session info
  if (path === '/api/auth/session' && request.method === 'GET') {
    await withAuth(ctx);

    if (!ctx.wallet) {
      return jsonResponse({ wallet: null, isAdmin: false }, request);
    }

    return jsonResponse({
      wallet: ctx.wallet,
      isAdmin: ctx.isAdmin,
    }, request);
  }

  // POST /api/auth/logout - Clear session
  if (path === '/api/auth/logout' && request.method === 'POST') {
    const session = await getSession(ctx);

    if (session) {
      await env.DB
        .prepare('DELETE FROM sessions WHERE token = ?')
        .bind(session.token)
        .run();
    }

    const headers = corsHeaders(request);
    headers.set('Content-Type', 'application/json');
    headers.set('Set-Cookie', deleteCookieHeader('session'));

    return new Response(JSON.stringify({ success: true }), { headers });
  }

  return errorResponse('Not found', 404, request);
}
