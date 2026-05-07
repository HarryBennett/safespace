import { NextRequest, NextResponse } from 'next/server';
import { getOAuthClient, getToken } from '@/lib/gmail';

export async function POST(req: NextRequest) {
  const { staffId } = await req.json();
  if (!staffId) return NextResponse.json({ error: 'staffId required' }, { status: 400 });

  const token = getToken(staffId);
  if (token) {
    // Revoke the token so Google stops sending push notifications
    try {
      const client = getOAuthClient();
      await client.revokeToken(token.access_token);
    } catch {
      // Non-fatal — token may already be expired
    }
  }

  // Remove from store
  // Production: await supabase.from('gmail_tokens').delete().eq('staff_id', staffId)

  return NextResponse.json({ ok: true });
}
