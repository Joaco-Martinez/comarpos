'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { Building2, LogOut, ShieldCheck } from 'lucide-react';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, me, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) me();
  }, [loading, me]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (user.role !== 'SUPER_ADMIN') {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== 'SUPER_ADMIN') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          color: 'var(--text2)',
        }}
      >
        Verificando acceso...
      </div>
    );
  }

  const navItems = [{ href: '/super-admin/negocios', label: 'Negocios', icon: Building2 }];

  return (
    <div className="super-admin-shell">
      <aside className="super-admin-sidebar">
        <div className="super-admin-brand">
          <ShieldCheck size={20} />
          <span>ComarPOS Admin</span>
        </div>

        <nav className="super-admin-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`super-admin-nav-item ${active ? 'is-active' : ''}`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button type="button" className="super-admin-logout" onClick={() => logout()}>
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </aside>

      <main className="super-admin-content">{children}</main>

      <style jsx>{`
        .super-admin-shell {
          min-height: 100vh;
          display: flex;
          background: var(--bg);
        }

        .super-admin-sidebar {
          width: 240px;
          flex-shrink: 0;
          background: var(--surface);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          padding: 20px 16px;
          gap: 24px;
        }

        .super-admin-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 15px;
          color: var(--text);
        }

        .super-admin-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        .super-admin-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          color: var(--text2);
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
        }

        .super-admin-nav-item:hover {
          background: var(--surface3);
          color: var(--text);
        }

        .super-admin-nav-item.is-active {
          background: var(--accent-dim);
          color: var(--accent);
        }

        .super-admin-logout {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text2);
          font-size: 14px;
          cursor: pointer;
        }

        .super-admin-logout:hover {
          background: var(--surface3);
          color: var(--danger);
        }

        .super-admin-content {
          flex: 1;
          padding: 28px 32px;
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
}
