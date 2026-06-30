'use client';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';

interface ToastProps {
  toasts: { id: string; message: string; type: 'success' | 'error' | 'warn' }[];
}

export default function Toasts({ toasts }: ToastProps) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' && <CheckCircle size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
          {t.type === 'error' && <XCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
          {t.type === 'warn' && <AlertTriangle size={16} style={{ color: 'var(--warn)', flexShrink: 0 }} />}
          <span style={{ fontSize: 13, color: 'var(--text)' }}>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
