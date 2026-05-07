import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SUPER_ADMIN_COOKIE = 'ss_admin_auth';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: { headers: req.headers } });
  const path = req.nextUrl.pathname;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

  // ── Static + public routes ──────────────────────────────────────────────────
  if (
    path.startsWith('/_next') ||
    path.startsWith('/favicon') ||
    path.startsWith('/api/auth') // NextAuth callbacks
  ) return res;

  // ── Super admin route — dual auth ───────────────────────────────────────────
  if (path.startsWith('/admin')) {
    // Check regular session first
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
    );
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.redirect(new URL('/auth/login', req.url));

    // Check admin cookie (set on successful passphrase entry)
    const adminCookie = req.cookies.get(SUPER_ADMIN_COOKIE)?.value;
    if (!adminCookie) {
      // Allow page load — client-side passphrase gate will handle it
      return res;
    }
    return res;
  }

  // ── Portal routes — no regular auth needed (token-based) ───────────────────
  if (path.startsWith('/portal') || path.startsWith('/api/')) return res;

  // ── Auth pages ─────────────────────────────────────────────────────────────
  const isAuthPage = path.startsWith('/auth');

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  if (!session && !isAuthPage) {
    const loginUrl = new URL('/auth/login', req.url);
    loginUrl.searchParams.set('next', path);
    return NextResponse.redirect(loginUrl);
  }

  if (session && isAuthPage) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Security headers added via next.config.ts — no need to add here
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
