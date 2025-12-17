// Subscription routes

import type { RequestContext } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { getSubscriptionStatus } from '../utils/db';

export async function handleSubscription(ctx: RequestContext): Promise<Response> {
  const { request, url, env } = ctx;
  const path = url.pathname;

  // GET /api/subscription/status - Get subscription status for wallet
  if (path === '/api/subscription/status' && request.method === 'GET') {
    const wallet = url.searchParams.get('wallet');

    if (!wallet) {
      return errorResponse('Wallet parameter required', 400, request);
    }

    const status = await getSubscriptionStatus(env.DB, wallet);

    return jsonResponse(status, request);
  }

  return errorResponse('Not found', 404, request);
}
