"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lock, Mail, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { useShopAuth } from "@/context/ShopAuthContext";

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

export default function TiendaLoginPage() {
  const router = useRouter();
  const { login, isLoggedIn, loading } = useShopAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [resetEmail, setResetEmail] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (showForgotPassword) return;

    if (isLoggedIn) {
      router.replace("/tienda/cuenta");
    }
  }, [loading, isLoggedIn, showForgotPassword, router]);

  function validateForm() {
    if (!email.trim()) {
      toast.error("Ingresá tu correo electrónico");
      return false;
    }

    if (!password.trim()) {
      toast.error("Ingresá tu contraseña");
      return false;
    }

    return true;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    if (!validateForm()) return;

    setSaving(true);
    setError("");

    const toastId = toast.loading("Iniciando sesión...");

    try {
      await login({
        email: email.trim(),
        password,
      });

      toast.success("Sesión iniciada correctamente", { id: toastId });

      router.replace("/tienda/cuenta");
      router.refresh();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "No se pudo iniciar sesión");

      setError(message);
      toast.error(message, { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  async function onForgotPasswordSubmit(e: FormEvent) {
    e.preventDefault();

    const emailToSend = resetEmail.trim() || email.trim();

    if (!emailToSend) {
      toast.error("Ingresá tu correo electrónico");
      return;
    }

    setResetSaving(true);
    setError("");
    setResetSent(false);

    const toastId = toast.loading("Enviando enlace...");

    try {
      const response = await fetch(`${API_URL}/clients/tienda/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: emailToSend,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message || data?.error || "No se pudo enviar el enlace"
        );
      }

      setResetEmail(emailToSend);
      setResetSent(true);

      toast.success(
        data?.message ||
          "Si el email está registrado, te enviamos un enlace para restablecer la contraseña",
        { id: toastId }
      );
    } catch (err: unknown) {
      const message = getErrorMessage(
        err,
        "No se pudo enviar el enlace de recuperación"
      );

      setError(message);
      toast.error(message, { id: toastId });
    } finally {
      setResetSaving(false);
    }
  }

  function openForgotPassword() {
    setError("");
    setResetSent(false);
    setResetEmail(email.trim());
    setShowForgotPassword(true);
  }

  function backToLogin() {
    setError("");
    setResetSent(false);
    setShowForgotPassword(false);
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
          --blue-hover: #1d4ed8;
          --red: #dc2626;
          --red-soft: #fef2f2;
          --green: #16a34a;
          --green-soft: #f0fdf4;
          --shadow: 0 24px 70px rgba(15, 23, 42, 0.10);
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
        }

        button,
        input {
          font-family: inherit;
        }

        .login-page {
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

        .login-card {
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

        .forgot-row {
          display: flex;
          justify-content: flex-end;
          margin-top: -4px;
          margin-bottom: 14px;
        }

        .forgot-button {
          border: none;
          background: transparent;
          color: var(--blue);
          font-size: 12px;
          font-weight: 850;
          cursor: pointer;
          padding: 0;
          transition: 0.18s ease;
        }

        .forgot-button:hover {
          color: var(--blue-hover);
          text-decoration: underline;
        }

        .forgot-help {
          margin: -10px 0 20px;
          background: var(--green-soft);
          color: #166534;
          border: 1px solid rgba(22, 163, 74, 0.16);
          border-radius: 16px;
          padding: 13px 14px;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 750;
        }

        .secondary-button {
          width: 100%;
          height: 46px;
          border-radius: 15px;
          border: 1px solid var(--line);
          background: var(--white);
          color: var(--text);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          margin-top: 12px;
          transition: 0.18s ease;
        }

        .secondary-button:hover {
          background: #f9fafb;
          border-color: var(--line-strong);
        }

        .secondary-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
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

        .create-account {
          margin-top: 14px;
          width: 100%;
          min-height: 48px;
          border-radius: 16px;
          background: var(--blue);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          text-decoration: none;
          font-size: 14px;
          font-weight: 950;
          transition: 0.18s ease;
          box-shadow: 0 14px 30px rgba(37, 99, 235, 0.22);
        }

        .create-account:hover {
          background: var(--blue-hover);
          transform: translateY(-1px);
        }

        .register-help {
          margin: 10px 0 0;
          color: var(--muted);
          text-align: center;
          font-size: 12px;
          font-weight: 650;
          line-height: 1.45;
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

        @media (max-width: 480px) {
          .login-page {
            padding: 18px;
          }

          .login-card {
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

          .create-account {
            min-height: 50px;
            font-size: 13px;
          }
        }
      `}</style>

      <main className="login-page">
        <section className="login-card">
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

          {!showForgotPassword ? (
            <>
              <h2 className="form-title">Iniciar sesión</h2>

              <p className="form-sub">
                Ingresá con tu cuenta para ver tus precios y continuar tu pedido.
              </p>

              {error && <div className="error-box">⚠ {error}</div>}

              <form onSubmit={onSubmit}>
                <div className="field-group">
                  <label className="field-label" htmlFor="email">
                    Correo electrónico
                  </label>

                  <div className="input-wrap">
                    <Mail className="input-icon" />
                    <input
                      id="email"
                      className="field-input"
                      type="email"
                      autoComplete="email"
                      placeholder="cliente@empresa.com"
                      value={email}
                      disabled={saving || loading}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

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
                      autoComplete="current-password"
                      placeholder="Ingresá tu contraseña"
                      value={password}
                      disabled={saving || loading}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="forgot-row">
                  <button
                    type="button"
                    className="forgot-button"
                    onClick={openForgotPassword}
                    disabled={saving || loading}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={saving || loading}
                  className="btn-submit"
                >
                  {saving ? "Ingresando..." : "Ingresar"}
                </button>
              </form>

              <div className="divider" />

              <p className="auth-footer">
                ¿No tenés cuenta? Creala ahora sin ayuda de nadie y empezá a
                comprar.
              </p>

              <Link className="create-account" href="/tienda/register">
                <UserPlus size={18} />
                Crear mi cuenta
              </Link>

              <p className="register-help">
                Tu cuenta se crea como cliente minorista. Si necesitás cuenta
                mayorista, el negocio puede activarla después.
              </p>
            </>
          ) : (
            <>
              <h2 className="form-title">Recuperar contraseña</h2>

              <p className="form-sub">
                Ingresá tu correo y te vamos a enviar un enlace para crear una
                nueva contraseña.
              </p>

              {error && <div className="error-box">⚠ {error}</div>}

              {resetSent && (
                <div className="success-box">
                  Listo. Si el correo existe, te enviamos un enlace de
                  recuperación. Revisá también spam o correo no deseado.
                </div>
              )}

              {!resetSent && (
                <div className="forgot-help">
                  Revisá también la carpeta de spam o correo no deseado.
                </div>
              )}

              <form onSubmit={onForgotPasswordSubmit}>
                <div className="field-group">
                  <label className="field-label" htmlFor="resetEmail">
                    Correo electrónico
                  </label>

                  <div className="input-wrap">
                    <Mail className="input-icon" />
                    <input
                      id="resetEmail"
                      className="field-input"
                      type="email"
                      autoComplete="email"
                      placeholder="cliente@empresa.com"
                      value={resetEmail}
                      disabled={resetSaving}
                      onChange={(e) => setResetEmail(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={resetSaving}
                  className="btn-submit"
                >
                  {resetSaving ? "Enviando..." : "Enviar enlace"}
                </button>

                <button
                  type="button"
                  disabled={resetSaving}
                  className="secondary-button"
                  onClick={backToLogin}
                >
                  Volver al inicio de sesión
                </button>
              </form>
            </>
          )}

          <Link className="back-to-shop" href="/tienda">
            <ArrowLeft size={15} />
            Volver a la tienda
          </Link>
        </section>
      </main>
    </>
  );
}