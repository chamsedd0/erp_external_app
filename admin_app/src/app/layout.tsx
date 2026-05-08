import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: {
        template: '%s | Shadow Portal',
        default: 'Shadow Portal Admin',
    },
    description: 'Manage tenants, subscriptions, and Odoo ERP integrations from one secure platform.',
    keywords: ['ERP', 'Odoo', 'tenant management', 'HR portal', 'Shadow Portal'],
    openGraph: {
        type: 'website',
        siteName: 'Shadow Portal',
        title: 'Shadow Portal Admin',
        description: 'Multi-tenant Odoo ERP management platform.',
        images: [{ url: '/og-image.svg', width: 1200, height: 630 }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Shadow Portal Admin',
        description: 'Multi-tenant Odoo ERP management platform.',
        images: ['/og-image.svg'],
    },
    icons: {
        icon: [
            { url: '/icon.svg', type: 'image/svg+xml' },
        ],
    },
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
