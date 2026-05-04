import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Shadow Portal Admin',
    description: 'Platform administration dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" style={{ height: '100%' }}>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body style={{ height: '100%', margin: 0, background: '#F8FAFC' }}>
                {children}
            </body>
        </html>
    );
}
