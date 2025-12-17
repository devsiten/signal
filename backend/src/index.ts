// Hussayn Signal API - Cloudflare Worker
// Main entry point

import { handleAuth } from './routes/auth';
import { handlePosts } from './routes/posts';
import { handlePayments } from './routes/payments';
import { handleSubscription } from './routes/subscription';
import { handleSettings } from './routes/settings';
import { handleAdmin } from './routes/admin';
import { corsHeaders, jsonResponse, errorResponse } from './utils/response';
import type { Env, RequestContext } from './types';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Create request context
    const context: RequestContext = {
      request,
      env,
      ctx,
      url,
    };

    try {
      // Route handlers
      if (path.startsWith('/api/auth')) {
        return await handleAuth(context);
      }

      if (path.startsWith('/api/posts')) {
        return await handlePosts(context);
      }

      if (path.startsWith('/api/payment')) {
        return await handlePayments(context);
      }

      if (path.startsWith('/api/subscription')) {
        return await handleSubscription(context);
      }

      if (path.startsWith('/api/settings')) {
        return await handleSettings(context);
      }

      if (path.startsWith('/api/admin')) {
        return await handleAdmin(context);
      }

      // Health check
      if (path === '/api/health') {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }, request);
      }

      // 404
      return errorResponse('Not found', 404, request);
    } catch (error) {
      console.error('Request error:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Internal server error',
        500,
        request
      );
    }
  },
};
