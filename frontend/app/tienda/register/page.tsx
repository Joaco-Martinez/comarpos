"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Home,
  IdCard,
  Lock,
  LogIn,
  Mail,
  MapPin,
  Phone,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import { useShopAuth } from "@/context/ShopAuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type RegisterPayload = {
  nombre: string;
  apellido: string;
  dni: string;
  telefono?: string | null;
  gmail: string;
  password: string;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressFloor?: string | null;
  addressApartment?: string | null;
  addressCity?: string | null;
  addressProvince?: string | null;
  addressPostalCode?: string | null;
  addressNotes?: string | null;
};

function clean(value: string) {
  const text = value.trim();
  return text || null;
}

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

async function registerStoreClient(payload: RegisterPayload) {
  const res = await fetch(`${API_URL}/clients/tienda/register`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(
      data?.message || data?.error || "No se pudo crear la cuenta"
    );
  }

  return data;
}

export default function TiendaRegisterPage() {
  const router = useRouter();
  const { login, isLoggedIn, loading } = useShopAuth();

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [dni, setDni] = useState("");
  const [telefono, setTelefono] = useState("");
  const [gmail, setGmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  const [addressStreet, setAddressStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressFloor, setAddressFloor] = useState("");
  const [addressApartment, setAddressApartment] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressProvince, setAddressProvince] = useState("");
  const [addressPostalCode, setAddressPostalCode] = useState("");
  const [addressNotes, setAddressNotes] = useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(
      nombre.trim() &&
        apellido.trim() &&
        dni.trim() &&
        gmail.trim() &&
        password.trim() &&
        repeatPassword.trim()
    );
  }, [nombre, apellido, dni, gmail, password, repeatPassword]);

  useEffect(() => {
    if (loading) return;

    if (isLoggedIn) {
      router.replace("/tienda/cuenta");
    }
  }, [loading, isLoggedIn, router]);

  function validateForm() {
    if (!nombre.trim()) {
      toast.error("Ingresá tu nombre");
      return false;
    }

    if (!apellido.trim()) {
      toast.error("Ingresá tu apellido");
      return false;
    }

    if (!dni.trim()) {
      toast.error("Ingresá tu DNI/CUIT");
      return false;
    }

    if (!gmail.trim()) {
      toast.error("Ingresá tu correo electrónico");
      return false;
    }

    if (!gmail.includes("@")) {
      toast.error("Ingresá un correo electrónico válido");
      return false;
    }

    if (!password.trim()) {
      toast.error("Ingresá una contraseña");
      return false;
    }

    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return false;
    }

    if (password !== repeatPassword) {
      toast.error("Las contraseñas no coinciden");
      return false;
    }

    return true;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    if (!validateForm()) return;

    setSaving(true);
    setError("");

    const toastId = toast.loading("Creando cuenta...");

    try {
      const email = gmail.trim().toLowerCase();

      await registerStoreClient({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        dni: dni.trim(),
        telefono: clean(telefono),
        gmail: email,
        password,

        addressStreet: clean(addressStreet),
        addressNumber: clean(addressNumber),
        addressFloor: clean(addressFloor),
        addressApartment: clean(addressApartment),
        addressCity: clean(addressCity),
        addressProvince: clean(addressProvince),
        addressPostalCode: clean(addressPostalCode),
        addressNotes: clean(addressNotes),
      });

      toast.success("Cuenta creada correctamente", { id: toastId });

      await login({
        email,
        password,
      });

      toast.success("Sesión iniciada correctamente");

      router.push("/tienda/cuenta");
      router.refresh();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "No se pudo crear la cuenta");

      setError(message);
      toast.error(message, { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        :root {
          --bg: #f4f6f8;
          --white: #ffffff;
          --text: #111827;
          --muted: #6b7280;
          --soft: #9ca3af;
          --line: #e5e7eb;
          --line-strong: #d1d5db;
          --primary: #111827;
          --primary-hover: #030712;
          --blue: #2563eb;
          --blue-soft: #eff6ff;
          --green: #16a34a;
          --green-hover: #15803d;
          --red: #dc2626;
          --red-soft: #fef2f2;
          --shadow: 0 24px 70px rgba(15, 23, 42, 0.10);
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
        }

        button,
        input,
        textarea {
          font-family: inherit;
        }

        .register-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top, rgba(37, 99, 235, 0.08), transparent 34%),
            var(--bg);
          color: var(--text);
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px;
        }

        .register-card {
          width: 100%;
          max-width: 560px;
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 28px;
          padding: 34px;
          box-shadow: var(--shadow);
        }

        .logo-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 28px;
          text-align: center;
        }

        .logo-mark {
          width: 68px;
          height: 68px;
          border-radius: 22px;
          background: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          margin-bottom: 14px;
          box-shadow: 0 14px 34px rgba(17, 24, 39, 0.18);
        }

        .logo-img {
          width: 48px;
          height: auto;
          object-fit: contain;
          display: block;
        }

        .logo-title {
          margin: 0;
          color: var(--text);
          font-size: 23px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.045em;
        }

        .logo-subtitle {
          margin: 8px 0 0;
          color: var(--muted);
          font-size: 13px;
          font-weight: 600;
        }

        .form-title {
          margin: 0;
          color: var(--text);
          font-size: 28px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.055em;
          text-align: center;
        }

        .form-sub {
          margin: 10px 0 26px;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.55;
          font-weight: 600;
          text-align: center;
        }

        .form-section {
          margin-top: 22px;
        }

        .section-title {
          margin: 0 0 14px;
          color: var(--text);
          font-size: 14px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.02em;
        }

        .field-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .field-group {
          margin-bottom: 16px;
        }

        .field-group.full {
          grid-column: 1 / -1;
        }

        .field-label {
          display: block;
          color: var(--text);
          font-size: 13px;
          font-weight: 850;
          margin-bottom: 8px;
        }

        .input-wrap {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 15px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--soft);
          width: 18px;
          height: 18px;
          pointer-events: none;
        }

        .textarea-icon {
          top: 18px;
          transform: none;
        }

        .field-input,
        .field-textarea {
          width: 100%;
          border: 1px solid var(--line);
          background: #f9fafb;
          color: var(--text);
          border-radius: 16px;
          outline: none;
          font-size: 14px;
          font-weight: 600;
          transition: 0.18s ease;
        }

        .field-input {
          height: 50px;
          padding: 0 15px 0 46px;
        }

        .field-textarea {
          min-height: 88px;
          resize: vertical;
          padding: 15px 15px 15px 46px;
          line-height: 1.45;
        }

        .field-input::placeholder,
        .field-textarea::placeholder {
          color: var(--soft);
        }

        .field-input:focus,
        .field-textarea:focus {
          background: var(--white);
          border-color: var(--primary);
          box-shadow: 0 0 0 4px rgba(17, 24, 39, 0.08);
        }

        .field-input:disabled,
        .field-textarea:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .hint-box {
          background: var(--blue-soft);
          color: #1d4ed8;
          border: 1px solid rgba(37, 99, 235, 0.14);
          border-radius: 16px;
          padding: 13px 14px;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 750;
          margin-bottom: 18px;
        }

        .error-box {
          background: var(--red-soft);
          color: var(--red);
          border: 1px solid rgba(220, 38, 38, 0.14);
          border-radius: 16px;
          padding: 13px 14px;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 750;
          margin-bottom: 18px;
        }

        .btn-submit {
          width: 100%;
          height: 52px;
          border: none;
          border-radius: 16px;
          background: var(--primary);
          color: var(--white);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
          margin-top: 6px;
          transition: 0.18s ease;
          box-shadow: 0 16px 32px rgba(17, 24, 39, 0.16);
        }

        .btn-submit:hover {
          background: var(--primary-hover);
          transform: translateY(-1px);
        }

        .btn-submit:disabled {
          background: #e5e7eb;
          color: var(--soft);
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        .divider {
          height: 1px;
          background: var(--line);
          margin: 24px 0;
        }

        .auth-footer {
          margin: 0;
          color: var(--muted);
          text-align: center;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.45;
        }

        .login-link {
          margin-top: 14px;
          width: 100%;
          min-height: 48px;
          border-radius: 16px;
          background: var(--green);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          text-decoration: none;
          font-size: 14px;
          font-weight: 950;
          transition: 0.18s ease;
          box-shadow: 0 14px 30px rgba(22, 163, 74, 0.22);
        }

        .login-link:hover {
          background: var(--green-hover);
          transform: translateY(-1px);
        }

        .back-to-shop {
          margin-top: 16px;
          height: 42px;
          border-radius: 14px;
          border: 1px solid var(--line);
          background: var(--white);
          color: var(--text);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          text-decoration: none;
          font-size: 13px;
          font-weight: 850;
          transition: 0.18s ease;
        }

        .back-to-shop:hover {
          background: #f9fafb;
          border-color: var(--line-strong);
        }

        @media (max-width: 640px) {
          .register-page {
            padding: 18px;
            align-items: flex-start;
          }

          .register-card {
            padding: 26px 22px;
            border-radius: 24px;
          }

          .field-grid {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .logo-mark {
            width: 62px;
            height: 62px;
            border-radius: 20px;
          }

          .logo-img {
            width: 44px;
          }

          .form-title {
            font-size: 26px;
          }

          .login-link {
            min-height: 50px;
            font-size: 13px;
          }
        }
      `}</style>

      <main className="register-page">
        <section className="register-card">
          <div className="logo-wrap">
            <div className="logo-mark">
              <Image
                src="/logo-vj-white-transparent.png"
                alt="Logo"
                width={120}
                height={120}
                className="logo-img"
                priority
              />
            </div>

            <h1 className="logo-title">ComarPOS</h1>
            <p className="logo-subtitle">Portal de clientes</p>
          </div>

          <h2 className="form-title">Crear cuenta</h2>

          <p className="form-sub">
            Registrate para comprar desde la tienda y acceder a tus pedidos.
          </p>

          <div className="hint-box">
            Tu cuenta se crea como cliente minorista. Si necesitás cuenta
            mayorista, el negocio puede activarla después desde el sistema.
          </div>

          {error && <div className="error-box">⚠ {error}</div>}

          <form onSubmit={onSubmit}>
            <div className="form-section">
              <h3 className="section-title">Datos personales</h3>

              <div className="field-grid">
                <div className="field-group">
                  <label className="field-label" htmlFor="nombre">
                    Nombre
                  </label>

                  <div className="input-wrap">
                    <User className="input-icon" />
                    <input
                      id="nombre"
                      className="field-input"
                      type="text"
                      autoComplete="given-name"
                      placeholder="Juan"
                      value={nombre}
                      disabled={saving || loading}
                      onChange={(e) => setNombre(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="apellido">
                    Apellido
                  </label>

                  <div className="input-wrap">
                    <User className="input-icon" />
                    <input
                      id="apellido"
                      className="field-input"
                      type="text"
                      autoComplete="family-name"
                      placeholder="Pérez"
                      value={apellido}
                      disabled={saving || loading}
                      onChange={(e) => setApellido(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="dni">
                    DNI / CUIT
                  </label>

                  <div className="input-wrap">
                    <IdCard className="input-icon" />
                    <input
                      id="dni"
                      className="field-input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="30111222"
                      value={dni}
                      disabled={saving || loading}
                      onChange={(e) => setDni(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="telefono">
                    Teléfono
                  </label>

                  <div className="input-wrap">
                    <Phone className="input-icon" />
                    <input
                      id="telefono"
                      className="field-input"
                      type="tel"
                      autoComplete="tel"
                      placeholder="+54 9..."
                      value={telefono}
                      disabled={saving || loading}
                      onChange={(e) => setTelefono(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">Acceso a la tienda</h3>

              <div className="field-group">
                <label className="field-label" htmlFor="gmail">
                  Correo electrónico
                </label>

                <div className="input-wrap">
                  <Mail className="input-icon" />
                  <input
                    id="gmail"
                    className="field-input"
                    type="email"
                    autoComplete="email"
                    placeholder="cliente@empresa.com"
                    value={gmail}
                    disabled={saving || loading}
                    onChange={(e) => setGmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="field-grid">
                <div className="field-group">
                  <label className="field-label" htmlFor="password">
                    Contraseña
                  </label>

                  <div className="input-wrap">
                    <Lock className="input-icon" />
                    <input
                      id="password"
                      className="field-input"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      disabled={saving || loading}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="repeatPassword">
                    Repetir contraseña
                  </label>

                  <div className="input-wrap">
                    <Lock className="input-icon" />
                    <input
                      id="repeatPassword"
                      className="field-input"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repetí la contraseña"
                      value={repeatPassword}
                      disabled={saving || loading}
                      onChange={(e) => setRepeatPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">Dirección de entrega</h3>

              <div className="field-grid">
                <div className="field-group">
                  <label className="field-label" htmlFor="addressStreet">
                    Calle
                  </label>

                  <div className="input-wrap">
                    <MapPin className="input-icon" />
                    <input
                      id="addressStreet"
                      className="field-input"
                      type="text"
                      autoComplete="address-line1"
                      placeholder="Av. Siempre Viva"
                      value={addressStreet}
                      disabled={saving || loading}
                      onChange={(e) => setAddressStreet(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="addressNumber">
                    Número
                  </label>

                  <div className="input-wrap">
                    <Home className="input-icon" />
                    <input
                      id="addressNumber"
                      className="field-input"
                      type="text"
                      autoComplete="address-line2"
                      placeholder="123"
                      value={addressNumber}
                      disabled={saving || loading}
                      onChange={(e) => setAddressNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="addressCity">
                    Ciudad
                  </label>

                  <div className="input-wrap">
                    <MapPin className="input-icon" />
                    <input
                      id="addressCity"
                      className="field-input"
                      type="text"
                      autoComplete="address-level2"
                      placeholder="Córdoba"
                      value={addressCity}
                      disabled={saving || loading}
                      onChange={(e) => setAddressCity(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="addressProvince">
                    Provincia
                  </label>

                  <div className="input-wrap">
                    <MapPin className="input-icon" />
                    <input
                      id="addressProvince"
                      className="field-input"
                      type="text"
                      autoComplete="address-level1"
                      placeholder="Córdoba"
                      value={addressProvince}
                      disabled={saving || loading}
                      onChange={(e) => setAddressProvince(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="addressFloor">
                    Piso
                  </label>

                  <div className="input-wrap">
                    <Home className="input-icon" />
                    <input
                      id="addressFloor"
                      className="field-input"
                      type="text"
                      placeholder="Opcional"
                      value={addressFloor}
                      disabled={saving || loading}
                      onChange={(e) => setAddressFloor(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="addressApartment">
                    Departamento
                  </label>

                  <div className="input-wrap">
                    <Home className="input-icon" />
                    <input
                      id="addressApartment"
                      className="field-input"
                      type="text"
                      placeholder="Opcional"
                      value={addressApartment}
                      disabled={saving || loading}
                      onChange={(e) => setAddressApartment(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field-group full">
                  <label className="field-label" htmlFor="addressPostalCode">
                    Código postal
                  </label>

                  <div className="input-wrap">
                    <MapPin className="input-icon" />
                    <input
                      id="addressPostalCode"
                      className="field-input"
                      type="text"
                      autoComplete="postal-code"
                      placeholder="5000"
                      value={addressPostalCode}
                      disabled={saving || loading}
                      onChange={(e) => setAddressPostalCode(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field-group full">
                  <label className="field-label" htmlFor="addressNotes">
                    Notas de dirección
                  </label>

                  <div className="input-wrap">
                    <MapPin className="input-icon textarea-icon" />
                    <textarea
                      id="addressNotes"
                      className="field-textarea"
                      placeholder="Referencia, barrio, entre calles, horario de entrega, etc."
                      value={addressNotes}
                      disabled={saving || loading}
                      onChange={(e) => setAddressNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || loading || !canSubmit}
              className="btn-submit"
            >
              {saving ? (
                "Creando cuenta..."
              ) : (
                <>
                  <User size={18} />
                  Crear cuenta
                </>
              )}
            </button>
          </form>

          <div className="divider" />

          <p className="auth-footer">
            ¿Ya tenés cuenta? Iniciá sesión para continuar tu pedido.
          </p>

          <Link className="login-link" href="/tienda/login">
            <LogIn size={18} />
            Iniciar sesión
          </Link>

          <Link className="back-to-shop" href="/tienda">
            <ArrowLeft size={15} />
            Volver a la tienda
          </Link>
        </section>
      </main>
    </>
  );
}