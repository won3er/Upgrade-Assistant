import type { ReactNode } from 'react';
import { headers } from 'next/headers';

function readUserAgent() {
  const h = headers();
  return h.get('user-agent') ?? 'unknown';
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body data-agent={readUserAgent()}>{children}</body>
    </html>
  );
}
