"use client";

import { forwardRef, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { fmtDate } from "@/lib/helpers";
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  BarChart2,
  Filter,
  Search,
  X,
} from "lucide-react";

type MovementLocation = "LOCAL" | "DEPOSITO";
type MovementGroup = "INGRESS" | "EGRESS" | "TRANSFER";
type MovementFilter = "ALL" | MovementGroup;
type MovementOrigin = "ALL" | "CLIENT" | "INTERNAL";

type MovementUserView = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
};

type MovementProductView = {
  id?: string | null;
  name?: string | null;
  sku?: string | null;
  category?: { name?: string | null } | null;
};

type StockMovementView = {
  id: string;
  productId: string;
  userId?: string | null;
  type: string;
  from?: MovementLocation | null;
  to?: MovementLocation | null;
  quantity?: number | null;
  quantityKg?: number | null;
  quantityLabel?: string | null;
  reason?: string | null;
  reference?: string | null;
  isClientMovement?: boolean | null;
  createdAt: string;
  product?: MovementProductView | null;
  user?: MovementUserView | null;
  movementGroup?: MovementGroup;
  movementLabel?: string;
  movementColor?: "green" | "red" | "blue";
  movementHex?: string;
};

type MovementBucket = {
  group: MovementGroup;
  label: string;
  color: "green" | "red" | "blue";
  hex: string;
  description: string;
  total: number;
  items: StockMovementView[];
};

type MovementOverviewResponse = {
  limit: number;
  ingress: MovementBucket;
  egress: MovementBucket;
  transfer: MovementBucket;
};

type MovementSearchResponse = {
  data: StockMovementView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const emptyOverview: MovementOverviewResponse = {
  limit: 5,
  ingress: {
    group: "INGRESS",
    label: "Ingresos de stock",
    color: "green",
    hex: "#16a34a",
    description: "Stock que entra al sistema",
    total: 0,
    items: [],
  },
  egress: {
    group: "EGRESS",
    label: "Salidas de stock",
    color: "red",
    hex: "#dc2626",
    description: "Stock que sale del sistema",
    total: 0,
    items: [],
  },
  transfer: {
    group: "TRANSFER",
    label: "Movimientos entre depósitos",
    color: "blue",
    hex: "#2563eb",
    description: "Stock movido entre Mayorista y Minorista",
    total: 0,
    items: [],
  },
};

const movementOptions: { value: MovementFilter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "INGRESS", label: "Ingresos" },
  { value: "EGRESS", label: "Salidas" },
  { value: "TRANSFER", label: "Movimientos" },
];

const originOptions: { value: MovementOrigin; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "INTERNAL", label: "Vendedores / interno" },
  { value: "CLIENT", label: "Clientes (Web)" },
];

function getMovementGroup(movement: StockMovementView): MovementGroup {
  if (movement.movementGroup) return movement.movementGroup;
  if (movement.type === "TRANSFER") return "TRANSFER";
  if (movement.type === "INGRESS" || movement.type === "SALE_CANCEL") {
    return "INGRESS";
  }
  return "EGRESS";
}

function movementIcon(group: MovementGroup) {
  if (group === "TRANSFER") return <ArrowLeftRight size={14} />;
  if (group === "INGRESS") return <ArrowDownCircle size={14} />;
  return <ArrowUpCircle size={14} />;
}

function movementLabel(group: MovementGroup) {
  if (group === "TRANSFER") return "Movimiento";
  if (group === "INGRESS") return "Ingreso";
  return "Salida";
}

function movementLocationLabel(location?: MovementLocation | null) {
  if (location === "LOCAL") return "Mayorista";
  if (location === "DEPOSITO") return "Minorista";
  return "—";
}

function getMovementUserLabel(movement: StockMovementView) {
  if (movement.user?.name) return movement.user.name;
  if (movement.user?.email) return movement.user.email;
  if (movement.userId) return `Usuario #${String(movement.userId).slice(-8)}`;
  return "Sin usuario";
}

