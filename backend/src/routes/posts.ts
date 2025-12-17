// Posts routes (public)

import type { RequestContext, Post } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { withAuth } from './auth';
import { getSubscriptionStatus, generatePreview, formatMonthLabel } from '../utils/db';

export async function handlePosts(ctx: RequestContext): Promise<Response> {
  const { request, url, env } = ctx;
  const path = url.pathname;

  // GET /api/posts - List posts with previews
  if (path === '/api/posts' && request.method === 'GET') {
    const month = url.searchParams.get('month');
    
    // Build query
    let query = 'SELECT * FROM posts';
    const params: string[] = [];
    
    if (month) {
      query += ' WHERE month = ?';
      params.push(month);
    }
    
    query += ' ORDER BY created_at DESC';

    const result = await env.DB
      .prepare(query)
      .bind(...params)
      .all<Post>();

    const posts = result.results || [];

    // Get unique months for filtering
    const monthsResult = await env.DB
      .prepare(
        `SELECT month, COUNT(*) as count 
         FROM posts 
         GROUP BY month 
         ORDER BY month DESC`
      )
      .all<{ month: string; count: number }>();

    const months = (monthsResult.results || []).map((m) => ({
      month: m.month,
      label: formatMonthLabel(m.month),
      postCount: m.count,
    }));

    // Transform posts to previews
    const previews = posts.map((post) => {
      const images = JSON.parse(post.images || '[]') as string[];
      return {
        id: post.id,
        title: post.title,
        preview: generatePreview(post.content),
        month: post.month,
        is_premium: post.is_premium === 1,
        created_at: post.created_at,
        image_count: images.length,
      };
    });

    return jsonResponse({ posts: previews, months }, request);
  }

  // GET /api/posts/:id - Get single post
  const postMatch = path.match(/^\/api\/posts\/(\d+)$/);
  if (postMatch && request.method === 'GET') {
    const postId = parseInt(postMatch[1], 10);
    const walletParam = url.searchParams.get('wallet');

    // Get post
    const post = await env.DB
      .prepare('SELECT * FROM posts WHERE id = ?')
      .bind(postId)
      .first<Post>();

    if (!post) {
      return errorResponse('Post not found', 404, request);
    }

    // Check if user has premium access
    let hasPremiumAccess = false;
    
    // Check session
    await withAuth(ctx);
    if (ctx.wallet) {
      const status = await getSubscriptionStatus(env.DB, ctx.wallet);
      hasPremiumAccess = status.isActive;
    }
    
    // Also check wallet param (for API calls)
    if (!hasPremiumAccess && walletParam) {
      const status = await getSubscriptionStatus(env.DB, walletParam);
      hasPremiumAccess = status.isActive;
    }

    // If premium post and no access, return limited content
    if (post.is_premium === 1 && !hasPremiumAccess) {
      return jsonResponse({
        id: post.id,
        title: post.title,
        content: generatePreview(post.content, 300),
        images: [],
        month: post.month,
        is_premium: true,
        created_at: post.created_at,
        updated_at: post.updated_at,
        locked: true,
      }, request);
    }

    // Return full post
    return jsonResponse({
      id: post.id,
      title: post.title,
      content: post.content,
      images: JSON.parse(post.images || '[]'),
      month: post.month,
      is_premium: post.is_premium === 1,
      created_at: post.created_at,
      updated_at: post.updated_at,
    }, request);
  }

  return errorResponse('Not found', 404, request);
}
