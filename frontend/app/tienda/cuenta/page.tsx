/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  LogOut,
  Mail,
  Phone,
  ReceiptText,
  ShoppingCart,
  UserRound,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatMoney } from "@/lib/shop";
import { useCartStore } from "@/store/cart";
import { useShopAuth } from "@/context/ShopAuthContext";
import { formatDateTimeAR } from '@/lib/dateAR';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type SaleItem = {
  id?: string;
  quantity?: number | null;
  quantityKg?: number | null;
  price?: number | null;
  subtotal?: number | null;
  product?: {
    name?: string | null;
    saleUnit?: string | null;
  } | null;
};

type Sale = {
  id: string;
  createdAt?: string | null;
  total?: number | null;
  finalTotal?: number | null;
  totalAmount?: number | null;
  status?: string | null;
  paymentMethod?: string | null;
  receiptType?: string | null;
  clientId?: string | null;
  client?: { id?: string | null } | null;
  items?: SaleItem[];
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  const apiError = error as {
    response?: {
      data?: {
        message?: string;
        error?: string;
      };
    };
  };

  return (
    apiError.response?.data?.message ??
    apiError.response?.data?.error ??
    fallback
  );
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    let message = "No se pudo conectar con el servidor";

    try {
      const data = await res.json();
      message = data?.message ?? data?.error ?? message;
    } catch {
      // Ignoramos parse error.
    }

    throw new Error(message);
  }

  return res.json();
}

function normalizeSales(data: any): Sale[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.sales)) return data.sales;
  if (Array.isArray(data?.content)) return data.content;
  return [];
}

function saleTotal(sale: Sale) {
  return Number(sale.finalTotal ?? sale.total ?? sale.totalAmount ?? 0);
}

function saleDate(sale: Sale) {
  if (!sale.createdAt) return "Sin fecha";

  return formatDateTimeAR(sale.createdAt);
}

function statusLabel(status?: string | null) {
  if (status === "COMPLETED") return "Completada";
  if (status === "PENDING") return "Pendiente";
  if (status === "CANCELLED") return "Cancelada";
  return status || "Sin estado";
}

