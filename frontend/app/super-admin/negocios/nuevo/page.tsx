'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyForm = {
  name: '',
  subdomain: '',
  cuit: '',
  rubro: '',
  plan: 'BASICO',
};

export default function NuevoNegocioPage() {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.subdomain.trim()) {
      toast.error('Nombre y subdominio son obligatorios.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/super-admin/businesses', {
        name: form.name.trim(),
        subdomain: form.subdomain.trim().toLowerCase(),
        cuit: form.cuit.trim() || undefined,
        rubro: form.rubro.trim() || undefined,
        plan: form.plan,
      });
      toast.success('Negocio creado correctamente.');
      router.push('/super-admin/negocios');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'No se pudo crear el negocio.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sa-page">
      <Link href="/super-admin/negocios" className="sa-back">
        <ArrowLeft size={16} />
        Volver a negocios
      </Link>

      <div className="sa-form-card">
        <h1>Nuevo negocio</h1>
        <p>Creá un negocio cliente nuevo para la plataforma ComarPOS.</p>

        <form onSubmit={handleSubmit} className="sa-form">
          <div className="form-group">
            <label className="form-label">Nombre del negocio</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ej: Distribuidora Sur"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Subdominio</label>
            <input
              type="text"
              value={form.subdomain}
              onChange={(e) =>
                setForm((p) => ({ ...p, subdomain: e.target.value.toLowerCase() }))
              }
              placeholder="Ej: distribuidorasur"
              required
            />
            <small>Se va a usar como subdominio.comarpos.com.ar</small>
          </div>

          <div className="form-group">
            <label className="form-label">CUIT</label>
            <input
              type="text"
              value={form.cuit}
              onChange={(e) => setForm((p) => ({ ...p, cuit: e.target.value }))}
              placeholder="20-12345678-9"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Rubro</label>
            <input
              type="text"
              value={form.rubro}
              onChange={(e) => setForm((p) => ({ ...p, rubro: e.target.value }))}
              placeholder="Ej: Distribuidora de bebidas"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Plan</label>
            <select value={form.plan} onChange={(e) => setForm((p) => ({ ...p, plan: e.target.value }))}>
              <option value="BASICO">Básico</option>
              <option value="PRO">Pro</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
          </div>

          <div className="sa-form-actions">
            <button type="submit" className="sa-btn-primary" disabled={saving}>
              {saving ? 'Creando...' : 'Crear negocio'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .sa-page {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 560px;
        }

        .sa-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--text2);
          font-size: 14px;
          text-decoration: none;
        }

        .sa-back:hover {
          color: var(--text);
        }

        .sa-form-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
        }

        .sa-form-card h1 {
          font-size: 20px;
          font-weight: 700;
          color: var(--text);
          margin: 0;
        }

        .sa-form-card p {
          margin: 4px 0 20px;
          color: var(--text3);
          font-size: 14px;
        }

        .sa-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-group small {
          display: block;
          margin-top: 4px;
          color: var(--text3);
          font-size: 12px;
        }

        .sa-form-actions {
          display: flex;
          justify-content: flex-end;
        }

        .sa-btn-primary {
          padding: 10px 18px;
          border-radius: 8px;
          border: none;
          background: var(--accent);
          color: #fff;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
        }

        .sa-btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
