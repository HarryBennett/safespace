import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SafeSpace — Contact Centre Management',
  description: 'NACCC-aligned family contact centre management platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
