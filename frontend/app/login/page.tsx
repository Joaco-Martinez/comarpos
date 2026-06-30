'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuthStore();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Ingresá tu email');
      return;
    }

    if (!password.trim()) {
      toast.error('Ingresá tu contraseña');
      return;
    }

    setLoading(true);

    const toastId = toast.loading('Iniciando sesión...');

    try {
      await login(email.trim(), password);

      toast.success('Sesión iniciada correctamente', { id: toastId });
      router.replace('/pos');
    } catch (error) {
      console.error(error);

      toast.error('Email o contraseña incorrectos', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(15,159,92,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '10%',
          width: 400,
          height: 400,
          background: 'radial-gradient(circle, rgba(79,142,255,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Grid lines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          opacity: 0.3,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: 400,
          position: 'relative',
          animation: 'fadeIn 0.4s ease',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 12,
            }}
          >
            <svg width="52" height="44" viewBox="0 0 100 85" fill="none">
              <polygon points="0,0 40,75 80,0 65,0 40,52 15,0" fill="#111827" />
              <polygon points="50,0 80,0 80,45 65,45 65,18" fill="#111827" />
            </svg>

            <div style={{ textAlign: 'left' }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  color: 'var(--text)',
                  lineHeight: 1,
                  letterSpacing: -1,
                }}
              >
                ComarPOS
              </div>

              <div
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  color: 'var(--accent)',
                  letterSpacing: 3,
                }}
              >
                SISTEMA ERP
              </div>
            </div>
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 32,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>
            Iniciar sesión
          </h2>

          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 28 }}>
            Ingresá tus credenciales para continuar
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@comarpos.com"
                required
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>

              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  style={{ paddingRight: 44 }}
                />

                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  disabled={loading}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text3)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    padding: 0,
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 4 }}
              disabled={loading}
            >
              {loading ? (
                <span className="spinner" style={{ width: 16, height: 16 }} />
              ) : (
                'Ingresar'
              )}
            </button>
          </form>
        </div>

        <p
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text3)',
            marginTop: 20,
            fontFamily: 'var(--mono)',
          }}
        >
          © 2026 ComarPOS
        </p>
      </div>
    </div>
  );
}