function getQuantityLabel(movement: StockMovementView) {
  if (movement.quantityLabel) return movement.quantityLabel;
  if (movement.quantityKg !== null && movement.quantityKg !== undefined) {
    return `${movement.quantityKg} kg`;
  }
  if (movement.quantity !== null && movement.quantity !== undefined) {
    return String(movement.quantity);
  }
  return "—";
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim() !== "") {
      q.set(key, String(value));
    }
  });

  return q.toString();
}

const StockMovementsPanel = forwardRef<HTMLDivElement>(
  function StockMovementsPanel(_props, ref) {
    const [overview, setOverview] =
      useState<MovementOverviewResponse>(emptyOverview);
    const [overviewLoading, setOverviewLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    const [search, setSearch] = useState("");
    const [movement, setMovement] = useState<MovementFilter>("ALL");
    const [origin, setOrigin] = useState<MovementOrigin>("ALL");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [page, setPage] = useState(1);

    const [result, setResult] = useState<MovementSearchResponse>({
      data: [],
      total: 0,
      page: 1,
      limit: 15,
      totalPages: 1,
    });
    const [searchLoading, setSearchLoading] = useState(false);

    const buckets = useMemo(
      () => [overview.ingress, overview.egress, overview.transfer],
      [overview],
    );

    useEffect(() => {
      let alive = true;

      setOverviewLoading(true);

      const overviewQuery = buildQuery({
        limit: 5,
        origin: origin === "ALL" ? undefined : origin,
      });

      api
        .get<MovementOverviewResponse>(
          `/products/movements/overview?${overviewQuery}`,
        )
        .then((res) => {
          if (!alive) return;
          setOverview({ ...emptyOverview, ...res.data });
        })
        .catch((error) => {
          console.error("Error cargando overview de movimientos", error);
        })
        .finally(() => {
          if (!alive) return;
          setOverviewLoading(false);
        });

      return () => {
        alive = false;
      };
    }, [origin]);

    useEffect(() => {
      if (!expanded) return;

      let alive = true;

      const timeoutId = window.setTimeout(() => {
        setSearchLoading(true);

        const query = buildQuery({
          page,
          limit: 15,
          search,
          movement: movement === "ALL" ? undefined : movement,
          origin: origin === "ALL" ? undefined : origin,
          fromDate,
          toDate,
        });

        api
          .get<MovementSearchResponse>(`/products/movements/search?${query}`)
          .then((res) => {
            if (!alive) return;
            setResult(res.data);
          })
          .catch((error) => {
            console.error("Error buscando movimientos", error);
          })
          .finally(() => {
            if (!alive) return;
            setSearchLoading(false);
          });
      }, 250);

      return () => {
        alive = false;
        window.clearTimeout(timeoutId);
      };
    }, [expanded, search, movement, origin, fromDate, toDate, page]);

    const openMovementGroup = (group: MovementGroup) => {
      setMovement(group);
      setPage(1);
      setExpanded(true);
    };

    const resetFilters = () => {
      setSearch("");
      setMovement("ALL");
      setOrigin("ALL");
      setFromDate("");
      setToDate("");
      setPage(1);
    };

    return (
      <div
        ref={ref}
        className="card stock-card stock-movements-card stock-movements-panel"
      >
        <div className="stock-movements-panel-title">
          <div>
            <b>Movimientos de stock</b>
            <small>
              Ingresos, salidas y movimientos entre Mayorista / Minorista
            </small>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setExpanded((prev) => !prev)}
          >
            <Filter size={14} />
            {expanded ? "Ocultar búsqueda" : "Buscar / ampliar"}
          </button>
        </div>

        <div className="stock-movement-origin-tabs">
          {originOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={origin === option.value ? "is-active" : ""}
              onClick={() => {
                setOrigin(option.value);
                setPage(1);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="stock-movement-overview-grid">
          {buckets.map((bucket) => (
            <section
              className={`stock-movement-overview-card is-${bucket.color}`}
              key={bucket.group}
            >
              <div className="stock-movement-overview-head">
                <span>{movementIcon(bucket.group)}</span>
                <div>
                  <h3>{bucket.label}</h3>
                  <small>{bucket.description}</small>
                </div>
                <b>{bucket.total}</b>
              </div>

              <div className="stock-movement-overview-list">
                {overviewLoading ? (
                  <div
                    className="skeleton"
                    style={{ height: 118, borderRadius: 12 }}
                  />
                ) : bucket.items.length ? (
                  bucket.items.map((item) => (
                    <div className="stock-movement-mini-row" key={item.id}>
                      <span>{item.product?.name ?? item.productId}</span>
                      <small>
                        {getQuantityLabel(item)} · {fmtDate(item.createdAt)}
                      </small>
                    </div>
                  ))
                ) : (
                  <p className="stock-movement-empty-mini">Sin movimientos</p>
                )}
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm stock-movement-open-btn"
                onClick={() => openMovementGroup(bucket.group)}
              >
                Ver todos
              </button>
            </section>
          ))}
        </div>

        {expanded && (
          <div className="stock-movement-search-panel">
            <div className="stock-movement-filters">
              <div className="stock-movement-search-box">
                <Search size={14} />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Buscar producto, SKU, usuario, referencia..."
                />
              </div>

              <select
                value={movement}
                onChange={(e) => {
                  setMovement(e.target.value as MovementFilter);
                  setPage(1);
                }}
              >
                {movementOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={origin}
                onChange={(e) => {
                  setOrigin(e.target.value as MovementOrigin);
                  setPage(1);
                }}
              >
                {originOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                title="Desde"
              />

              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                title="Hasta"
              />

              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetFilters}
              >
                <X size={14} />
                Limpiar
              </button>
            </div>

            <div className="table-wrap stock-desktop-table stock-movement-detail-table">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th>Tipo</th>
                    <th>Desde</th>
                    <th>Hacia</th>
                    <th>Cantidad</th>
                    <th>Usuario</th>
                    <th>Origen</th>
                    <th>Referencia</th>
                  </tr>
                </thead>

                <tbody>
                  {result.data.map((item) => {
                    const group = getMovementGroup(item);

                    return (
                      <tr key={item.id}>
                        <td>{fmtDate(item.createdAt)}</td>
                        <td>{item.product?.name ?? item.productId}</td>
                        <td>
                          <span
                            className={`stock-movement-badge is-${group.toLowerCase()}`}
                          >
                            {movementIcon(group)}
                            {movementLabel(group)}
                          </span>
                        </td>
                        <td>{movementLocationLabel(item.from)}</td>
                        <td>{movementLocationLabel(item.to)}</td>
                        <td style={{ fontFamily: "var(--mono)" }}>
                          {getQuantityLabel(item)}
                        </td>
                        <td>{getMovementUserLabel(item)}</td>
                        <td>
                          <span
                            className={`stock-movement-origin-badge ${item.isClientMovement ? "is-client" : "is-internal"}`}
                          >
                            {item.isClientMovement ? "Cliente (Web)" : "Vendedor"}
                          </span>
                        </td>
                        <td>{item.reason ?? item.reference ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!searchLoading && !result.data.length && (
                <div className="empty-state">
                  <BarChart2 size={36} />
                  <p>No encontré movimientos con esos filtros</p>
                </div>
              )}
            </div>

            <div className="stock-mobile-list stock-movements-mobile-list">
              {result.data.map((item) => {
                const group = getMovementGroup(item);

                return (
                  <article
                    className={`stock-mobile-item stock-mobile-movement-item is-${group.toLowerCase()}`}
                    key={item.id}
                  >
                    <div className="stock-mobile-head">
                      <div>
                        <h3>{item.product?.name ?? item.productId}</h3>
                        <span>{fmtDate(item.createdAt)}</span>
                      </div>

                      <span
                        className={`stock-movement-badge is-${group.toLowerCase()}`}
                      >
                        {movementIcon(group)}
                        {movementLabel(group)}
                      </span>
                    </div>

                    <div className="stock-mobile-data stock-mobile-movement-data">
                      <div>
                        <small>Desde</small>
                        <strong>{movementLocationLabel(item.from)}</strong>
                      </div>

                      <div>
                        <small>Hacia</small>
                        <strong>{movementLocationLabel(item.to)}</strong>
                      </div>

                      <div>
                        <small>Cantidad</small>
                        <strong>{getQuantityLabel(item)}</strong>
                      </div>

                      <div>
                        <small>Usuario</small>
                        <strong>{getMovementUserLabel(item)}</strong>
                      </div>

                      <div>
                        <small>Origen</small>
                        <strong>
                          {item.isClientMovement ? "Cliente (Web)" : "Vendedor"}
                        </strong>
                      </div>

                      <div>
                        <small>Referencia</small>
                        <strong>{item.reason ?? item.reference ?? "—"}</strong>
                      </div>
                    </div>
                  </article>
                );
              })}

              {!searchLoading && !result.data.length && (
                <div className="empty-state">
                  <BarChart2 size={36} />
                  <p>No encontré movimientos con esos filtros</p>
                </div>
              )}
            </div>

            {searchLoading && (
              <div style={{ padding: 14 }}>
                <div
                  className="skeleton"
                  style={{ height: 74, borderRadius: 14 }}
                />
              </div>
            )}

            <div className="stock-mobile-pagination stock-movement-pagination">
              <span>
                Página {result.page} de {result.totalPages} · {result.total}{" "}
                movimientos
              </span>

              <div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={result.page <= 1 || searchLoading}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Anterior
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={result.page >= result.totalPages || searchLoading}
                  onClick={() =>
                    setPage((prev) => Math.min(result.totalPages, prev + 1))
                  }
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}

        <style jsx global>{`
          .stock-movements-panel {
            overflow: hidden;
          }

          .stock-movements-panel-title {
            padding: 16px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
          }

          .stock-movements-panel-title b {
            display: block;
            font-size: 15px;
            color: var(--text);
            font-weight: 900;
          }

          .stock-movements-panel-title small {
            display: block;
            margin-top: 3px;
            color: var(--text3);
            font-size: 12px;
            font-weight: 700;
          }

          .stock-movement-origin-tabs {
            display: flex;
            gap: 8px;
            padding: 14px 14px 0;
            flex-wrap: wrap;
          }

          .stock-movement-origin-tabs button {
            border: 1px solid var(--border);
            background: var(--surface2);
            color: var(--text3);
            border-radius: 999px;
            padding: 6px 14px;
            font-size: 12px;
            font-weight: 850;
            cursor: pointer;
          }

          .stock-movement-origin-tabs button.is-active {
            background: var(--text);
            color: var(--surface);
            border-color: var(--text);
          }

          .stock-movement-origin-badge {
            display: inline-flex;
            align-items: center;
            border-radius: 999px;
            padding: 3px 9px;
            font-size: 10.5px;
            font-weight: 900;
            white-space: nowrap;
          }

          .stock-movement-origin-badge.is-client {
            color: #2563eb;
            background: color-mix(in srgb, #2563eb 12%, transparent);
          }

          .stock-movement-origin-badge.is-internal {
            color: var(--text3);
            background: var(--surface2);
            border: 1px solid var(--border);
          }

          .stock-movement-overview-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            padding: 14px;
          }

          .stock-movement-overview-card {
            border: 1px solid var(--border);
            border-radius: 18px;
            background: var(--surface2);
            padding: 12px;
            display: grid;
            gap: 10px;
            min-width: 0;
          }

          .stock-movement-overview-card.is-green {
            border-color: color-mix(in srgb, #16a34a 34%, var(--border));
            background: color-mix(in srgb, #16a34a 8%, var(--surface2));
          }

          .stock-movement-overview-card.is-red {
            border-color: color-mix(in srgb, #dc2626 34%, var(--border));
            background: color-mix(in srgb, #dc2626 8%, var(--surface2));
          }

          .stock-movement-overview-card.is-blue {
            border-color: color-mix(in srgb, #2563eb 34%, var(--border));
            background: color-mix(in srgb, #2563eb 8%, var(--surface2));
          }

          .stock-movement-overview-head {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto;
            gap: 9px;
            align-items: start;
          }

          .stock-movement-overview-head > span {
            width: 28px;
            height: 28px;
            border-radius: 10px;
            display: grid;
            place-items: center;
            background: var(--surface);
            border: 1px solid var(--border);
          }

          .stock-movement-overview-card.is-green
            .stock-movement-overview-head
            > span,
          .stock-movement-badge.is-ingress {
            color: #16a34a;
          }

          .stock-movement-overview-card.is-red
            .stock-movement-overview-head
            > span,
          .stock-movement-badge.is-egress {
            color: #dc2626;
          }

          .stock-movement-overview-card.is-blue
            .stock-movement-overview-head
            > span,
          .stock-movement-badge.is-transfer {
            color: #2563eb;
          }

          .stock-movement-overview-head h3 {
            margin: 0;
            font-size: 13px;
            font-weight: 950;
            color: var(--text);
            line-height: 1.15;
          }

          .stock-movement-overview-head small {
            display: block;
            margin-top: 3px;
            color: var(--text3);
            font-size: 10.5px;
            line-height: 1.2;
            font-weight: 800;
          }

          .stock-movement-overview-head b {
            font-family: var(--mono);
            font-size: 18px;
            color: var(--text);
          }

          .stock-movement-overview-list {
            display: grid;
            gap: 6px;
          }

          .stock-movement-mini-row {
            border-radius: 10px;
            background: color-mix(in srgb, var(--bg) 76%, transparent);
            padding: 7px 8px;
            display: grid;
            gap: 2px;
            min-width: 0;
          }

          .stock-movement-mini-row span {
            color: var(--text);
            font-size: 12px;
            font-weight: 900;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .stock-movement-mini-row small,
          .stock-movement-empty-mini {
            color: var(--text3);
            font-size: 10.5px;
            font-family: var(--mono);
            margin: 0;
          }

          .stock-movement-open-btn {
            width: 100%;
            justify-content: center;
          }

          .stock-movement-search-panel {
            border-top: 1px solid var(--border);
          }

          .stock-movement-filters {
            display: grid;
            grid-template-columns: minmax(200px, 1fr) 150px 170px 140px 140px auto;
            gap: 10px;
            padding: 14px;
            border-bottom: 1px solid var(--border);
            align-items: center;
          }

          .stock-movement-search-box {
            position: relative;
            min-width: 0;
          }

          .stock-movement-search-box svg {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text3);
            pointer-events: none;
          }

          .stock-movement-search-box input {
            padding-left: 34px;
          }

          .stock-movement-badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            border: 1px solid currentColor;
            border-radius: 999px;
            background: color-mix(in srgb, currentColor 9%, transparent);
            padding: 4px 8px;
            font-size: 11px;
            font-weight: 950;
            white-space: nowrap;
          }

          .stock-movement-pagination {
            display: grid;
            padding: 12px 14px;
            border-top: 1px solid var(--border);
          }

          .stock-movement-pagination > div {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
          }

          .stock-movement-pagination span {
            color: var(--text3);
            font-size: 11px;
            font-weight: 900;
          }

          @media (max-width: 1120px) {
            .stock-movement-overview-grid {
              grid-template-columns: 1fr;
            }

            .stock-movement-filters {
              grid-template-columns: 1fr 1fr;
            }
          }

          @media (max-width: 768px) {
            .stock-movements-panel-title {
              padding: 12px;
            }

            .stock-movements-panel-title {
              display: grid;
            }

            .stock-movements-panel-title button {
              width: 100%;
              justify-content: center;
            }

            .stock-movement-overview-grid {
              padding: 8px;
              gap: 8px;
            }

            .stock-movement-overview-card {
              border-radius: 14px;
              padding: 9px;
            }

            .stock-movement-filters {
              grid-template-columns: 1fr;
              padding: 10px;
              gap: 8px;
            }

            .stock-movement-filters button,
            .stock-movement-filters select,
            .stock-movement-filters input {
              width: 100%;
            }

            .stock-movement-detail-table {
              display: none;
            }

            .stock-movement-pagination > div {
              display: grid;
              grid-template-columns: 1fr 1fr;
            }
          }
        `}</style>
      </div>
    );
  },
);

export default StockMovementsPanel;
