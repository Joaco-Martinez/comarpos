import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import type { ArcaConfig } from '@/types/arca';
import { formatDateTimeAR } from '@/lib/dateAR';

export function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

export function maskCuit(cuit?: string | null) {
  const digits = onlyDigits(cuit || '');
  if (digits.length !== 11) return cuit || '—';
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

export function formatDate(value?: string | null) {
  const formatted = formatDateTimeAR(value);
  return formatted === '—' ? 'Sin dato' : formatted;
}

export function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const err = error as any;
    return (
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message ||
      'Ocurrió un error'
    );
  }

  if (error instanceof Error) return error.message;
  return 'Ocurrió un error';
}

export function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function getStatusMeta(config?: ArcaConfig | null) {
  if (!config) {
    return {
      label: 'Sin configurar',
      title: 'Configuración pendiente',
      description: 'Todavía faltan cargar datos para dejar ARCA operativo.',
      tone: 'neutral' as const,
      icon: AlertCircle,
    };
  }

  if (config.status === 'ACTIVE' && config.isActive) {
    return {
      label: 'Activo',
      title: 'Listo para facturar',
      description: 'La configuración está activa y preparada para emitir comprobantes.',
      tone: 'success' as const,
      icon: CheckCircle2,
    };
  }

  if (config.status === 'ERROR') {
    return {
      label: 'Error',
      title: 'Revisar configuración',
      description: 'Hay un problema con la configuración, certificado o conexión.',
      tone: 'danger' as const,
      icon: XCircle,
    };
  }

  return {
    label: 'Incompleto',
    title: 'Faltan datos',
    description: 'Completá el checklist para activar correctamente ARCA.',
    tone: 'warning' as const,
    icon: AlertCircle,
  };
}
