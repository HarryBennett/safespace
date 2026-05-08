'use client';
import { useState } from 'react';
import { supabase } from '@/lib/db/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'magic'|'password'>('magic');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleMagicLink() {
    if (!email.trim()) return;
    setLoading(true); setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/verify` },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  }

  async function handlePassword() {
    if (!email.trim() || !password.trim()) return;
    setLoading(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.replace('/');
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0C1118', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans, sans-serif', padding:20 }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{ width:52, height:52, background:'#2563EB', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 2a7 7 0 100 14A7 7 0 0012 2zm0 3a4 4 0 110 8 4 4 0 010-8z"/><circle cx="12" cy="21" r="2"/></svg>
          </div>
          <div style={{ fontSize:22, fontWeight:600, color:'#DDE3EF', marginBottom:4 }}>SafeSpace</div>
          <div style={{ fontSize:13, color:'#50617A' }}>Contact Centre Management Platform</div>
        </div>
        <div style={{ background:'#131920', border:'1px solid #263145', borderRadius:14, padding:28 }}>
          <div style={{ display:'flex', gap:8, marginBottom:20 }}>
            {(['magic','password'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                style={{ flex:1, padding:'8px', borderRadius:8, border:`1px solid ${mode===m ? '#2563EB' : '#263145'}`, background: mode===m ? '#2563EB15' : 'transparent', color: mode===m ? '#3B82F6' : '#50617A', fontSize:13, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
                {m === 'magic' ? '✉ Email link' : '🔑 Password'}
              </button>
            ))}
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:500, letterSpacing:'0.05em', textTransform:'uppercase', color:'#50617A', marginBottom:6 }}>Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (mode === 'magic' ? handleMagicLink() : handlePassword())}
              placeholder="you@safespace.co.uk"
              style={{ width:'100%', background:'#1A2230', border:'1px solid #263145', borderRadius:8, padding:'11px 14px', color:'#DDE3EF', fontFamily:'DM Sans, sans-serif', fontSize:14, outline:'none' }} />
          </div>
          {mode === 'password' && (
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:500, letterSpacing:'0.05em', textTransform:'uppercase', color:'#50617A', marginBottom:6 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePassword()}
                placeholder="Enter your password"
                style={{ width:'100%', background:'#1A2230', border:'1px solid #263145', borderRadius:8, padding:'11px 14px', color:'#DDE3EF', fontFamily:'DM Sans, sans-serif', fontSize:14, outline:'none' }} />
            </div>
          )}
          {error && (
            <div style={{ background:'#EF444415', border:'1px solid #EF444440', borderRadius:7, padding:'10px 12px', fontSize:13, color:'#F87171', marginBottom:14 }}>{error}</div>
          )}
          <button onClick={mode === 'magic' ? handleMagicLink : handlePassword}
            disabled={loading || !email.trim() || (mode === 'password' && !password.trim())}
            style={{ width:'100%', padding:'12px', borderRadius:9, background:'#2563EB', color:'white', fontSize:14, fontWeight:500, border:'none', cursor:'pointer', fontFamily:'DM Sans, sans-serif', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Please wait...' : mode === 'magic' ? 'Send login link →' : 'Sign in →'}
          </button>
          <div style={{ marginTop:16, fontSize:12, color:'#50617A', textAlign:'center' }}>
            {mode === 'magic' ? 'A login link will be emailed to you.' : 'Use the password set in Supabase.'}
          </div>
        </div>
      </div>
    </div>
  );
}
