/**
 * src/lib/pdfService.ts
 *
 * PDF generation via Gotenberg (https://gotenberg.dev)
 * A containerised HTML-to-PDF service that runs on Railway.app for ~£4/month.
 *
 * Why not WeasyPrint?
 * WeasyPrint requires Python + system libs on the server. Netlify's build
 * environment doesn't include them reliably. Gotenberg is a standalone
 * Docker container with its own Chromium instance — no deps on the app server.
 *
 * Setup:
 * 1. Go to railway.app → New project → Deploy from Docker image
 * 2. Image: gotenberg/gotenberg:8
 * 3. Railway gives you a URL like https://gotenberg-xxx.railway.app
 * 4. Set GOTENBERG_URL=https://gotenberg-xxx.railway.app in Netlify env vars
 *
 * Cost: ~£4/month on Railway hobby plan (only runs when called)
 */

const GOTENBERG_URL = process.env.GOTENBERG_URL || '';

export async function htmlToPDF(html: string): Promise<Buffer> {
  if (!GOTENBERG_URL) {
    throw new Error(
      'GOTENBERG_URL not set. ' +
      'Deploy Gotenberg on Railway (see src/lib/pdfService.ts for instructions) ' +
      'then add GOTENBERG_URL to your Netlify environment variables.'
    );
  }

  // Build multipart form with the HTML
  const formData = new FormData();
  const blob = new Blob([html], { type: 'text/html' });
  formData.append('files', blob, 'index.html');

  // Gotenberg Chromium HTML route
  const res = await fetch(`${GOTENBERG_URL}/forms/chromium/convert/html`, {
    method: 'POST',
    body: formData,
    headers: {
      // Tell Gotenberg to wait for the page to fully render
      'Gotenberg-Wait-Delay': '0.5s',
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gotenberg PDF generation failed (${res.status}): ${err}`);
  }

  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Fallback: return the HTML directly as a downloadable file.
 * Used when Gotenberg is not configured — courts can print from the browser.
 */
export function htmlFallback(html: string, filename: string): Response {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename.replace('.pdf', '.html')}"`,
      'X-PDF-Fallback': 'true',
    },
  });
}
