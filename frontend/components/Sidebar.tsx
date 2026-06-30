'use client';

import { useState } from 'react';
import type { ElementType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  BarChart2,
  AlertTriangle,
  Receipt,
  UserCog,
  Wallet,
  LogOut,
  ChevronRight,
  CreditCard,
  PanelLeftClose,
  PanelLeftOpen,
  FolderTree,
  ShieldCheck,
  MapPin,
  BadgeDollarSign,
} from 'lucide-react';

const NAV = [
  {
    href: '/pos',
    icon: ShoppingCart,
    label: 'POS — Ventas',
    color: '#2563eb',
  },
  {
    href: '/ventas',
    icon: Receipt,
    label: 'Historial Ventas',
    color: '#2563eb',
  },
  {
    href: '/productos',
    icon: Package,
    label: 'Productos',
    color: '#0f9f5c',
  },
  {
    href: '/categorias',
    icon: FolderTree,
    label: 'Categorías',
    color: '#f97316',
  },
  {
    href: '/clientes',
    icon: Users,
    label: 'Clientes',
    color: '#ea580c',
  },
  {
    href: '/stock',
    icon: BarChart2,
    label: 'Stock',
    color: '#a78bfa',
  },
  {
    href: '/alertas',
    icon: AlertTriangle,
    label: 'Alertas',
    color: '#dc2626',
  },
  {
    href: '/facturacion',
    icon: Receipt,
    label: 'AFIP / Facturas',
    color: '#06b6d4',
  },
];

