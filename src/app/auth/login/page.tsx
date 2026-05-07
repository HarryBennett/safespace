'use client';
import { useState } from 'react';
import { supabase } from '@/lib/db/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function sendMagicLink() {
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/verify`,
      },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0C1118', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ width: 52, height: 52, background: '#2563EB', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M12 2a7 7 0 100 14A7 7 0 0012 2zm0 3a4 4 0 110 8 4 4 0 010-8z"/>
              <circle cx="12" cy="21" r="2"/>
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#DDE3EF', marginBottom: 4 }}>SafeSpace</div>
          <div style={{ fontSize: 13, color: '#50617A' }}>Contact Centre Management Platform</div>
        </div>

        {!sent ? (
          <div style={{ background: '#131920', border: '1px solid #263145', borderRadius: 14, padding: 28 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#DDE3EF', marginBottom: 4 }}>Sign in</div>
            <div style={{ fontSize: 13, color: '#8A97B0', marginBottom: 20 }}>
              Enter your work email. We&apos;ll send a one-time login link — no password needed.
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#50617A', marginBottom: 6 }}>
                Work email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMagicLink()}
                placeholder="you@safespace.co.uk"
                style={{ width: '100%', background: '#1A2230', border: '1px solid #263145', borderRadius: 8, padding: '11px 14px', color: '#DDE3EF', fontFamily: 'DM Sans, sans-serif', fontSize: 14, outline: 'none', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = '#3B82F6'}
                onBlur={e => e.target.style.borderColor = '#263145'}
              />
            </div>

            {error && (
              <div style={{ background: '#EF444415', border: '1px solid #EF444440', borderRadius: 7, padding: '10px 12px', fontSize: 13, color: '#F87171', marginBottom: 14 }}>
                {error}
              </div>
            )}

            <button
              onClick={sendMagicLink}
              disabled={loading || !email.trim()}
              style={{ width: '100%', padding: '12px', borderRadius: 9, background: loading || !email.trim() ? '#1E3A6E' : '#2563EB', color: 'white', fontSize: 14, fontWeight: 500, border: 'none', cursor: loading || !email.trim() ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', transition: 'background 0.15s', opacity: loading || !email.trim() ? 0.6 : 1 }}
            >
              {loading ? 'Sending...' : 'Send login link →'}
            </button>

            <div style={{ marginTop: 16, fontSize: 12, color: '#50617A', textAlign: 'center' }}>
              Only registered SafeSpace staff can sign in. Contact your centre manager if you need access.
            </div>
          </div>
        ) : (
          <div style={{ background: '#131920', border: '1px solid #263145', borderRadius: 14, padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📧</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#DDE3EF', marginBottom: 8 }}>Check your email</div>
            <div style={{ fontSize: 13, color: '#8A97B0', lineHeight: 1.6, marginBottom: 20 }}>
              We sent a secure login link to <strong style={{ color: '#DDE3EF' }}>{email}</strong>.<br/>
              Click the link in the email to sign in. It expires in 10 minutes.
            </div>
            <button
              onClick={() => { setSent(false); setEmail(''); }}
              style={{ background: 'none', border: '1px solid #263145', borderRadius: 8, padding: '9px 18px', color: '#8A97B0', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
            >
              Use a different email
            </button>
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: '#374151' }}>
          NACCC accredited · GDPR compliant · UK data residency
        </div>
      </div>
    </div>
  );
}
