import { Sidebar } from '@/components/nav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-full">
            <Sidebar />
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    );
}
