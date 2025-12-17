// Admin routes (protected)

import type { RequestContext, Post } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { requireAdmin } from './auth';
import { getSettings, updateSetting, formatMonthLabel, getCurrentMonth } from '../utils/db';

export async function handleAdmin(ctx: RequestContext): Promise<Response> {
  const { request, url, env } = ctx;
  const path = url.pathname;

  // Check admin auth for all admin routes
  const authError = await requireAdmin(ctx);
  if (authError) return authError;

  // GET /api/admin/stats - Get dashboard stats
  if (path === '/api/admin/stats' && request.method === 'GET') {
    try {
      // Total users
      const usersResult = await env.DB
        .prepare('SELECT COUNT(*) as count FROM users')
        .first<{ count: number }>();

      // Active subscribers
      const subscribersResult = await env.DB
        .prepare('SELECT COUNT(*) as count FROM subscriptions WHERE expires_at > datetime("now")')
        .first<{ count: number }>();

      // Total posts
      const postsResult = await env.DB
        .prepare('SELECT COUNT(*) as count FROM posts')
        .first<{ count: number }>();

      // Total completed payments and revenue
      const paymentsResult = await env.DB
        .prepare('SELECT COUNT(*) as count, SUM(amount) as revenue FROM payments WHERE status = "completed"')
        .first<{ count: number; revenue: number }>();

      return jsonResponse({
        totalUsers: usersResult?.count || 0,
        activeSubscribers: subscribersResult?.count || 0,
        totalPosts: postsResult?.count || 0,
        totalPayments: paymentsResult?.count || 0,
        revenue: paymentsResult?.revenue || 0,
      }, request);
    } catch (error) {
      console.error('Admin stats error:', error);
      return errorResponse('Failed to get stats', 500, request);
    }
  }

  // GET /api/admin/posts - Get all posts (full content)
  if (path === '/api/admin/posts' && request.method === 'GET') {
    const result = await env.DB
      .prepare('SELECT * FROM posts ORDER BY created_at DESC')
      .all<Post>();

    const posts = (result.results || []).map((post) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      images: JSON.parse(post.images || '[]'),
      month: post.month,
      is_premium: post.is_premium === 1,
      created_at: post.created_at,
      updated_at: post.updated_at,
    }));

    return jsonResponse(posts, request);
  }

  // POST /api/admin/posts - Create post
  if (path === '/api/admin/posts' && request.method === 'POST') {
    try {
      const body = await request.json() as {
        title: string;
        content: string;
        images: string[];
        month: string;
        is_premium: boolean;
      };

      const { title, content, images, month, is_premium } = body;

      if (!title?.trim()) {
        return errorResponse('Title is required', 400, request);
      }

      if (!content?.trim()) {
        return errorResponse('Content is required', 400, request);
      }

      const postMonth = month || getCurrentMonth();

      const result = await env.DB
        .prepare(
          `INSERT INTO posts (title, content, images, month, is_premium)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(
          title.trim(),
          content.trim(),
          JSON.stringify(images || []),
          postMonth,
          is_premium ? 1 : 0
        )
        .run();

      const newPost = await env.DB
        .prepare('SELECT * FROM posts WHERE id = ?')
        .bind(result.meta.last_row_id)
        .first<Post>();

      return jsonResponse({
        id: newPost!.id,
        title: newPost!.title,
        content: newPost!.content,
        images: JSON.parse(newPost!.images || '[]'),
        month: newPost!.month,
        is_premium: newPost!.is_premium === 1,
        created_at: newPost!.created_at,
        updated_at: newPost!.updated_at,
      }, request, 201);
    } catch (error) {
      console.error('Create post error:', error);
      return errorResponse('Failed to create post', 500, request);
    }
  }

  // PUT /api/admin/posts/:id - Update post
  const updateMatch = path.match(/^\/api\/admin\/posts\/(\d+)$/);
  if (updateMatch && request.method === 'PUT') {
    try {
      const postId = parseInt(updateMatch[1], 10);

      const existing = await env.DB
        .prepare('SELECT * FROM posts WHERE id = ?')
        .bind(postId)
        .first<Post>();

      if (!existing) {
        return errorResponse('Post not found', 404, request);
      }

      const body = await request.json() as Partial<{
        title: string;
        content: string;
        images: string[];
        month: string;
        is_premium: boolean;
      }>;

      const updates: string[] = [];
      const values: any[] = [];

      if (body.title !== undefined) {
        updates.push('title = ?');
        values.push(body.title.trim());
      }

      if (body.content !== undefined) {
        updates.push('content = ?');
        values.push(body.content.trim());
      }

      if (body.images !== undefined) {
        updates.push('images = ?');
        values.push(JSON.stringify(body.images));
      }

      if (body.month !== undefined) {
        updates.push('month = ?');
        values.push(body.month);
      }

      if (body.is_premium !== undefined) {
        updates.push('is_premium = ?');
        values.push(body.is_premium ? 1 : 0);
      }

      if (updates.length === 0) {
        return errorResponse('No updates provided', 400, request);
      }

      updates.push('updated_at = datetime("now")');
      values.push(postId);

      await env.DB
        .prepare(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();

      const updated = await env.DB
        .prepare('SELECT * FROM posts WHERE id = ?')
        .bind(postId)
        .first<Post>();

      return jsonResponse({
        id: updated!.id,
        title: updated!.title,
        content: updated!.content,
        images: JSON.parse(updated!.images || '[]'),
        month: updated!.month,
        is_premium: updated!.is_premium === 1,
        created_at: updated!.created_at,
        updated_at: updated!.updated_at,
      }, request);
    } catch (error) {
      console.error('Update post error:', error);
      return errorResponse('Failed to update post', 500, request);
    }
  }

  // DELETE /api/admin/posts/:id - Delete post
  const deleteMatch = path.match(/^\/api\/admin\/posts\/(\d+)$/);
  if (deleteMatch && request.method === 'DELETE') {
    try {
      const postId = parseInt(deleteMatch[1], 10);

      const existing = await env.DB
        .prepare('SELECT id FROM posts WHERE id = ?')
        .bind(postId)
        .first();

      if (!existing) {
        return errorResponse('Post not found', 404, request);
      }

      await env.DB
        .prepare('DELETE FROM posts WHERE id = ?')
        .bind(postId)
        .run();

      return jsonResponse({ success: true }, request);
    } catch (error) {
      console.error('Delete post error:', error);
      return errorResponse('Failed to delete post', 500, request);
    }
  }

  // PUT /api/admin/settings - Update settings
  if (path === '/api/admin/settings' && request.method === 'PUT') {
    try {
      const body = await request.json() as Partial<{
        is_paused: boolean;
        pause_message: string;
      }>;

      if (body.is_paused !== undefined) {
        await updateSetting(env.DB, 'is_paused', body.is_paused ? 'true' : 'false');
      }

      if (body.pause_message !== undefined) {
        await updateSetting(env.DB, 'pause_message', body.pause_message);
      }

      const settings = await getSettings(env.DB);
      return jsonResponse(settings, request);
    } catch (error) {
      console.error('Update settings error:', error);
      return errorResponse('Failed to update settings', 500, request);
    }
  }

  // POST /api/admin/upload-url - Get signed upload URL for R2
  if (path === '/api/admin/upload-url' && request.method === 'POST') {
    try {
      const body = await request.json() as {
        filename: string;
        contentType: string;
      };

      const { filename, contentType } = body;

      if (!filename || !contentType) {
        return errorResponse('Filename and contentType required', 400, request);
      }

      // Validate content type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(contentType)) {
        return errorResponse('Invalid content type', 400, request);
      }

      // Generate unique key
      const ext = filename.split('.').pop() || 'jpg';
      const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      // Create multipart upload or use presigned URL
      // Note: R2 signed URLs require additional setup
      // For simplicity, we'll return the key and handle upload differently
      
      // Get R2 bucket URL (you'll need to set this up)
      const publicUrl = `https://your-r2-bucket.r2.cloudflarestorage.com/${key}`;

      return jsonResponse({
        key,
        uploadUrl: publicUrl, // In production, use presigned URL
        publicUrl,
      }, request);
    } catch (error) {
      console.error('Upload URL error:', error);
      return errorResponse('Failed to generate upload URL', 500, request);
    }
  }

  return errorResponse('Not found', 404, request);
}
