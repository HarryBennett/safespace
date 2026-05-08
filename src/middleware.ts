import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const path = req.nextUrl.pathname;

  if (
    path.startsWith('/auth') ||
    path.startsWith('/api') ||
    path.startsWith('/portal') ||
    path.startsWith('/_next') ||
    path.startsWith('/favicon')
  ) {
    return res;
  }

  const hasSession = req.cookies.getAll().some(c => 
    c.name.startsWith('sb-') && c.nam
