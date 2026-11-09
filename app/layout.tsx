import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'FormGuard Pro — Multi-Site WordPress Form Monitor',
  description:
    'Automated daily form health monitoring for WordPress client websites with headless Playwright testing, screenshot failure captures, and instant Slack & SMTP alerts.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-ink antialiased font-sans selection:bg-cobalt/20 selection:text-cobaltdark">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