const ADMIN_NAV = [
  {
    href: '/dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
    color: '#0f9f5c',
  },
  {
    href: '/usuarios',
    icon: UserCog,
    label: 'Usuarios',
    color: '#fb923c',
  },
  {
    href: '/vendedores',
    icon: BadgeDollarSign,
    label: 'Vendedores',
    color: '#22c55e',
  },
  {
    href: '/reportes',
    icon: BarChart2,
    label: 'Reportes',
    color: '#d97706',
  },
  {
    href: '/compras',
    icon: Receipt,
    label: 'Compras',
    color: '#0f9f5c',
  },
  {
    href: '/finanzas',
    icon: Wallet,
    label: 'Finanzas',
    color: '#34d399',
  },
  {
    href: '/cuentas-corrientes',
    icon: CreditCard,
    label: 'Cuentas Corrientes',
    color: '#d97706',
  },
  {
    href: '/configuracion/business-locations',
    icon: MapPin,
    label: 'Sucursales y depósitos',
    color: '#38bdf8',
  },
  {
    href: '/configuracion/arca',
    icon: ShieldCheck,
    label: 'ARCA',
    color: '#22c55e',
  },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

type NavItem = {
  href: string;
  icon: ElementType;
  label: string;
  color: string;
};

const SIDEBAR_STORAGE_KEY = 'comarpos-sidebar-collapsed';

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;

    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  });

  const toggleCollapsed = () => {
    const nextCollapsed = !collapsed;

    setCollapsed(nextCollapsed);

    if (typeof window !== 'undefined') {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextCollapsed));

      window.dispatchEvent(
        new CustomEvent('sidebar-collapsed-change', {
          detail: { collapsed: nextCollapsed },
        })
      );
    }
  };

  const sidebarWidth = collapsed ? 78 : 240;

  const renderNavItem = ({ href, icon: Icon, label, color }: NavItem) => {
    const active =
      pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

    return (
      <Link
        key={href}
        href={href}
        onClick={onClose}
        title={collapsed ? label : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: collapsed ? '10px 11px' : '9px 10px',
          borderRadius: 8,
          textDecoration: 'none',
          fontSize: 13,
          fontWeight: 600,
          color: active ? 'var(--text)' : 'var(--text2)',
          background: active ? 'var(--surface2)' : 'none',
          transition: 'all 0.15s',
          marginBottom: 2,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
        onMouseEnter={(e) => {
          if (!active) e.currentTarget.style.background = 'var(--surface2)';
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.background = 'none';
        }}
      >
        {!collapsed && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: active ? color : 'var(--border2)',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
          />
        )}

        <Icon
          size={collapsed ? 18 : 15}
          style={{
            color: active ? color : 'var(--text3)',
            flexShrink: 0,
          }}
        />

        {!collapsed && (
          <>
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>

            {active && (
              <ChevronRight
                size={12}
                style={{
                  color: 'var(--text3)',
                  marginLeft: 'auto',
                }}
              />
            )}
          </>
        )}
      </Link>
    );
  };

  const content = (
    <div
      className="flex flex-col h-full"
      style={{
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        width: '100%',
        transition: 'width 0.2s ease',
      }}
    >
      <div
        style={{
          padding: collapsed ? '20px 12px' : '24px 20px 20px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center justify-between">
          <div
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 10,
            }}
          >
            {!collapsed && (
              <div>
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 9,
                    color: 'var(--accent)',
                    letterSpacing: 3,
                    textTransform: 'uppercase',
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  ERP SISTEMA
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
                    <polygon
                      points="10,15 50,85 90,15 75,15 50,60 25,15"
                      fill="#111827"
                    />
                    <polygon
                      points="60,15 90,15 90,55 75,55 75,30"
                      fill="#111827"
                    />
                  </svg>

                  <div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: 'var(--text)',
                        lineHeight: 1,
                      }}
                    >
                      ComarPOS
                    </div>
                  </div>
                </div>
              </div>
            )}

            {collapsed && (
              <svg width="34" height="34" viewBox="0 0 100 100" fill="none">
                <polygon
                  points="10,15 50,85 90,15 75,15 50,60 25,15"
                  fill="#111827"
                />
                <polygon
                  points="60,15 90,15 90,55 75,55 75,30"
                  fill="#111827"
                />
              </svg>
            )}
          </div>
        </div>
      </div>

      <div
        className="hidden md:block"
        style={{
          padding: collapsed ? '10px 12px 4px' : '10px 10px 4px',
        }}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expandir menú' : 'Guardar menú'}
          className="btn btn-ghost btn-sm"
          style={{
            width: '100%',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 8,
            color: 'var(--text3)',
          }}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          {!collapsed && 'Guardar menú'}
        </button>
      </div>

      <nav
        className="flex-1 overflow-y-auto"
        style={{ padding: collapsed ? '8px 10px' : '12px 10px' }}
      >
        {!collapsed && (
          <div
            style={{
              fontSize: 9,
              color: 'var(--text3)',
              letterSpacing: 2,
              textTransform: 'uppercase',
              fontFamily: 'var(--mono)',
              padding: '8px 10px 4px',
            }}
          >
            Principal
          </div>
        )}

        {NAV.map(renderNavItem)}

        {user?.role === 'ADMIN' && (
          <>
            {!collapsed && (
              <div
                style={{
                  fontSize: 9,
                  color: 'var(--text3)',
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  fontFamily: 'var(--mono)',
                  padding: '16px 10px 4px',
                }}
              >
                Admin
              </div>
            )}

            {ADMIN_NAV.map(renderNavItem)}
          </>
        )}
      </nav>

      <div
        style={{
          padding: collapsed ? '12px 10px' : '14px 12px',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 8,
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <div
            title={collapsed ? `${user?.name ?? 'Usuario'} — ${user?.role ?? ''}` : undefined}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--accent-dim)',
              border: '1px solid var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--accent)',
              flexShrink: 0,
            }}
          >
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>

          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.name}
              </div>

              <div
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--mono)',
                  color: user?.role === 'ADMIN' ? 'var(--accent)' : 'var(--text3)',
                }}
              >
                {user?.role}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => logout()}
          className="btn btn-ghost btn-sm"
          title={collapsed ? 'Cerrar sesión' : undefined}
          style={{
            width: '100%',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 8,
            color: 'var(--text3)',
          }}
        >
          <LogOut size={14} />
          {!collapsed && 'Cerrar sesión'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div
        className="hidden md:flex"
        style={{
          width: sidebarWidth,
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 40,
          flexDirection: 'column',
          transition: 'width 0.2s ease',
        }}
      >
        {content}
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={onClose}
          />

          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 260,
            }}
          >
            {content}
          </div>
        </div>
      )}
    </>
  );
}