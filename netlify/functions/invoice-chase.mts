// Netlify scheduled function — fires daily at 08:00 UTC
// Calls the Next.js chase API route to send overdue emails
import type { Config } from "@netlify/functions";

export default async function handler() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const res = await fetch(`${appUrl}/api/invoice/chase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': process.env.CRON_SECRET || '',
    },
  });
  const data = await res.json();
  console.log('[invoice-chase]', data);
  return new Response(JSON.stringify(data));
}

export const config: Config = {
  schedule: "0 8 * * *",
};
