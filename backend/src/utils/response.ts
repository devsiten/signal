// CORS and response utilities

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8788',
  'https://hussayn-signal.pages.dev', // Update with your domain
];

export function corsHeaders(request: Request): Headers {
  const origin = request.headers.get('Origin') || '';
  const headers = new Headers();

  // Check if origin is allowed
  if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.pages.dev')) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else {
    headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }

  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Max-Age', '86400');

  return headers;
}

export function jsonResponse(data: any, request: Request, status = 200): Response {
  const headers = corsHeaders(request);
  headers.set('Content-Type', 'application/json');

  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

export function errorResponse(message: string, status: number, request: Request): Response {
  return jsonResponse({ error: message }, request, status);
}

export function setCookieHeader(name: string, value: string, maxAge: number): string {
  const secure = true; // Always use secure in production
  const sameSite = 'None'; // Required for cross-origin

  return `${name}=${value}; Path=/; HttpOnly; Secure=${secure}; SameSite=${sameSite}; Max-Age=${maxAge}`;
}

export function deleteCookieHeader(name: string): string {
  return `${name}=; Path=/; HttpOnly; Secure=true; SameSite=None; Max-Age=0`;
}
