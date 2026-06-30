'use client';
import { useState, useCallback } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warn';
}

let toastFn: ((msg: string, type?: Toast['type']) => void) | null = null;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);

  toastFn = toast;
  return { toasts, toast };
}

export function showToast(message: string, type: Toast['type'] = 'success') {
  toastFn?.(message, type);
}