export default function TiendaCuentaPage() {
  const router = useRouter();
  const clearCart = useCartStore((state) => state.clear);

  const { user, client, loading, logout } = useShopAuth();

  const [sales, setSales] = useState<Sale[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const clientName = useMemo(() => {
    const fullName = [client?.nombre, client?.apellido]
      .filter(Boolean)
      .join(" ")
      .trim();

    return fullName || user?.name || "Mi cuenta";
  }, [client, user]);

  const priceList = useMemo(() => {
    const category = client?.category;

    if (category === "Mayorista") return "Lista mayorista";
    if (category === "Cliente") return "Lista cliente";

    return "Lista minorista";
  }, [client]);

  useEffect(() => {
    if (loading) return;

    if (!user?.id) {
      router.replace("/tienda/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    let alive = true;

    async function loadSales() {
      if (loading) return;
      if (!user?.id) return;

      const clientId = client?.id;

      setSalesLoading(true);
      setError("");

      try {
        const salesData = await apiGet<any>("/sales");
        const allSales = normalizeSales(salesData);

        const mySales = clientId
          ? allSales.filter(
              (sale) => sale.clientId === clientId || sale.client?.id === clientId
            )
          : [];

        if (!alive) return;

        setSales(mySales.slice(0, 20));
      } catch (err: unknown) {
        console.error(err);

        if (!alive) return;

        setSales([]);
        setError(
          getErrorMessage(
            err,
            "No se pudieron cargar las ventas de tu cuenta."
          )
        );
      } finally {
        if (alive) setSalesLoading(false);
      }
    }

    loadSales();

    return () => {
      alive = false;
    };
  }, [loading, user, client]);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError("");

    try {
      await logout();

      clearCart();
      setSales([]);

      toast.success("Sesión cerrada");

      router.replace("/tienda/login");

      setTimeout(() => {
        router.refresh();
      }, 80);
    } catch (err: unknown) {
      const message = getErrorMessage(err, "No se pudo cerrar sesión");
      toast.error(message);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        :root {
          --bg: #f6f7f9;
          --white: #ffffff;
          --text: #111827;
          --muted: #6b7280;
          --soft: #9ca3af;
          --line: #e5e7eb;
          --line-strong: #d1d5db;
          --primary: #111827;
          --primary-hover: #030712;
          --green: #14b86a;
          --green-soft: #e9f9f1;
          --blue: #2563eb;
          --blue-soft: #eff6ff;
          --red: #e11d48;
          --red-soft: #fff1f2;
          --shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
          --shadow-sm: 0 10px 28px rgba(15, 23, 42, 0.06);
        }

        * { box-sizing: border-box; }

        body { margin: 0; }

        button { font-family: inherit; }

        .account-page {
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .topbar {
          background: var(--white);
          border-bottom: 1px solid var(--line);
          position: sticky;
          top: 0;
          z-index: 40;
        }

        .topbar-inner {
          max-width: 1180px;
          height: 76px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .brand,
        .header-link {
          color: inherit;
          text-decoration: none;
        }

        .brand {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .brand-mark {
          width: 52px;
          height: 52px;
          border-radius: 18px;
          background: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
          box-shadow: 0 12px 24px rgba(17, 24, 39, 0.18);
        }

        .brand-logo {
          width: 37px;
          height: auto;
          object-fit: contain;
          display: block;
        }

        .brand-title {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .brand-title strong {
          font-size: 16px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .brand-title span {
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .header-link,
        .logout-btn {
          height: 42px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 15px;
          font-size: 13px;
          font-weight: 900;
          white-space: nowrap;
          border: 1px solid var(--line);
          background: var(--white);
          color: var(--text);
          cursor: pointer;
          transition: 0.16s ease;
        }

        .header-link:hover,
        .logout-btn:hover {
          border-color: var(--line-strong);
          background: #f9fafb;
        }

        .logout-btn {
          color: var(--red);
        }

        .logout-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .main {
          max-width: 1180px;
          margin: 0 auto;
          padding: 28px 24px 70px;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--muted);
          text-decoration: none;
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 18px;
        }

        .back-link:hover { color: var(--text); }

        .hero {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 28px;
          padding: 26px;
          box-shadow: var(--shadow-sm);
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 22px;
          align-items: center;
          margin-bottom: 18px;
        }

        .profile-head {
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 0;
        }

        .avatar {
          width: 66px;
          height: 66px;
          border-radius: 22px;
          background: var(--primary);
          color: var(--white);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .profile-copy { min-width: 0; }

        .profile-copy h1 {
          margin: 0;
          color: var(--text);
          font-size: 30px;
          line-height: 1.05;
          font-weight: 950;
          letter-spacing: -0.06em;
        }

        .profile-copy p {
          margin: 8px 0 0;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.5;
          font-weight: 650;
        }

        .hero-badge {
          border-radius: 999px;
          background: var(--green-soft);
          color: var(--green);
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 950;
          white-space: nowrap;
        }

        .cards {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .info-card {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 22px;
          padding: 18px;
          box-shadow: var(--shadow-sm);
          min-width: 0;
        }

        .info-icon {
          width: 38px;
          height: 38px;
          border-radius: 14px;
          background: var(--blue-soft);
          color: var(--blue);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }

        .info-card small {
          display: block;
          color: var(--muted);
          font-size: 12px;
          font-weight: 850;
          margin-bottom: 4px;
        }

        .info-card strong {
          display: block;
          color: var(--text);
          font-size: 16px;
          line-height: 1.3;
          font-weight: 950;
          overflow-wrap: anywhere;
        }

        .sales-box {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 28px;
          padding: 20px;
          box-shadow: var(--shadow-sm);
        }

        .section-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 16px;
        }

        .section-head h2 {
          margin: 0;
          color: var(--text);
          font-size: 20px;
          line-height: 1.2;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .section-head p {
          margin: 5px 0 0;
          color: var(--muted);
          font-size: 13px;
          font-weight: 650;
        }

        .sale-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .sale-row {
          border: 1px solid var(--line);
          border-radius: 20px;
          padding: 14px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
        }

        .sale-main {
          min-width: 0;
        }

        .sale-title {
          margin: 0;
          color: var(--text);
          font-size: 14px;
          font-weight: 950;
          letter-spacing: -0.025em;
        }

        .sale-meta {
          margin: 6px 0 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.45;
          font-weight: 700;
        }

        .sale-total {
          text-align: right;
          white-space: nowrap;
        }

        .sale-total strong {
          display: block;
          color: var(--text);
          font-size: 17px;
          font-weight: 950;
          letter-spacing: -0.03em;
        }

        .sale-total span {
          display: inline-flex;
          margin-top: 6px;
          border-radius: 999px;
          background: #f9fafb;
          border: 1px solid var(--line);
          color: var(--muted);
          padding: 5px 8px;
          font-size: 11px;
          font-weight: 900;
        }

        .empty,
        .loading,
        .err-box {
          border-radius: 22px;
          padding: 34px 18px;
          text-align: center;
          font-size: 14px;
          font-weight: 800;
        }

        .loading {
          color: var(--muted);
          background: var(--white);
          border: 1px solid var(--line);
          box-shadow: var(--shadow-sm);
        }

        .empty {
          color: var(--muted);
          border: 1px dashed var(--line-strong);
          background: #fbfcfd;
        }

        .empty strong {
          display: block;
          color: var(--text);
          margin-bottom: 6px;
          font-size: 16px;
        }

        .err-box {
          color: var(--red);
          border: 1px solid rgba(225,29,72,0.16);
          background: var(--red-soft);
          margin-bottom: 18px;
        }

        @media (max-width: 760px) {
          .topbar-inner {
            height: auto;
            padding: 14px 16px;
            align-items: flex-start;
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .header-link,
          .logout-btn {
            flex: 1;
          }

          .main {
            padding: 20px 16px 54px;
          }

          .hero {
            grid-template-columns: 1fr;
            padding: 20px;
            border-radius: 24px;
          }

          .profile-head {
            align-items: flex-start;
          }

          .profile-copy h1 {
            font-size: 24px;
          }

          .hero-badge {
            width: fit-content;
          }

          .cards {
            grid-template-columns: 1fr;
          }

          .section-head {
            flex-direction: column;
          }

          .sale-row {
            grid-template-columns: 1fr;
          }

          .sale-total {
            text-align: left;
          }
        }
      `}</style>

      <div className="account-page">
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/tienda" className="brand">
              <div className="brand-mark">
                <Image
                  src="/logo-vj-white-transparent.png"
                  alt="Logo"
                  width={100}
                  height={100}
                  className="brand-logo"
                  priority
                />
              </div>

              <div className="brand-title">
                <strong>ComarPOS</strong>
                <span>Mi cuenta</span>
              </div>
            </Link>

            <div className="header-actions">
              <Link href="/tienda/carrito" className="header-link">
                <ShoppingCart size={16} />
                Carrito
              </Link>

              <button
                className="logout-btn"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                <LogOut size={16} />
                {loggingOut ? "Saliendo..." : "Salir"}
              </button>
            </div>
          </div>
        </header>

        <main className="main">
          <Link href="/tienda" className="back-link">
            <ArrowLeft size={16} />
            Volver a la tienda
          </Link>

          {error && <div className="err-box">⚠ {error}</div>}

          {loading || !user ? (
            <div className="loading">Cargando tu cuenta...</div>
          ) : (
            <>
              <section className="hero">
                <div className="profile-head">
                  <div className="avatar">
                    <UserRound size={30} />
                  </div>

                  <div className="profile-copy">
                    <h1>{clientName}</h1>
                    <p>
                      Desde acá podés ver tus datos, tu lista de precios y las
                      últimas ventas asociadas a tu usuario.
                    </p>
                  </div>
                </div>

                <div className="hero-badge">{priceList}</div>
              </section>

              <section className="cards">
                <article className="info-card">
                  <div className="info-icon">
                    <Mail size={18} />
                  </div>
                  <small>Email</small>
                  <strong>
                    {user?.email || client?.gmail || "Sin email"}
                  </strong>
                </article>

                <article className="info-card">
                  <div className="info-icon">
                    <Phone size={18} />
                  </div>
                  <small>Teléfono</small>
                  <strong>
                    {client?.telefono || "Sin teléfono cargado"}
                  </strong>
                </article>

                <article className="info-card">
                  <div className="info-icon">
                    <Wallet size={18} />
                  </div>
                  <small>Cuenta corriente</small>
                  <strong>
                    {client?.isAccountEnabled
                      ? `Saldo: ${formatMoney(Number(client.currentBalance ?? 0))}`
                      : "No habilitada"}
                  </strong>
                </article>
              </section>

              <section className="sales-box">
                <div className="section-head">
                  <div>
                    <h2>Ventas anteriores</h2>
                    <p>Últimas compras registradas para este cliente.</p>
                  </div>

                  <ReceiptText size={22} color="#6b7280" />
                </div>

                {salesLoading ? (
                  <div className="empty">Cargando ventas...</div>
                ) : sales.length === 0 ? (
                  <div className="empty">
                    <strong>Todavía no hay ventas para mostrar</strong>
                    Cuando el cliente tenga compras registradas, van a aparecer
                    acá.
                  </div>
                ) : (
                  <div className="sale-list">
                    {sales.map((sale) => {
                      const firstItems = sale.items?.slice(0, 3) ?? [];

                      const itemText = firstItems
                        .map((item) => {
                          const qty = item.quantityKg ?? item.quantity ?? 1;
                          const unit =
                            item.product?.saleUnit === "KG" ? "kg" : "u";

                          return `${item.product?.name ?? "Producto"} x ${qty} ${unit}`;
                        })
                        .join(" · ");

                      return (
                        <article className="sale-row" key={sale.id}>
                          <div className="sale-main">
                            <p className="sale-title">
                              Venta #{sale.id.slice(0, 8)}
                            </p>

                            <p className="sale-meta">
                              {saleDate(sale)}
                              {itemText ? ` · ${itemText}` : ""}
                            </p>
                          </div>

                          <div className="sale-total">
                            <strong>{formatMoney(saleTotal(sale))}</strong>
                            <span>{statusLabel(sale.status)}</span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </>
  );
}