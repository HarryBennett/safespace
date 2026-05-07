import { NextRequest, NextResponse } from 'next/server';
import { getOAuthClient, storeToken, setupGmailWatch } from '@/lib/gmail';
import { google } from 'googleapis';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const stateRaw = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/?gmail_error=${error}`, req.url));
  }

  if (!code || !stateRaw) {
    return NextResponse.redirect(new URL('/?gmail_error=missing_code', req.url));
  }

  let state: { staffId: string; returnTo: string };
  try {
    state = JSON.parse(stateRaw);
  } catch {
    return NextResponse.redirect(new URL('/?gmail_error=invalid_state', req.url));
  }

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    // Get the user's email address
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email || '';

    // Validate it's a Workspace domain email
    const workspaceDomain = process.env.GOOGLE_WORKSPACE_DOMAIN;
    if (workspaceDomain && !email.endsWith(`@${workspaceDomain}`)) {
      return NextResponse.redirect(
        new URL(`/?gmail_error=wrong_domain&domain=${workspaceDomain}`, req.url)
      );
    }

    // Store the token
    const gmailToken = {
      staff_id: state.staffId,
      access_token: (tokens.access_token as string) || '',
      refresh_token: (tokens.refresh_token as string) || '',
      expiry_date: (tokens.expiry_date as number) || 0,
      email,
    };
    storeToken(gmailToken);

    // Set up Gmail push notifications for real-time sync
    try {
      await setupGmailWatch(state.staffId);
    } catch (watchError) {
      console.warn('Gmail watch setup failed (non-fatal):', watchError);
      // Not fatal — sync will still work via manual polling
    }

    const returnTo = new URL(state.returnTo || '/', req.url);
    returnTo.searchParams.set('gmail_connected', '1');
    return NextResponse.redirect(returnTo);

  } catch (err) {
    console.error('Gmail OAuth error:', err);
    return NextResponse.redirect(new URL('/?gmail_error=token_exchange', req.url));
  }
}
