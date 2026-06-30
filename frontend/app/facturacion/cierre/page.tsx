'use client';
import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import { Printer } from 'lucide-react';
import { firstDayOfCurrentMonthAR, todayInputAR } from '@/lib/dateAR';

export default function CierreCajaPage() {
  const [mode, setMode] = useState<'day' | 'range'>('day');
  const [date, setDate] = useState(todayInputAR());
  const [from, setFrom] = useState(firstDayOfCurrentMonthAR);
  const [to, setTo] = useState(todayInputAR());
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePrint = async () => {
    setLoading(true);
    try {
      const body = mode === 'day' ? { date } : { from, to };
      await api.post('/cash-close/print', body);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch { alert('Error al generar cierre de caja'); }
    finally { setLoading(false); }
  };

  return (
    <AppLayout title="Cierre de Caja" subtitle="Genera e imprime resumen de caja">
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="card" style={{ padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Printer size={20} style={{ color: '#34d399' }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Cierre de caja</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>Genera PDF 58mm para impresora térmica</div>
            </div>
          </div>

          {/* Mode selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: 'var(--surface2)', borderRadius: 10, padding: 4 }}>
            {(['day', 'range'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                  background: mode === m ? 'var(--surface)' : 'none',
                  color: mode === m ? 'var(--text)' : 'var(--text2)',
                  fontWeight: 600, fontSize: 13,
                  boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {m === 'day' ? '📅 Día específico' : '📆 Rango de fechas'}
              </button>
            ))}
          </div>

          {mode === 'day' ? (
            <div className="form-group">
              <label className="form-label">Fecha de cierre</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          ) : (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Desde</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Hasta</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} />
              </div>
            </div>
          )}

          {success ? (
            <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 10, padding: 16, textAlign: 'center', color: '#34d399', fontWeight: 700, fontSize: 14 }}>
              ✅ Cierre de caja enviado a la impresora
            </div>
          ) : (
            <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} onClick={handlePrint} disabled={loading}>
              {loading ? <span className="spinner" /> : <><Printer size={16} /> Imprimir cierre de caja</>}
            </button>
          )}

          <div style={{ marginTop: 20, background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)', lineHeight: 1.8 }}>
            <div style={{ color: 'var(--text3)', marginBottom: 6, fontWeight: 600 }}>NOTAS</div>
            <div>• El PDF se envía automáticamente a la impresora térmica vía POS_LOCAL_URL</div>
            <div>• Formato 58mm compatible con impresoras Epson TM-T20</div>
            <div>• Incluye totales por método de pago, cantidad de ventas y resumen</div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
