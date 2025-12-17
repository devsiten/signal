// Settings routes (public)

import type { RequestContext } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { getSettings } from '../utils/db';

export async function handleSettings(ctx: RequestContext): Promise<Response> {
  const { request, url, env } = ctx;
  const path = url.pathname;

  // GET /api/settings - Get public settings
  if (path === '/api/settings' && request.method === 'GET') {
    const settings = await getSettings(env.DB);
    return jsonResponse(settings, request);
  }

  return errorResponse('Not found', 404, request);
}
