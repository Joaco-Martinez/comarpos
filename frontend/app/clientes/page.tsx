/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import type {
  AccountMovement,
  Client,
  ClientCategory,
  PaymentMethod,
} from "@/types";
import {
  clientName,
  fmtDate,
  fmtMoney,
  normalizeArray,
  num,
} from "@/lib/helpers";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  CreditCard,
  Edit2,
  MapPin,
  KeyRound,
  Mail,
  Plus,
  Search,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";

type ClientFormStep = "datos" | "direccion" | "cuenta";

const MOBILE_CLIENTS_PAGE_SIZE = 6;
const CLIENT_DEFAULT_PASSWORD_LABEL = "ComarPOS123";

type ClientWithAddress = Client & {
  user?: {
    id: string;
    email: string;
    name?: string | null;
    role?: string | null;
    isActive?: boolean | null;
    mustChangePassword?: boolean | null;
  } | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressFloor?: string | null;
  addressApartment?: string | null;
  addressCity?: string | null;
  addressProvince?: string | null;
  addressPostalCode?: string | null;
  addressNotes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const paymentMethods: PaymentMethod[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "TARJETA",
  "DEBITO",
  "CREDITO",
  "QR",
  "QR_MERCADOPAGO",
  "QR_NACION",
];

const emptyForm = {
  nombre: "",
  apellido: "",
  dni: "",
  telefono: "",
  gmail: "",
  category: "Price",
  creditLimit: "",
  isAccountEnabled: "true",

  addressStreet: "",
  addressNumber: "",
  addressFloor: "",
  addressApartment: "",
  addressCity: "",
  addressProvince: "",
  addressPostalCode: "",
  addressNotes: "",
  latitude: "",
  longitude: "",
};

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
} | null;

function useIsMobile(maxWidth = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= maxWidth);

    check();
    window.addEventListener("resize", check);

    return () => window.removeEventListener("resize", check);
  }, [maxWidth]);

  return isMobile;
}

function cleanString(value: string) {
  const text = String(value || "").trim();
  return text || undefined;
}

