"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = useMemo(() => {
    return searchParams.get("token") || "";
  }, [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  function validateForm() {
    if (!token) {
      toast.error("El enlace no es válido o está incompleto");
      return false;
    }

    if (!password.trim()) {
      toast.error("Ingresá una nueva contraseña");
      return false;
    }

    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return false;
    }

    if (password !== confirmPassword) {
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

    const toastId = toast.loading("Actualizando contraseña...");

    try {
      const response = await fetch(`${API_URL}/clients/tienda/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message || data?.error || "No se pudo actualizar la contraseña"
        );
      }

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");

      toast.success(
        data?.message || "Contraseña actualizada correctamente",
        { id: toastId }
      );

      setTimeout(() => {
        router.replace("/tienda/login");
      }, 1300);
    } catch (err: unknown) {
      const message = getErrorMessage(
        err,
        "No se pudo actualizar la contraseña"
      );

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
          --red: #dc2626;
          --red-soft: #fef2f2;
          --green: #16a34a;
          --green-soft: #f0fdf4;
          --shadow: 0 24px 70px rgba(15, 23, 42, 0.10);
        }

        * { box-sizing: border-box; }

        body { margin: 0; }

        button,
        input {
          font-family: inherit;
        }

        .reset-page {
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

        .reset-card {
          width: 100%;
          max-width: 420px;
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

        .field-group {
          margin-bottom: 16px;
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
        }

        .field-input {
          width: 100%;
          height: 50px;
          border: 1px solid var(--line);
          background: #f9fafb;
          color: var(--text);
          border-radius: 16px;
          padding: 0 15px 0 46px;
          outline: none;
          font-size: 14px;
          font-weight: 600;
          transition: 0.18s ease;
        }

        .field-input::placeholder {
          color: var(--soft);
        }

        .field-input:focus {
          background: var(--white);
          border-color: var(--primary);
          box-shadow: 0 0 0 4px rgba(17, 24, 39, 0.08);
        }

        .field-input:disabled {
          opacity: 0.7;
          cursor: not-allowed;
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

        .success-box {
          background: var(--green-soft);
          color: #166534;
          border: 1px solid rgba(22, 163, 74, 0.16);
          border-radius: 16px;
          padding: 14px;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 800;
          margin-bottom: 18px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .success-box svg {
          flex-shrink: 0;
          margin-top: 1px;
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

        .back-to-login {
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

        .back-to-login:hover {
          background: #f9fafb;
          border-color: var(--line-strong);
        }

        @media (max-width: 480px) {
          .reset-page {
            padding: 18px;
          }

          .reset-card {
            padding: 26px 22px;
            border-radius: 24px;
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
        }
      `}</style>

      <main className="reset-page">
        <section className="reset-card">
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

          <h2 className="form-title">Nueva contraseña</h2>

          <p className="form-sub">
            Creá una nueva contraseña para volver a ingresar a tu cuenta.
          </p>

          {!token && (
            <div className="error-box">
              ⚠ El enlace no es válido o está incompleto. Pedí un nuevo enlace
              desde el inicio de sesión.
            </div>
          )}

          {error && <div className="error-box">⚠ {error}</div>}

          {success && (
            <div className="success-box">
              <CheckCircle2 size={18} />
              <span>
                Contraseña actualizada correctamente. Te estamos llevando al
                inicio de sesión.
              </span>
            </div>
          )}

          <form onSubmit={onSubmit}>
            <div className="field-group">
              <label className="field-label" htmlFor="password">
                Nueva contraseña
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
                  disabled={saving || success || !token}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="confirmPassword">
                Repetir contraseña
              </label>

              <div className="input-wrap">
                <Lock className="input-icon" />
                <input
                  id="confirmPassword"
                  className="field-input"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repetí la contraseña"
                  value={confirmPassword}
                  disabled={saving || success || !token}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || success || !token}
              className="btn-submit"
            >
              {saving ? "Guardando..." : "Guardar contraseña"}
            </button>
          </form>

          <Link className="back-to-login" href="/tienda/login">
            <ArrowLeft size={15} />
            Volver al inicio de sesión
          </Link>
        </section>
      </main>
    </>
  );
}

export default function TiendaResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}