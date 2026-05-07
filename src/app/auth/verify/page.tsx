'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/db/client';

export default function VerifyPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.replace('/');
      }
    });
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', background: '#0C1118', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, border: '3px solid #2563EB', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <div style={{ fontSize: 15, color: '#8A97B0' }}>Verifying your login...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