function toNumberOrUndefined(value: string) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function clientAddress(c: ClientWithAddress) {
  const streetLine = [c.addressStreet, c.addressNumber]
    .filter(Boolean)
    .join(" ");
  const floorLine = [
    c.addressFloor ? `Piso ${c.addressFloor}` : "",
    c.addressApartment ? `Dto ${c.addressApartment}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const cityLine = [c.addressCity, c.addressProvince, c.addressPostalCode]
    .filter(Boolean)
    .join(" · ");

  const parts = [streetLine, floorLine, cityLine].filter(Boolean);

  return parts.length ? parts.join(" — ") : "";
}

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string; error?: string } } })
      ?.response?.data?.message ??
    (error as { response?: { data?: { message?: string; error?: string } } })
      ?.response?.data?.error ??
    fallback
  );
}

function normalizeClientCategory(value?: string | null): ClientCategory {
  if (value === "Mayorista") return "Mayorista" as ClientCategory;

  // Compatibilidad: si quedó algo viejo como "Cliente" o no llega categoría,
  // ahora lo tratamos como Minorista / Price.
  return "Price" as ClientCategory;
}

function clientCategoryLabel(value?: string | null) {
  return value === "Mayorista" ? "Mayorista" : "Minorista";
}

function hasStoreAccess(c?: ClientWithAddress | null) {
  return Boolean(c && ((c as any).userId || c.user));
}

function mustChangePassword(c?: ClientWithAddress | null) {
  return Boolean(c?.user?.mustChangePassword);
}

export default function ClientesPage() {
  const [clients, setClients] = useState<ClientWithAddress[]>([]);
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<
    "create" | "edit" | "payment" | "history" | null
  >(null);
  const [editing, setEditing] = useState<ClientWithAddress | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [payment, setPayment] = useState({
    amount: "",
    method: "EFECTIVO" as PaymentMethod,
    reference: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetToDefaultPassword, setResetToDefaultPassword] = useState(false);

  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [mobileClientSheet, setMobileClientSheet] =
    useState<ClientWithAddress | null>(null);
  const [mobileCurrentPage, setMobileCurrentPage] = useState(1);
  const [clientFormStep, setClientFormStep] = useState<ClientFormStep>("datos");

  const isMobile = useIsMobile();

  const load = async (showSuccess = false) => {
    setLoading(true);

    try {
      const r = await api.get("/clients");
      setClients(normalizeArray<ClientWithAddress>(r.data));

      if (showSuccess) {
        toast.success("Clientes actualizados");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    api
      .get("/clients")
      .then((r) => {
        if (!alive) return;
        setClients(normalizeArray<ClientWithAddress>(r.data));
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        toast.error("Error al cargar clientes");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const totalDebt = clients.reduce(
    (a, c) => a + Math.max(0, num(c.currentBalance)),
    0,
  );
  const debtors = clients.filter((c) => num(c.currentBalance) > 0).length;
  const clientsWithAddress = clients.filter((c) => clientAddress(c)).length;

  const filtered = useMemo(
    () =>
      clients.filter((c) => {
        const q = search.trim().toLowerCase();
        const address = clientAddress(c).toLowerCase();

        return (
          !q ||
          clientName(c).toLowerCase().includes(q) ||
          String(c.dni ?? "").includes(q) ||
          String(c.telefono ?? "").includes(q) ||
          String(c.gmail ?? "")
            .toLowerCase()
            .includes(q) ||
          address.includes(q)
        );
      }),
    [clients, search],
  );

  const mobileTotalPages = Math.max(
    1,
    Math.ceil(filtered.length / MOBILE_CLIENTS_PAGE_SIZE),
  );

  const mobilePaginatedClients = useMemo(() => {
    const start = (mobileCurrentPage - 1) * MOBILE_CLIENTS_PAGE_SIZE;
    return filtered.slice(start, start + MOBILE_CLIENTS_PAGE_SIZE);
  }, [filtered, mobileCurrentPage]);

  const mobilePageStart = filtered.length
    ? (mobileCurrentPage - 1) * MOBILE_CLIENTS_PAGE_SIZE + 1
    : 0;
  const mobilePageEnd = Math.min(
    mobileCurrentPage * MOBILE_CLIENTS_PAGE_SIZE,
    filtered.length,
  );

  useEffect(() => {
    setMobileCurrentPage(1);
  }, [search]);

  useEffect(() => {
    if (mobileCurrentPage > mobileTotalPages) {
      setMobileCurrentPage(mobileTotalPages);
    }
  }, [mobileCurrentPage, mobileTotalPages]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setClientFormStep("datos");
    setModal("create");
  };

  const openEdit = (c: ClientWithAddress) => {
    setEditing(c);
    setForm({
      nombre: c.nombre ?? "",
      apellido: c.apellido ?? "",
      dni: c.dni ?? "",
      telefono: c.telefono ?? "",
      gmail: c.gmail ?? "",
      category: normalizeClientCategory(
        c.category as string | null | undefined,
      ),
      creditLimit: String(c.creditLimit ?? ""),
      isAccountEnabled: String(c.isAccountEnabled !== false),

      addressStreet: c.addressStreet ?? "",
      addressNumber: c.addressNumber ?? "",
      addressFloor: c.addressFloor ?? "",
      addressApartment: c.addressApartment ?? "",
      addressCity: c.addressCity ?? "",
      addressProvince: c.addressProvince ?? "",
      addressPostalCode: c.addressPostalCode ?? "",
      addressNotes: c.addressNotes ?? "",
      latitude:
        c.latitude === null || c.latitude === undefined
          ? ""
          : String(c.latitude),
      longitude:
        c.longitude === null || c.longitude === undefined
          ? ""
          : String(c.longitude),
    });
    setNewPassword("");
    setResetToDefaultPassword(false);
    setClientFormStep("datos");
    setModal("edit");
  };

  const openPayment = (c: ClientWithAddress) => {
    setEditing(c);
    setPayment({
      amount: "",
      method: "EFECTIVO",
      reference: "",
      description: "",
    });
    setModal("payment");
  };

  const openHistory = async (c: ClientWithAddress) => {
    setEditing(c);
    setMovements([]);
    setModal("history");

    const toastId = toast.loading("Cargando cuenta corriente...");

    try {
      const r = await api.get(`/accounts/clients/${c.id}`);
      setMovements(
        normalizeArray<AccountMovement>(r.data?.movements ?? r.data),
      );
      toast.success("Cuenta corriente cargada", { id: toastId });
    } catch (e) {
      console.error(e);
      setMovements([]);
      toast.error("Error al cargar la cuenta corriente", { id: toastId });
    }
  };

  const closeModal = () => {
    if (saving) return;

    setModal(null);
    setEditing(null);
    setMovements([]);
  };

  const forceCloseModal = () => {
    setModal(null);
    setEditing(null);
    setMovements([]);
    setNewPassword("");
    setResetToDefaultPassword(false);
  };

  const requestCloseClientFormModal = () => {
    if (saving) return;

    setConfirmModal({
      title: modal === "create" ? "Cerrar nuevo cliente" : "Cerrar edición",
      message:
        "¿Seguro que querés cerrar este formulario? Los datos que no guardaste se van a perder.",
      confirmText: "Cerrar sin guardar",
      danger: true,
      onConfirm: forceCloseModal,
    });
  };

  const saveClient = async () => {
    if (!form.nombre.trim()) {
      toast.error("Ingresá el nombre del cliente");
      return;
    }

    if (!form.apellido.trim()) {
      toast.error("Ingresá el apellido del cliente");
      return;
    }

    if (!form.dni.trim()) {
      toast.error("Ingresá el DNI/CUIT del cliente");
      return;
    }

    if (modal === "create" && !form.gmail.trim()) {
      toast.error(
        "Ingresá el email del cliente para crear la cuenta de acceso",
      );
      return;
    }

    const latitude = toNumberOrUndefined(form.latitude);
    const longitude = toNumberOrUndefined(form.longitude);

    if (form.latitude && latitude === undefined) {
      toast.error("La latitud no es válida");
      return;
    }

    if (form.longitude && longitude === undefined) {
      toast.error("La longitud no es válida");
      return;
    }

    const hasUserAccount =
      modal === "edit" && Boolean((editing as any)?.userId || editing?.user);

    if (
      hasUserAccount &&
      !resetToDefaultPassword &&
      newPassword.trim() &&
      newPassword.trim().length < 6
    ) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setSaving(true);

    const toastId = toast.loading(
      modal === "create" ? "Creando cliente..." : "Guardando cliente...",
    );

    try {
      const payload = {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        dni: form.dni.trim(),
        telefono: cleanString(form.telefono),
        gmail: cleanString(form.gmail),
        category: normalizeClientCategory(form.category),
        creditLimit: form.creditLimit ? num(form.creditLimit) : null,
        isAccountEnabled: form.isAccountEnabled === "true",

        addressStreet: cleanString(form.addressStreet),
        addressNumber: cleanString(form.addressNumber),
        addressFloor: cleanString(form.addressFloor),
        addressApartment: cleanString(form.addressApartment),
        addressCity: cleanString(form.addressCity),
        addressProvince: cleanString(form.addressProvince),
        addressPostalCode: cleanString(form.addressPostalCode),
        addressNotes: cleanString(form.addressNotes),
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        createUser: modal === "create",
      };

      if (hasUserAccount && resetToDefaultPassword) {
        (payload as any).resetToDefaultPassword = true;
      } else if (hasUserAccount && newPassword.trim()) {
        (payload as any).password = newPassword.trim();
      }

      if (modal === "create") {
        await api.post("/clients", payload);
        toast.success(
          `Cliente creado. Cuenta de tienda generada con contraseña inicial: ${CLIENT_DEFAULT_PASSWORD_LABEL}`,
          { id: toastId },
        );
      } else if (editing) {
        await api.put(`/clients/${editing.id}`, payload);
        toast.success(
          resetToDefaultPassword
            ? `Cliente actualizado. Contraseña restablecida a ${CLIENT_DEFAULT_PASSWORD_LABEL}`
            : "Cliente actualizado correctamente",
          { id: toastId },
        );
      }

      forceCloseModal();
      await load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Error al guardar cliente"), {
        id: toastId,
      });
    } finally {
      setSaving(false);
    }
  };

  const savePayment = async () => {
    if (!editing) return;

    const amount = num(payment.amount);

    if (!payment.amount || amount <= 0) {
      toast.error("Ingresá un importe válido");
      return;
    }

    setSaving(true);

    const toastId = toast.loading("Registrando abono...");

    try {
      await api.post(`/accounts/clients/${editing.id}/payment`, {
        ...payment,
        amount,
      });

      toast.success("Abono registrado correctamente", { id: toastId });
      forceCloseModal();
      await load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Error al registrar abono"), {
        id: toastId,
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteClient = async (c: ClientWithAddress) => {
    setConfirmModal({
      title: "Eliminar cliente",
      message: `¿Eliminar ${clientName(c)}? Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      danger: true,
      onConfirm: async () => {
        const toastId = toast.loading("Eliminando cliente...");

        try {
          await api.delete(`/clients/${c.id}`);
          await load();
          toast.success("Cliente eliminado correctamente", { id: toastId });
        } catch (e: unknown) {
          toast.error(getErrorMessage(e, "No se pudo eliminar"), {
            id: toastId,
          });
        }
      },
    });
  };

  const confirmAction = async () => {
    if (!confirmModal) return;

    setConfirmLoading(true);

    try {
      await confirmModal.onConfirm();
      setConfirmModal(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <AppLayout
      title="Clientes"
      subtitle="Clientes, direcciones, crédito y cuenta corriente"
      actions={
        <button
          className="btn btn-primary btn-sm"
          onClick={openCreate}
          style={{
            width: isMobile ? "100%" : undefined,
            justifyContent: isMobile ? "center" : undefined,
          }}
        >
          <Plus size={14} /> Nuevo cliente
        </button>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile
            ? "repeat(2, minmax(0, 1fr))"
            : "repeat(5, 1fr)",
          gap: isMobile ? 10 : 12,
          marginBottom: 18,
        }}
      >
        <div className="stat-card">
          <div className="stat-value">{clients.length}</div>
          <div className="stat-label">Clientes</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{clientsWithAddress}</div>
          <div className="stat-label">Con dirección</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{debtors}</div>
          <div className="stat-label">Con deuda</div>
        </div>

        <div className="stat-card">
          <div
            className="stat-value"
            style={{
              color: totalDebt > 0 ? "var(--warn)" : "var(--accent)",
              fontSize: isMobile ? 18 : undefined,
              overflowWrap: "anywhere",
            }}
          >
            {fmtMoney(totalDebt)}
          </div>
          <div className="stat-label">Saldo pendiente</div>
        </div>

        <div
          className="stat-card"
          style={{
            gridColumn: isMobile ? "1 / -1" : undefined,
          }}
        >
          <div className="stat-value">
            {clients.filter((c) => c.category === "Mayorista").length}
          </div>
          <div className="stat-label">Mayoristas</div>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          marginBottom: 18,
          maxWidth: isMobile ? "100%" : 520,
          width: "100%",
        }}
      >
        <Search
          size={14}
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text3)",
          }}
        />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            isMobile
              ? "Buscar cliente..."
              : "Buscar por nombre, DNI, teléfono, email o dirección..."
          }
          style={{ paddingLeft: 34, width: "100%" }}
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: isMobile ? 14 : 20 }}>
              <div
                className="skeleton"
                style={{
                  height: isMobile ? 360 : 220,
                  borderRadius: 12,
                }}
              />
            </div>
          ) : isMobile ? (
            <div
              className="clients-mobile-list"
              style={{
                display: "grid",
                gap: 8,
                padding: 10,
              }}
            >
              {mobilePaginatedClients.map((c) => {
                const address = clientAddress(c);
                const balance = num(c.currentBalance);
                const accountDisabled = c.isAccountEnabled === false;

                return (
                  <article
                    key={c.id}
                    className="clients-mobile-card"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: 10,
                      display: "grid",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        alignItems: "flex-start",
                        minWidth: 0,
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 900,
                            fontSize: 13,
                            lineHeight: 1.2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {clientName(c)}
                        </div>

                        <div
                          style={{
                            color: "var(--text3)",
                            fontSize: 10.5,
                            marginTop: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.dni || "Sin DNI"} · {c.telefono || "Sin teléfono"}
                        </div>
                      </div>

                      <span
                        className={`badge ${
                          c.category === "Mayorista"
                            ? "badge-blue"
                            : "badge-green"
                        }`}
                        style={{
                          flexShrink: 0,
                          fontSize: 9,
                          padding: "3px 6px",
                        }}
                      >
                        {clientCategoryLabel(c.category)}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          background: "var(--surface2)",
                          borderRadius: 10,
                          padding: "7px 8px",
                          minWidth: 0,
                        }}
                      >
                        <small
                          style={{
                            display: "block",
                            color: "var(--text3)",
                            fontSize: 9,
                            fontWeight: 800,
                            marginBottom: 3,
                          }}
                        >
                          Saldo
                        </small>
                        <strong
                          style={{
                            display: "block",
                            color:
                              balance > 0 ? "var(--warn)" : "var(--accent)",
                            fontFamily: "var(--mono)",
                            fontSize: 10.5,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {fmtMoney(balance)}
                        </strong>
                      </div>

                      <div
                        style={{
                          background: "var(--surface2)",
                          borderRadius: 10,
                          padding: "7px 8px",
                          minWidth: 0,
                        }}
                      >
                        <small
                          style={{
                            display: "block",
                            color: "var(--text3)",
                            fontSize: 9,
                            fontWeight: 800,
                            marginBottom: 3,
                          }}
                        >
                          Límite
                        </small>
                        <strong
                          style={{
                            display: "block",
                            fontFamily: "var(--mono)",
                            fontSize: 10.5,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.creditLimit
                            ? fmtMoney(c.creditLimit)
                            : "Sin límite"}
                        </strong>
                      </div>

                      <div
                        style={{
                          background: "var(--surface2)",
                          borderRadius: 10,
                          padding: "7px 8px",
                          minWidth: 0,
                        }}
                      >
                        <small
                          style={{
                            display: "block",
                            color: "var(--text3)",
                            fontSize: 9,
                            fontWeight: 800,
                            marginBottom: 3,
                          }}
                        >
                          Cuenta
                        </small>
                        <strong
                          style={{
                            display: "block",
                            color: accountDisabled
                              ? "var(--danger)"
                              : "var(--text)",
                            fontSize: 10.5,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {accountDisabled ? "No" : "Sí"}
                        </strong>
                      </div>

                      <div
                        style={{
                          background: "var(--surface2)",
                          borderRadius: 10,
                          padding: "7px 8px",
                          minWidth: 0,
                        }}
                      >
                        <small
                          style={{
                            display: "block",
                            color: "var(--text3)",
                            fontSize: 9,
                            fontWeight: 800,
                            marginBottom: 3,
                          }}
                        >
                          Acceso
                        </small>
                        <strong
                          style={{
                            display: "block",
                            color: hasStoreAccess(c)
                              ? "var(--accent)"
                              : "var(--danger)",
                            fontSize: 10.5,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {hasStoreAccess(c) ? "Sí" : "No"}
                        </strong>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: address ? "var(--text2)" : "var(--text3)",
                        fontSize: 11,
                        lineHeight: 1.25,
                        minWidth: 0,
                      }}
                    >
                      <MapPin
                        size={12}
                        style={{
                          color: address ? "var(--accent)" : "var(--text3)",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          minWidth: 0,
                        }}
                      >
                        {address || "Sin dirección"}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          balance > 0 ? "1fr 1fr 1fr" : "1fr 1fr",
                        gap: 7,
                      }}
                    >
                      {balance > 0 && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openPayment(c)}
                          style={{
                            width: "100%",
                            justifyContent: "center",
                            minHeight: 31,
                          }}
                        >
                          <Wallet size={12} /> Abono
                        </button>
                      )}

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setMobileClientSheet(c)}
                        style={{
                          width: "100%",
                          justifyContent: "center",
                          minHeight: 31,
                        }}
                      >
                        Ver más
                      </button>

                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openEdit(c)}
                        style={{
                          width: "100%",
                          justifyContent: "center",
                          minHeight: 31,
                        }}
                      >
                        <Edit2 size={12} /> Editar
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>DNI/CUIT</th>
                  <th>Contacto</th>
                  <th>Dirección</th>
                  <th>Categoría</th>
                  <th>Acceso tienda</th>
                  <th>Cuenta corriente</th>
                  <th>Límite</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((c) => {
                  const address = clientAddress(c);

                  return (
                    <tr key={c.id}>
                      <td>
                        <b>{clientName(c)}</b>
                        <div style={{ color: "var(--text3)", fontSize: 11 }}>
                          {c.gmail ?? "Sin email"}
                        </div>
                      </td>

                      <td style={{ fontFamily: "var(--mono)" }}>{c.dni}</td>

                      <td>{c.telefono ?? "—"}</td>

                      <td style={{ minWidth: 230 }}>
                        {address ? (
                          <div
                            style={{
                              display: "flex",
                              gap: 7,
                              alignItems: "flex-start",
                            }}
                          >
                            <MapPin
                              size={13}
                              style={{
                                color: "var(--accent)",
                                marginTop: 2,
                                flexShrink: 0,
                              }}
                            />
                            <div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "var(--text2)",
                                  lineHeight: 1.35,
                                }}
                              >
                                {address}
                              </div>
                              {c.addressNotes && (
                                <div
                                  style={{
                                    color: "var(--text3)",
                                    fontSize: 11,
                                    marginTop: 2,
                                  }}
                                >
                                  {c.addressNotes}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "var(--text3)", fontSize: 12 }}>
                            Sin dirección
                          </span>
                        )}
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            c.category === "Mayorista"
                              ? "badge-blue"
                              : "badge-green"
                          }`}
                        >
                          {clientCategoryLabel(c.category)}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`badge ${hasStoreAccess(c) ? "badge-green" : "badge-yellow"}`}
                        >
                          {hasStoreAccess(c) ? "Con acceso" : "Sin acceso"}
                        </span>
                        <div
                          style={{
                            color: mustChangePassword(c)
                              ? "var(--warn)"
                              : "var(--text3)",
                            fontSize: 11,
                            marginTop: 2,
                          }}
                        >
                          {hasStoreAccess(c)
                            ? mustChangePassword(c)
                              ? "Debe cambiar clave"
                              : "Clave configurada"
                            : "No tiene usuario"}
                        </div>
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            num(c.currentBalance) > 0
                              ? "badge-yellow"
                              : "badge-green"
                          }`}
                        >
                          {fmtMoney(num(c.currentBalance))}
                        </span>
                        <div
                          style={{
                            color:
                              c.isAccountEnabled === false
                                ? "var(--danger)"
                                : "var(--text3)",
                            fontSize: 11,
                          }}
                        >
                          {c.isAccountEnabled === false
                            ? "Deshabilitada"
                            : "Habilitada"}
                        </div>
                      </td>

                      <td>
                        {c.creditLimit ? fmtMoney(c.creditLimit) : "Sin límite"}
                      </td>

                      <td>
                        <div
                          style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                        >
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openPayment(c)}
                            disabled={num(c.currentBalance) <= 0}
                          >
                            <Wallet size={13} /> Abono
                          </button>

                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => openHistory(c)}
                          >
                            <CreditCard size={13} />
                          </button>

                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => openEdit(c)}
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => deleteClient(c)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!loading && !filtered.length && (
            <div
              className="empty-state"
              style={{
                padding: isMobile ? "48px 16px" : undefined,
              }}
            >
              <Users size={36} />
              <p>Sin clientes</p>
            </div>
          )}
        </div>

        {isMobile && !loading && filtered.length > 0 && (
          <div
            style={{
              borderTop: "1px solid var(--border)",
              padding: 10,
              display: "grid",
              gap: 8,
              background: "var(--surface)",
            }}
          >
            <div
              style={{
                color: "var(--text3)",
                fontSize: 11,
                fontWeight: 800,
                textAlign: "center",
              }}
            >
              Mostrando {mobilePageStart} - {mobilePageEnd} de {filtered.length}{" "}
              clientes
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <button
                className="btn btn-secondary btn-sm"
                disabled={mobileCurrentPage === 1}
                onClick={() =>
                  setMobileCurrentPage((prev) => Math.max(1, prev - 1))
                }
                style={{ width: "100%", justifyContent: "center" }}
              >
                Anterior
              </button>

              <button
                className="btn btn-secondary btn-sm"
                disabled={mobileCurrentPage === mobileTotalPages}
                onClick={() =>
                  setMobileCurrentPage((prev) =>
                    Math.min(mobileTotalPages, prev + 1),
                  )
                }
                style={{ width: "100%", justifyContent: "center" }}
              >
                Siguiente
              </button>
            </div>

            <div
              style={{
                color: "var(--text2)",
                fontSize: 11,
                fontWeight: 900,
                textAlign: "center",
              }}
            >
              Página {mobileCurrentPage} de {mobileTotalPages}
            </div>
          </div>
        )}
      </div>

      {mobileClientSheet &&
        isMobile &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="clients-mobile-sheet-backdrop"
            onClick={() => setMobileClientSheet(null)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10000,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              background: "rgba(0,0,0,0.48)",
            }}
          >
            <div
              className="clients-mobile-sheet"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxHeight: "82dvh",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                borderRadius: "22px 22px 0 0",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                boxShadow: "0 -18px 60px rgba(0,0,0,0.35)",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 4,
                  borderRadius: 999,
                  background: "var(--border)",
                  margin: "10px auto 8px",
                  flexShrink: 0,
                }}
              />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "0 14px 12px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b
                    style={{
                      display: "block",
                      fontSize: 15,
                      lineHeight: 1.2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {clientName(mobileClientSheet)}
                  </b>
                  <small
                    style={{
                      display: "block",
                      color: "var(--text3)",
                      marginTop: 3,
                      fontSize: 11,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {mobileClientSheet.dni || "Sin DNI"} ·{" "}
                    {mobileClientSheet.telefono || "Sin teléfono"}
                  </small>
                </div>

                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setMobileClientSheet(null)}
                >
                  <X size={16} />
                </button>
              </div>

              <div
                style={{
                  overflowY: "auto",
                  padding: 14,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: 10,
                      background: "var(--surface2)",
                    }}
                  >
                    <small
                      style={{
                        color: "var(--text3)",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      Categoría
                    </small>
                    <b style={{ display: "block", marginTop: 5, fontSize: 12 }}>
                      {clientCategoryLabel(mobileClientSheet.category)}
                    </b>
                  </div>
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: 10,
                      background: "var(--surface2)",
                    }}
                  >
                    <small
                      style={{
                        color: "var(--text3)",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      Saldo
                    </small>
                    <b
                      style={{
                        display: "block",
                        marginTop: 5,
                        fontSize: 12,
                        color:
                          num(mobileClientSheet.currentBalance) > 0
                            ? "var(--warn)"
                            : "var(--accent)",
                      }}
                    >
                      {fmtMoney(num(mobileClientSheet.currentBalance))}
                    </b>
                  </div>
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: 10,
                      background: "var(--surface2)",
                    }}
                  >
                    <small
                      style={{
                        color: "var(--text3)",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      Límite
                    </small>
                    <b style={{ display: "block", marginTop: 5, fontSize: 12 }}>
                      {mobileClientSheet.creditLimit
                        ? fmtMoney(mobileClientSheet.creditLimit)
                        : "Sin límite"}
                    </b>
                  </div>
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: 10,
                      background: "var(--surface2)",
                    }}
                  >
                    <small
                      style={{
                        color: "var(--text3)",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      Cuenta corriente
                    </small>
                    <b
                      style={{
                        display: "block",
                        marginTop: 5,
                        fontSize: 12,
                        color:
                          mobileClientSheet.isAccountEnabled === false
                            ? "var(--danger)"
                            : "var(--text)",
                      }}
                    >
                      {mobileClientSheet.isAccountEnabled === false
                        ? "Deshabilitada"
                        : "Habilitada"}
                    </b>
                  </div>

                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: 10,
                      background: "var(--surface2)",
                    }}
                  >
                    <small
                      style={{
                        color: "var(--text3)",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      Acceso tienda
                    </small>
                    <b
                      style={{
                        display: "block",
                        marginTop: 5,
                        fontSize: 12,
                        color: hasStoreAccess(mobileClientSheet)
                          ? "var(--accent)"
                          : "var(--danger)",
                      }}
                    >
                      {hasStoreAccess(mobileClientSheet)
                        ? "Con acceso"
                        : "Sin acceso"}
                    </b>
                  </div>
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: 10,
                      background: "var(--surface2)",
                    }}
                  >
                    <small
                      style={{
                        color: "var(--text3)",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      Contraseña
                    </small>
                    <b
                      style={{
                        display: "block",
                        marginTop: 5,
                        fontSize: 12,
                        color: mustChangePassword(mobileClientSheet)
                          ? "var(--warn)"
                          : "var(--text)",
                      }}
                    >
                      {hasStoreAccess(mobileClientSheet)
                        ? mustChangePassword(mobileClientSheet)
                          ? "Debe cambiarla"
                          : "Configurada"
                        : "—"}
                    </b>
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    padding: 10,
                    background: "var(--surface2)",
                  }}
                >
                  <small
                    style={{
                      color: "var(--text3)",
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  >
                    Contacto
                  </small>
                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "var(--text2)",
                      fontSize: 12,
                      lineHeight: 1.45,
                      overflowWrap: "anywhere",
                    }}
                  >
                    Teléfono: {mobileClientSheet.telefono || "—"}
                    <br />
                    Email: {mobileClientSheet.gmail || "—"}
                  </p>
                </div>

                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    padding: 10,
                    background: "var(--surface2)",
                  }}
                >
                  <small
                    style={{
                      color: "var(--text3)",
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  >
                    Dirección
                  </small>
                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "var(--text2)",
                      fontSize: 12,
                      lineHeight: 1.45,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {clientAddress(mobileClientSheet) || "Sin dirección"}
                    {mobileClientSheet.addressNotes
                      ? ` — ${mobileClientSheet.addressNotes}`
                      : ""}
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    num(mobileClientSheet.currentBalance) > 0
                      ? "1fr 1fr"
                      : "1fr",
                  gap: 8,
                  padding: "12px 14px calc(12px + env(safe-area-inset-bottom))",
                  borderTop: "1px solid var(--border)",
                  background: "var(--surface)",
                }}
              >
                {num(mobileClientSheet.currentBalance) > 0 && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      const client = mobileClientSheet;
                      setMobileClientSheet(null);
                      openPayment(client);
                    }}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    <Wallet size={15} /> Abono
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const client = mobileClientSheet;
                    setMobileClientSheet(null);
                    openEdit(client);
                  }}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <Edit2 size={15} /> Editar
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    const client = mobileClientSheet;
                    setMobileClientSheet(null);
                    openHistory(client);
                  }}
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    gridColumn: "1 / -1",
                  }}
                >
                  <CreditCard size={15} /> Cuenta corriente
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    const client = mobileClientSheet;
                    setMobileClientSheet(null);
                    deleteClient(client);
                  }}
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    gridColumn: "1 / -1",
                  }}
                >
                  <Trash2 size={15} /> Eliminar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {(modal === "create" || modal === "edit") &&
        typeof document !== "undefined" &&
        createPortal(
        <div className="modal-overlay client-form-modal-overlay">
          <div
            className="modal client-form-modal"
            style={{
              maxWidth: isMobile ? "100vw" : 860,
              width: isMobile ? "100vw" : undefined,
              height: isMobile ? "min(94dvh, calc(100dvh - 8px))" : undefined,
              maxHeight: isMobile
                ? "min(94dvh, calc(100dvh - 8px))"
                : undefined,
              margin: isMobile ? "auto 0 0" : undefined,
              borderRadius: isMobile ? "22px 22px 0 0" : undefined,
              overflow: isMobile ? "hidden" : undefined,
              display: isMobile ? "flex" : undefined,
              flexDirection: isMobile ? "column" : undefined,
            }}
          >
            <div className="modal-header">
              <b>{modal === "create" ? "Nuevo cliente" : "Editar cliente"}</b>

              <button
                className="btn btn-ghost btn-sm"
                onClick={requestCloseClientFormModal}
                disabled={saving}
              >
                <X size={16} />
              </button>
            </div>

            <div
              className="modal-body"
              style={{
                flex: isMobile ? "1 1 auto" : undefined,
                minHeight: isMobile ? 0 : undefined,
                overflowY: isMobile ? "auto" : undefined,
                padding: isMobile ? 12 : undefined,
              }}
            >
              {isMobile && (
                <div
                  style={{
                    position: "sticky",
                    top: -12,
                    zIndex: 4,
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 6,
                    padding: "0 0 10px",
                    marginBottom: 10,
                    background: "var(--surface)",
                  }}
                >
                  {[
                    ["datos", "Datos"],
                    ["cuenta", "Cuenta"],
                    ["direccion", "Dirección"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setClientFormStep(key as ClientFormStep)}
                      style={{
                        border: `1px solid ${
                          clientFormStep === key
                            ? "var(--accent)"
                            : "var(--border)"
                        }`,
                        background:
                          clientFormStep === key
                            ? "color-mix(in srgb, var(--accent) 12%, var(--surface))"
                            : "var(--surface2)",
                        color:
                          clientFormStep === key
                            ? "var(--accent)"
                            : "var(--text2)",
                        borderRadius: 999,
                        minHeight: 32,
                        fontSize: 11,
                        fontWeight: 900,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <div
                style={{
                  display:
                    isMobile && clientFormStep !== "datos" ? "none" : undefined,
                }}
              >
                <div
                  style={{
                    marginBottom: 16,
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    background: "var(--surface2)",
                  }}
                >
                  <div
                    style={{ fontWeight: 900, fontSize: 13, marginBottom: 4 }}
                  >
                    Datos del cliente
                  </div>
                  <div style={{ color: "var(--text3)", fontSize: 12 }}>
                    Información comercial, categoría y cuenta de acceso a la
                    tienda.
                  </div>
                </div>

                <div
                  className="form-row"
                  style={{ flexDirection: isMobile ? "column" : undefined }}
                >
                  <div className="form-group">
                    <label className="form-label">Nombre *</label>
                    <input
                      value={form.nombre}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, nombre: e.target.value }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Apellido *</label>
                    <input
                      value={form.apellido}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, apellido: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div
                  className="form-row"
                  style={{ flexDirection: isMobile ? "column" : undefined }}
                >
                  <div className="form-group">
                    <label className="form-label">DNI/CUIT *</label>
                    <input
                      value={form.dni}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, dni: e.target.value }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Categoría</label>
                    <select
                      value={form.category}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, category: e.target.value }))
                      }
                    >
                      <option value="Price">Minorista</option>
                      <option value="Mayorista">Mayorista</option>
                    </select>
                  </div>
                </div>

                <div
                  className="form-row"
                  style={{ flexDirection: isMobile ? "column" : undefined }}
                >
                  <div className="form-group">
                    <label className="form-label">Teléfono</label>
                    <input
                      value={form.telefono}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, telefono: e.target.value }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Email {modal === "create" ? "*" : ""}
                    </label>
                    <input
                      type="email"
                      value={form.gmail}
                      placeholder="cliente@empresa.com"
                      onChange={(e) =>
                        setForm((p) => ({ ...p, gmail: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {modal === "create" && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 14,
                      borderRadius: 14,
                      border: "1px solid rgba(79,142,255,0.25)",
                      background: "rgba(79,142,255,0.08)",
                      color: "var(--text2)",
                      fontSize: 12,
                      lineHeight: 1.45,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        fontWeight: 900,
                        color: "var(--text)",
                        marginBottom: 4,
                      }}
                    >
                      <KeyRound size={15} style={{ color: "var(--accent)" }} />
                      Cuenta de acceso automática
                    </div>
                    Al guardar, se crea una cuenta para la tienda con este
                    email. La contraseña inicial es{" "}
                    <b>{CLIENT_DEFAULT_PASSWORD_LABEL}</b> y el cliente deberá
                    cambiarla al ingresar por primera vez.
                  </div>
                )}
              </div>

              <div
                style={{
                  display:
                    isMobile && clientFormStep !== "cuenta"
                      ? "none"
                      : undefined,
                }}
              >
                <div
                  style={{
                    marginBottom: 14,
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    background: "var(--surface2)",
                    color: "var(--text2)",
                    fontSize: 12,
                    lineHeight: 1.45,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      fontWeight: 900,
                      color: "var(--text)",
                      marginBottom: 4,
                    }}
                  >
                    <Mail size={15} style={{ color: "var(--accent)" }} />
                    Acceso a tienda
                  </div>
                  {modal === "create"
                    ? "La cuenta de acceso se genera automáticamente usando el email cargado en Datos."
                    : (editing as any)?.userId || editing?.user
                      ? mustChangePassword(editing)
                        ? "Este cliente ya tiene acceso y todavía debe cambiar su contraseña inicial."
                        : "Este cliente ya tiene acceso a la tienda."
                      : "Este cliente todavía no tiene usuario de acceso."}
                </div>

                {modal === "edit" &&
                  ((editing as any)?.userId || editing?.user) && (
                    <div
                      style={{
                        marginBottom: 14,
                        padding: 14,
                        borderRadius: 14,
                        border: "1px solid var(--border)",
                        background: "var(--surface2)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          fontWeight: 900,
                          color: "var(--text)",
                          marginBottom: 10,
                          fontSize: 13,
                        }}
                      >
                        <KeyRound size={15} style={{ color: "var(--accent)" }} />
                        Cambiar contraseña
                      </div>

                      <div className="form-group">
                        <label className="form-label">Nueva contraseña</label>
                        <input
                          type="text"
                          value={newPassword}
                          placeholder="Dejar vacío para no cambiarla"
                          disabled={resetToDefaultPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>

                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginTop: 10,
                          fontSize: 12,
                          color: "var(--text2)",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={resetToDefaultPassword}
                          onChange={(e) => {
                            setResetToDefaultPassword(e.target.checked);
                            if (e.target.checked) setNewPassword("");
                          }}
                        />
                        Restablecer a la contraseña por defecto (
                        {CLIENT_DEFAULT_PASSWORD_LABEL})
                      </label>
                    </div>
                  )}

                <div
                  className="form-row"
                  style={{ flexDirection: isMobile ? "column" : undefined }}
                >
                  <div className="form-group">
                    <label className="form-label">Límite de crédito</label>
                    <input
                      type="number"
                      value={form.creditLimit}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, creditLimit: e.target.value }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Cuenta corriente</label>
                    <select
                      value={form.isAccountEnabled}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          isAccountEnabled: e.target.value,
                        }))
                      }
                    >
                      <option value="true">Habilitada</option>
                      <option value="false">Deshabilitada</option>
                    </select>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display:
                    isMobile && clientFormStep !== "direccion"
                      ? "none"
                      : undefined,
                }}
              >
                <div
                  style={{
                    margin: "20px 0 16px",
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    background: "var(--surface2)",
                  }}
                >
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <MapPin size={16} style={{ color: "var(--accent)" }} />
                    <div style={{ fontWeight: 900, fontSize: 13 }}>
                      Dirección de entrega
                    </div>
                  </div>
                  <div
                    style={{
                      color: "var(--text3)",
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    Esta dirección se va a usar después para calcular envío,
                    remitos y entregas.
                  </div>
                </div>

                <div
                  className="form-row"
                  style={{ flexDirection: isMobile ? "column" : undefined }}
                >
                  <div className="form-group">
                    <label className="form-label">Calle</label>
                    <input
                      value={form.addressStreet}
                      placeholder="Ej: San Martín"
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          addressStreet: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Número</label>
                    <input
                      value={form.addressNumber}
                      placeholder="Ej: 810"
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          addressNumber: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div
                  className="form-row"
                  style={{ flexDirection: isMobile ? "column" : undefined }}
                >
                  <div className="form-group">
                    <label className="form-label">Piso</label>
                    <input
                      value={form.addressFloor}
                      placeholder="Opcional"
                      onChange={(e) =>
                        setForm((p) => ({ ...p, addressFloor: e.target.value }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Departamento</label>
                    <input
                      value={form.addressApartment}
                      placeholder="Opcional"
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          addressApartment: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div
                  className="form-row"
                  style={{ flexDirection: isMobile ? "column" : undefined }}
                >
                  <div className="form-group">
                    <label className="form-label">Localidad</label>
                    <input
                      value={form.addressCity}
                      placeholder="Ej: Villa General Belgrano"
                      onChange={(e) =>
                        setForm((p) => ({ ...p, addressCity: e.target.value }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Provincia</label>
                    <input
                      value={form.addressProvince}
                      placeholder="Ej: Córdoba"
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          addressProvince: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div
                  className="form-row"
                  style={{ flexDirection: isMobile ? "column" : undefined }}
                >
                  <div className="form-group">
                    <label className="form-label">Código postal</label>
                    <input
                      value={form.addressPostalCode}
                      placeholder="Ej: 5194"
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          addressPostalCode: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Notas de dirección</label>
                    <input
                      value={form.addressNotes}
                      placeholder="Ej: casa roja, portón negro, tocar timbre..."
                      onChange={(e) =>
                        setForm((p) => ({ ...p, addressNotes: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid var(--border)",
                    background: "rgba(79,142,255,0.07)",
                  }}
                >
                  <div
                    style={{ fontWeight: 900, fontSize: 13, marginBottom: 4 }}
                  >
                    Coordenadas para cálculo automático
                  </div>
                  <div
                    style={{
                      color: "var(--text3)",
                      fontSize: 12,
                      lineHeight: 1.45,
                    }}
                  >
                    Por ahora se pueden cargar manualmente. Después conectamos
                    Google para obtenerlas automáticamente desde la dirección.
                  </div>
                </div>

                <div
                  className="form-row"
                  style={{
                    marginTop: 14,
                    flexDirection: isMobile ? "column" : undefined,
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">Latitud</label>
                    <input
                      value={form.latitude}
                      placeholder="-31.978"
                      onChange={(e) =>
                        setForm((p) => ({ ...p, latitude: e.target.value }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Longitud</label>
                    <input
                      value={form.longitude}
                      placeholder="-64.556"
                      onChange={(e) =>
                        setForm((p) => ({ ...p, longitude: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              className="modal-footer"
              style={{
                flexDirection: isMobile ? "column-reverse" : undefined,
                flexShrink: isMobile ? 0 : undefined,
                padding: isMobile
                  ? "10px 12px calc(10px + env(safe-area-inset-bottom))"
                  : undefined,
                borderTop: isMobile ? "1px solid var(--border)" : undefined,
                background: isMobile ? "var(--surface)" : undefined,
                boxShadow: isMobile
                  ? "0 -12px 28px rgba(0,0,0,0.22)"
                  : undefined,
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={requestCloseClientFormModal}
                disabled={saving}
                style={{ width: isMobile ? "100%" : undefined }}
              >
                Cancelar
              </button>

              <button
                className="btn btn-primary"
                onClick={saveClient}
                disabled={
                  saving ||
                  !form.nombre ||
                  !form.apellido ||
                  !form.dni ||
                  (modal === "create" && !form.gmail)
                }
                style={{ width: isMobile ? "100%" : undefined }}
              >
                {saving ? (
                  <span className="spinner" />
                ) : modal === "create" ? (
                  "Crear cliente y cuenta"
                ) : (
                  "Guardar"
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {modal === "payment" && editing && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div
            className="modal"
            style={{
              width: isMobile ? "calc(100vw - 24px)" : undefined,
              maxWidth: isMobile ? "calc(100vw - 24px)" : undefined,
            }}
          >
            <div className="modal-header">
              <b>Registrar abono</b>

              <button
                className="btn btn-ghost btn-sm"
                onClick={closeModal}
                disabled={saving}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p
                style={{
                  color: "var(--text2)",
                  marginBottom: 14,
                  overflowWrap: "anywhere",
                }}
              >
                {clientName(editing)} · saldo {fmtMoney(editing.currentBalance)}
              </p>

              <div
                className="form-row"
                style={{ flexDirection: isMobile ? "column" : undefined }}
              >
                <div className="form-group">
                  <label className="form-label">Importe</label>
                  <input
                    type="number"
                    value={payment.amount}
                    onChange={(e) =>
                      setPayment((p) => ({ ...p, amount: e.target.value }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Método</label>
                  <select
                    value={payment.method}
                    onChange={(e) =>
                      setPayment((p) => ({
                        ...p,
                        method: e.target.value as PaymentMethod,
                      }))
                    }
                  >
                    {paymentMethods.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Referencia</label>
                <input
                  value={payment.reference}
                  onChange={(e) =>
                    setPayment((p) => ({ ...p, reference: e.target.value }))
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input
                  value={payment.description}
                  onChange={(e) =>
                    setPayment((p) => ({ ...p, description: e.target.value }))
                  }
                />
              </div>
            </div>

            <div
              className="modal-footer"
              style={{
                flexDirection: isMobile ? "column-reverse" : undefined,
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={closeModal}
                disabled={saving}
                style={{ width: isMobile ? "100%" : undefined }}
              >
                Cancelar
              </button>

              <button
                className="btn btn-primary"
                onClick={savePayment}
                disabled={saving || !payment.amount}
                style={{ width: isMobile ? "100%" : undefined }}
              >
                {saving ? <span className="spinner" /> : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === "history" && editing && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div
            className="modal"
            style={{
              maxWidth: isMobile ? "calc(100vw - 24px)" : 760,
              width: isMobile ? "calc(100vw - 24px)" : undefined,
              maxHeight: isMobile ? "calc(100vh - 24px)" : undefined,
              overflowY: isMobile ? "auto" : undefined,
            }}
          >
            <div className="modal-header">
              <b style={{ overflowWrap: "anywhere" }}>
                Cuenta corriente · {clientName(editing)}
              </b>

              <button className="btn btn-ghost btn-sm" onClick={closeModal}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div className="card">
                <div className="table-wrap">
                  {isMobile ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        padding: 12,
                      }}
                    >
                      {movements.map((m) => (
                        <div
                          key={m.id}
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 12,
                            padding: 12,
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 10,
                              alignItems: "center",
                            }}
                          >
                            <div
                              style={{
                                fontFamily: "var(--mono)",
                                fontSize: 12,
                              }}
                            >
                              {fmtDate(m.date)}
                            </div>

                            <span
                              className={`badge ${
                                m.type === "PAYMENT"
                                  ? "badge-green"
                                  : "badge-yellow"
                              }`}
                            >
                              {m.type}
                            </span>
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                              gap: 8,
                            }}
                          >
                            <div>
                              <div
                                style={{ color: "var(--text3)", fontSize: 11 }}
                              >
                                Importe
                              </div>
                              <div
                                style={{
                                  fontFamily: "var(--mono)",
                                  fontWeight: 800,
                                  fontSize: 12,
                                }}
                              >
                                {fmtMoney(m.amount)}
                              </div>
                            </div>

                            <div>
                              <div
                                style={{ color: "var(--text3)", fontSize: 11 }}
                              >
                                Anterior
                              </div>
                              <div style={{ fontSize: 12 }}>
                                {fmtMoney(m.previousBalance)}
                              </div>
                            </div>

                            <div>
                              <div
                                style={{ color: "var(--text3)", fontSize: 11 }}
                              >
                                Nuevo
                              </div>
                              <div style={{ fontSize: 12 }}>
                                {fmtMoney(m.newBalance)}
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              color: "var(--text2)",
                              fontSize: 12,
                              lineHeight: 1.4,
                              overflowWrap: "anywhere",
                            }}
                          >
                            {m.description ?? m.reference ?? "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Importe</th>
                          <th>Anterior</th>
                          <th>Nuevo</th>
                          <th>Detalle</th>
                        </tr>
                      </thead>

                      <tbody>
                        {movements.map((m) => (
                          <tr key={m.id}>
                            <td>{fmtDate(m.date)}</td>
                            <td>
                              <span
                                className={`badge ${
                                  m.type === "PAYMENT"
                                    ? "badge-green"
                                    : "badge-yellow"
                                }`}
                              >
                                {m.type}
                              </span>
                            </td>
                            <td
                              style={{
                                fontFamily: "var(--mono)",
                                fontWeight: 800,
                              }}
                            >
                              {fmtMoney(m.amount)}
                            </td>
                            <td>{fmtMoney(m.previousBalance)}</td>
                            <td>{fmtMoney(m.newBalance)}</td>
                            <td>{m.description ?? m.reference ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {!movements.length && (
                    <div className="empty-state">
                      <CreditCard size={36} />
                      <p>Sin movimientos</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmModal &&
        typeof document !== "undefined" &&
        createPortal(
        <div
          className="modal-overlay confirm-modal-overlay"
          onClick={(e) => {
            if (confirmLoading) return;
            if (e.target === e.currentTarget) setConfirmModal(null);
          }}
        >
          <div
            className="modal"
            style={{
              maxWidth: isMobile ? "calc(100vw - 24px)" : 440,
              width: isMobile ? "calc(100vw - 24px)" : undefined,
            }}
          >
            <div className="modal-header">
              <b>{confirmModal.title}</b>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => !confirmLoading && setConfirmModal(null)}
                disabled={confirmLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div
                style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
              >
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: confirmModal.danger
                      ? "rgba(239,68,68,0.12)"
                      : "var(--surface2)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle
                    size={18}
                    style={{
                      color: confirmModal.danger
                        ? "var(--danger)"
                        : "var(--accent)",
                    }}
                  />
                </span>

                <p
                  style={{
                    color: "var(--text2)",
                    fontSize: 13,
                    lineHeight: 1.55,
                    margin: 0,
                    overflowWrap: "anywhere",
                  }}
                >
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div
              className="modal-footer"
              style={{
                flexDirection: isMobile ? "column-reverse" : undefined,
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmModal(null)}
                disabled={confirmLoading}
                style={{ width: isMobile ? "100%" : undefined }}
              >
                Cancelar
              </button>

              <button
                className={
                  confirmModal.danger ? "btn btn-danger" : "btn btn-primary"
                }
                onClick={confirmAction}
                disabled={confirmLoading}
                style={{ width: isMobile ? "100%" : undefined }}
              >
                {confirmLoading ? (
                  <span className="spinner" />
                ) : (
                  (confirmModal.confirmText ?? "Confirmar")
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <style jsx global>{`
        div[data-rht-toaster],
        div[data-rht-toaster] * {
          z-index: 2147483647 !important;
        }

        .modal-overlay {
          z-index: 2147483000 !important;
        }

        .confirm-modal-overlay {
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483600 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 18px !important;
          background: rgba(0, 0, 0, 0.58) !important;
        }

        .confirm-modal-overlay .modal {
          width: min(440px, calc(100vw - 24px)) !important;
          max-width: calc(100vw - 24px) !important;
        }

        .client-form-modal-overlay {
          position: fixed !important;
          inset: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 18px !important;
          background: rgba(0, 0, 0, 0.48) !important;
          overflow-y: auto !important;
        }

        .client-form-modal {
          width: min(860px, calc(100vw - 36px)) !important;
          max-height: calc(100dvh - 36px) !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
        }

        .client-form-modal .modal-body {
          overflow-y: auto !important;
        }

        @media (max-width: 768px) {
          .client-form-modal-overlay {
            align-items: flex-end !important;
            padding: 8px 0 0 !important;
          }

          .client-form-modal {
            width: 100vw !important;
            max-width: 100vw !important;
            max-height: min(94dvh, calc(100dvh - 8px)) !important;
            border-radius: 22px 22px 0 0 !important;
          }
        }

        .clients-mobile-sheet-backdrop {
          z-index: 2147483000 !important;
        }
      `}</style>
    </AppLayout>
  );
}
