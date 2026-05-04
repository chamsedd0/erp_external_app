import { Sidebar } from '@/components/nav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', height: '100%' }}>
            <Sidebar />
            <main style={{ flex: 1, overflowY: 'auto' }}>
                {children}
            </main>
        </div>
    );
}
