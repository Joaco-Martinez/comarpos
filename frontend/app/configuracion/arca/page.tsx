'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Download,
  Edit2,
  FileKey2,
  FileText,
  HelpCircle,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import {
  arcaConfigApi,
  type ArcaConfig,
  type ArcaEnvironment,
  type ArcaPointOfSale,
  type RemitoCaiConfig,
  type RemitoMode,
} from '@/service/arcaConfig.service';
import { formatDateAR, formatDateTimeAR, toDateInputAR } from '@/lib/dateAR';

type Toast = {
  type: 'success' | 'error' | 'info';
  message: string;
};

const IVA_CONDITION_OPTIONS = [
  { label: 'IVA Responsable Inscripto', value: 'IVA RESPONSABLE INSCRIPTO' },
  { label: 'Responsable Monotributo', value: 'RESPONSABLE MONOTRIBUTO' },
  { label: 'Consumidor Final', value: 'CONSUMIDOR FINAL' },
  { label: 'IVA Sujeto Exento', value: 'IVA SUJETO EXENTO' },
  { label: 'IVA No Responsable', value: 'IVA NO RESPONSABLE' },
  { label: 'No Categorizado', value: 'NO CATEGORIZADO' },
];

const CURRENCY_OPTIONS = [
  { label: 'Pesos argentinos (PES)', value: 'PES' },
  { label: 'Dólar estadounidense (DOL)', value: 'DOL' },
];

const CONCEPT_OPTIONS = [
  { label: 'Productos', value: '1' },
  { label: 'Servicios', value: '2' },
  { label: 'Productos y servicios', value: '3' },
];

const ENVIRONMENT_OPTIONS: { label: string; value: ArcaEnvironment }[] = [
  { label: 'Homologación / pruebas', value: 'HOMOLOGACION' },
  { label: 'Producción / real', value: 'PRODUCCION' },
];

const REMITO_MODE_OPTIONS: { label: string; value: RemitoMode }[] = [
  { label: 'Digital completo', value: 'DIGITAL_FULL' },
  { label: 'Formulario preimpreso', value: 'PREPRINTED_FORM' },
];

const emptyFiscalForm = {
  businessName: '',
  cuit: '',
  ivaCondition: 'IVA RESPONSABLE INSCRIPTO',
  fiscalAddress: '',
  iibb: '',
  activityStart: '',
  environment: 'HOMOLOGACION' as ArcaEnvironment,
  defaultPointOfSale: '1',
  defaultCurrencyId: 'PES',
  defaultConcept: '1',
};

const emptyPointForm = {
  id: '',
  number: '',
  description: '',
  enabled: true,
  isDefault: true,
  enabledCbteTypes: '1,6,11,3,8,13',
};

const emptyRemitoCaiForm = {
  id: '',
  mode: 'DIGITAL_FULL' as RemitoMode,
  pointOfSale: '1',
  cai: '',
  expiresAt: '',
  rangeFrom: '1',
  rangeTo: '99999999',
  nextNumber: '1',
  enabled: true,
};

const INITIAL_NOW_TS = new Date().getTime();

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: { data?: { message?: string; error?: string } };
    message?: string;
  };

  return err.response?.data?.message || err.response?.data?.error || err.message || fallback;
}

function formatDate(value?: string | null) {
  return formatDateAR(value);
}

function formatDateTime(value?: string | null) {
  return formatDateTimeAR(value);
}

function toDateInput(value?: string | null) {
  return toDateInputAR(value);
}

function normalizeCuit(value: string) {
  return value.replace(/\D/g, '');
}

function parseCbteTypes(value: string) {
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}


function useIsMobile(maxWidth = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= maxWidth);

    check();
    window.addEventListener('resize', check);

    return () => window.removeEventListener('resize', check);
  }, [maxWidth]);

  return isMobile;
}

function HelpLabel({ label, help }: { label: string; help?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 900, color: 'var(--text2)' }}>
        {label}
      </label>

      {help && (
        <span
          title={help}
          aria-label={help}
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            border: '1px solid var(--border)',
            background: 'var(--surface2)',
            color: 'var(--text3)',
            display: 'inline-grid',
            placeItems: 'center',
            cursor: 'help',
            flexShrink: 0,
          }}
        >
          <HelpCircle size={12} />
        </span>
      )}
    </div>
  );
}

function StatusBadge({
  children,
  tone = 'gray',
}: {
  children: React.ReactNode;
  tone?: 'green' | 'red' | 'yellow' | 'blue' | 'gray';
}) {
  const styles = {
    green: {
      background: 'rgba(34,197,94,0.12)',
      border: '1px solid rgba(34,197,94,0.28)',
      color: '#16a34a',
    },
    red: {
      background: 'rgba(239,68,68,0.12)',
      border: '1px solid rgba(239,68,68,0.28)',
      color: '#dc2626',
    },
    yellow: {
      background: 'rgba(245,158,11,0.12)',
      border: '1px solid rgba(245,158,11,0.28)',
      color: '#d97706',
    },
    blue: {
      background: 'rgba(59,130,246,0.12)',
      border: '1px solid rgba(59,130,246,0.28)',
      color: '#2563eb',
    },
    gray: {
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      color: 'var(--text2)',
    },
  }[tone];

  return (
    <span
      style={{
        ...styles,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        padding: '6px 10px',
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function Card({
  title,
  subtitle,
  icon,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  return (
    <section
      className="card"
      style={{
        padding: isMobile ? 16 : 22,
        border: '1px solid var(--border)',
        borderRadius: 18,
        background: 'var(--surface)',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: isMobile ? 12 : 16,
          marginBottom: 20,
          alignItems: isMobile ? 'stretch' : 'flex-start',
          flexDirection: isMobile ? 'column' : 'row',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
          {icon && (
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              {icon}
            </div>
          )}

          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 950, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{title}</h2>
            {subtitle && (
              <p style={{ marginTop: 4, color: 'var(--text2)', fontSize: 13, lineHeight: 1.45 }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {right && <div style={{ alignSelf: isMobile ? 'flex-start' : undefined }}>{right}</div>}
      </div>

      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  help?: string;
}) {
  return (
    <div style={{ display: 'grid', gap: 7 }}>
      <HelpLabel label={label} help={help} />

      <input
        value={value}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: '100%',
          minHeight: 42,
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: disabled ? 'var(--surface2)' : 'var(--surface)',
          color: 'var(--text)',
          padding: '0 12px',
          outline: 'none',
        }}
      />

      {help && <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.4 }}>{help}</p>}
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  help,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
  help?: string;
}) {
  return (
    <div style={{ display: 'grid', gap: 7 }}>
      <HelpLabel label={label} help={help} />

      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        style={{
          width: '100%',
          minHeight: 42,
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
          padding: '0 12px',
          outline: 'none',
        }}
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      {help && <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.4 }}>{help}</p>}
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  help?: string;
}) {
  return (
    <div style={{ display: 'grid', gap: 7 }}>
      <HelpLabel label={label} help={help} />

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          fontSize: 13,
          fontWeight: 800,
          color: 'var(--text2)',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        {checked ? 'Sí' : 'No'}
      </label>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  loading,
  disabled,
  icon,
  danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  danger?: boolean;
}) {
  const isMobile = useIsMobile();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        minHeight: 40,
        borderRadius: 12,
        border: danger ? '1px solid rgba(239,68,68,0.35)' : '1px solid var(--border)',
        background: danger ? 'rgba(239,68,68,0.12)' : 'var(--primary, #111827)',
        color: danger ? '#dc2626' : '#fff',
        padding: '0 14px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontWeight: 900,
        fontSize: 13,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.65 : 1,
        width: isMobile ? '100%' : undefined,
        minWidth: 0,
      }}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  loading,
  disabled,
  icon,
  danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  danger?: boolean;
}) {
  const isMobile = useIsMobile();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        minHeight: 40,
        borderRadius: 12,
        border: danger ? '1px solid rgba(239,68,68,0.35)' : '1px solid var(--border)',
        background: danger ? 'rgba(239,68,68,0.08)' : 'var(--surface2)',
        color: danger ? '#dc2626' : 'var(--text)',
        padding: '0 14px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontWeight: 900,
        fontSize: 13,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.65 : 1,
        width: isMobile ? '100%' : undefined,
        minWidth: 0,
      }}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

export default function ArcaConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingFiscal, setSavingFiscal] = useState(false);

  const [config, setConfig] = useState<ArcaConfig | null>(null);
  const [points, setPoints] = useState<ArcaPointOfSale[]>([]);
  const [remitoCais, setRemitoCais] = useState<RemitoCaiConfig[]>([]);

  const [fiscalForm, setFiscalForm] = useState(emptyFiscalForm);
  const [pointForm, setPointForm] = useState(emptyPointForm);
  const [remitoCaiForm, setRemitoCaiForm] = useState(emptyRemitoCaiForm);

  const [certFile, setCertFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [certExpiresAt, setCertExpiresAt] = useState('');

  const [toast, setToast] = useState<Toast | null>(null);

  const isMobile = useIsMobile();

  const status = useMemo(() => {
    if (!config) return { text: 'Sin configurar', tone: 'gray' as const };

    if (config.status === 'ACTIVE') {
      return config.environment === 'PRODUCCION'
        ? { text: 'Producción activa', tone: 'green' as const }
        : { text: 'Homologación activa', tone: 'blue' as const };
    }

    if (config.status === 'ERROR') return { text: 'Error', tone: 'red' as const };
    if (config.status === 'CERT_EXPIRED') {
      return { text: 'Certificado vencido', tone: 'red' as const };
    }

    return { text: 'Incompleta', tone: 'yellow' as const };
  }, [config]);

  const activeRemitoCai = useMemo(() => {
    return remitoCais.find(
      (item) => item.enabled && new Date(item.expiresAt).getTime() >= INITIAL_NOW_TS
    );
  }, [remitoCais]);

  function showToast(type: Toast['type'], message: string) {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3500);
  }

  function fillForms(nextConfig: ArcaConfig | null) {
    if (!nextConfig) return;

    setFiscalForm({
      businessName: nextConfig.businessName || '',
      cuit: nextConfig.cuit || '',
      ivaCondition: nextConfig.ivaCondition || 'IVA RESPONSABLE INSCRIPTO',
      fiscalAddress: nextConfig.fiscalAddress || '',
      iibb: nextConfig.iibb || '',
      activityStart: toDateInput(nextConfig.activityStart),
      environment: nextConfig.environment || 'HOMOLOGACION',
      defaultPointOfSale: String(nextConfig.defaultPointOfSale || 1),
      defaultCurrencyId: nextConfig.defaultCurrencyId || 'PES',
      defaultConcept: String(nextConfig.defaultConcept || 1),
    });
  }

  async function loadAll() {
    setLoading(true);

    try {
      const [nextConfig, nextPoints, nextRemitoCais] = await Promise.all([
        arcaConfigApi.get(),
        arcaConfigApi.listPointsOfSale().catch(() => []),
        arcaConfigApi.listRemitoCais().catch(() => []),
      ]);

      setConfig(nextConfig);
      setPoints(nextPoints);
      setRemitoCais(nextRemitoCais);
      fillForms(nextConfig);
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Error al cargar configuración ARCA'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAll();
    }, 0);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveFiscal() {
    if (savingFiscal) return;

    const cleanCuit = normalizeCuit(fiscalForm.cuit);

    if (!fiscalForm.businessName.trim()) {
      showToast('error', 'La razón social es obligatoria.');
      return;
    }

    if (!cleanCuit || cleanCuit.length !== 11) {
      showToast('error', 'El CUIT debe tener 11 dígitos, sin guiones.');
      return;
    }

    if (!fiscalForm.ivaCondition) {
      showToast('error', 'Seleccioná la condición IVA.');
      return;
    }

    if (!fiscalForm.environment) {
      showToast('error', 'Seleccioná el ambiente de ARCA.');
      return;
    }

    if (!fiscalForm.defaultPointOfSale || Number(fiscalForm.defaultPointOfSale) <= 0) {
      showToast('error', 'El punto de venta principal debe ser mayor a 0.');
      return;
    }

    setSavingFiscal(true);

    try {
      const payload = {
        businessName: fiscalForm.businessName.trim(),
        cuit: cleanCuit,
        ivaCondition: fiscalForm.ivaCondition,
        fiscalAddress: fiscalForm.fiscalAddress || null,
        iibb: fiscalForm.iibb || null,
        activityStart: fiscalForm.activityStart || null,
        environment: fiscalForm.environment,
        defaultPointOfSale: fiscalForm.defaultPointOfSale,
        defaultCurrencyId: fiscalForm.defaultCurrencyId,
        defaultConcept: fiscalForm.defaultConcept,
      };

      console.log('Guardando configuración ARCA...', payload);

      const saved = await arcaConfigApi.upsert(payload);

      setConfig(saved);
      fillForms(saved);

      const nextPoints = await arcaConfigApi.listPointsOfSale().catch(() => []);
      setPoints(nextPoints);

      showToast('success', 'Configuración fiscal guardada correctamente.');
    } catch (error) {
      console.error('Error guardando configuración fiscal:', error);
      showToast('error', getErrorMessage(error, 'Error al guardar configuración fiscal.'));
    } finally {
      setSavingFiscal(false);
    }
  }

  async function handleGenerateCsr() {
    setSaving(true);

    try {
      const saved = await arcaConfigApi.generateCsr({
        businessName: fiscalForm.businessName,
        cuit: normalizeCuit(fiscalForm.cuit),
        ivaCondition: fiscalForm.ivaCondition,
        fiscalAddress: fiscalForm.fiscalAddress,
        iibb: fiscalForm.iibb,
        activityStart: fiscalForm.activityStart || null,
        environment: fiscalForm.environment,
        defaultPointOfSale: fiscalForm.defaultPointOfSale,
        defaultCurrencyId: fiscalForm.defaultCurrencyId,
        defaultConcept: fiscalForm.defaultConcept,
        certAlias: 'COMARPOS',
      });

      setConfig(saved);
      showToast('success', 'CSR generado correctamente. Ahora descargalo y subilo en ARCA.');
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Error al generar CSR'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadCsr() {
    try {
      await arcaConfigApi.downloadCsr(config?.id);
      showToast('success', 'CSR descargado correctamente');
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Error al descargar CSR'));
    }
  }

  async function handleUploadCertificate() {
    if (!certFile) {
      showToast('error', 'Seleccioná el certificado .crt que te devuelve ARCA');
      return;
    }

    setSaving(true);

    try {
      const saved = keyFile
        ? await arcaConfigApi.uploadCertificates({
            certFile,
            keyFile,
            certExpiresAt: certExpiresAt || undefined,
          })
        : await arcaConfigApi.uploadCertificate(certFile, certExpiresAt || undefined);

      setConfig(saved);
      setCertFile(null);
      setKeyFile(null);
      setCertExpiresAt('');

      showToast('success', 'Certificado cargado correctamente');
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Error al cargar certificado'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCertificates() {
    const ok = window.confirm('¿Seguro querés eliminar los certificados cargados?');
    if (!ok) return;

    setSaving(true);

    try {
      const saved = await arcaConfigApi.deleteCertificates();
      setConfig(saved);
      showToast('success', 'Certificados eliminados');
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Error al eliminar certificados'));
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate() {
    setSaving(true);

    try {
      const saved = await arcaConfigApi.activate(config?.id);
      setConfig(saved);
      showToast('success', 'Configuración ARCA activada correctamente');
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Error al activar ARCA'));
    } finally {
      setSaving(false);
    }
  }

  async function handleTestWsaa() {
    setSaving(true);

    try {
      await arcaConfigApi.testWsaa();
      await loadAll();
      showToast('success', 'WSAA correcto. Token generado correctamente.');
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Error probando WSAA'));
    } finally {
      setSaving(false);
    }
  }

  async function handleTestWsfeDummy() {
    setSaving(true);

    try {
      await arcaConfigApi.testWsfeDummy();
      await loadAll();
      showToast('success', 'Prueba WSFE correcta');
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Error probando WSFE'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePointOfSale() {
    setSaving(true);

    try {
      if (!pointForm.number || Number(pointForm.number) <= 0) {
        showToast('error', 'El número de punto de venta debe ser mayor a 0.');
        return;
      }

      await arcaConfigApi.upsertPointOfSale({
        id: pointForm.id || undefined,
        number: pointForm.number,
        description: pointForm.description,
        enabled: pointForm.enabled,
        isDefault: pointForm.isDefault,
        enabledCbteTypes: parseCbteTypes(pointForm.enabledCbteTypes),
      });

      setPointForm(emptyPointForm);
      setPoints(await arcaConfigApi.listPointsOfSale());
      setConfig(await arcaConfigApi.get());

      showToast('success', 'Punto de venta guardado');
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Error al guardar punto de venta'));
    } finally {
      setSaving(false);
    }
  }

  function editPoint(point: ArcaPointOfSale) {
    setPointForm({
      id: point.id,
      number: String(point.number),
      description: point.description || '',
      enabled: point.enabled,
      isDefault: point.isDefault,
      enabledCbteTypes: point.enabledCbteTypes?.length
        ? point.enabledCbteTypes.join(',')
        : '1,6,11,3,8,13',
    });
  }

  async function deletePoint(id: string) {
    const ok = window.confirm('¿Seguro querés eliminar este punto de venta?');
    if (!ok) return;

    setSaving(true);

    try {
      await arcaConfigApi.deletePointOfSale(id);
      setPoints(await arcaConfigApi.listPointsOfSale());
      showToast('success', 'Punto de venta eliminado');
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Error al eliminar punto de venta'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRemitoCai() {
    setSaving(true);

    try {
      if (!remitoCaiForm.pointOfSale || Number(remitoCaiForm.pointOfSale) <= 0) {
        showToast('error', 'El punto de venta del remito debe ser mayor a 0.');
        return;
      }

      if (!remitoCaiForm.cai.trim()) {
        showToast('error', 'El CAI es obligatorio.');
        return;
      }

      if (!remitoCaiForm.expiresAt) {
        showToast('error', 'El vencimiento del CAI es obligatorio.');
        return;
      }

      await arcaConfigApi.upsertRemitoCai({
        id: remitoCaiForm.id || undefined,
        mode: remitoCaiForm.mode,
        pointOfSale: remitoCaiForm.pointOfSale,
        cai: remitoCaiForm.cai,
        expiresAt: remitoCaiForm.expiresAt,
        rangeFrom: remitoCaiForm.rangeFrom,
        rangeTo: remitoCaiForm.rangeTo,
        nextNumber: remitoCaiForm.nextNumber,
        enabled: remitoCaiForm.enabled,
      });

      setRemitoCaiForm(emptyRemitoCaiForm);
      setRemitoCais(await arcaConfigApi.listRemitoCais());

      showToast('success', 'CAI de remitos guardado');
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Error al guardar CAI de remito'));
    } finally {
      setSaving(false);
    }
  }

  function editRemitoCai(item: RemitoCaiConfig) {
    setRemitoCaiForm({
      id: item.id,
      mode: item.mode,
      pointOfSale: String(item.pointOfSale),
      cai: item.cai,
      expiresAt: toDateInput(item.expiresAt),
      rangeFrom: String(item.rangeFrom ?? ''),
      rangeTo: String(item.rangeTo ?? ''),
      nextNumber: String(item.nextNumber ?? ''),
      enabled: item.enabled,
    });
  }

  async function deleteRemitoCai(id: string) {
    const ok = window.confirm('¿Seguro querés eliminar este CAI de remitos?');
    if (!ok) return;

    setSaving(true);

    try {
      await arcaConfigApi.deleteRemitoCai(id);
      setRemitoCais(await arcaConfigApi.listRemitoCais());
      showToast('success', 'CAI de remitos eliminado');
    } catch (error) {
      showToast('error', getErrorMessage(error, 'Error al eliminar CAI de remitos'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout
      title="Configuración ARCA"
      subtitle="Datos fiscales, certificados, puntos de venta y CAI de remitos"
      actions={
        <SecondaryButton icon={<RefreshCcw size={16} />} onClick={loadAll} loading={loading}>
          Actualizar
        </SecondaryButton>
      }
    >
      {toast && (
        <div
          style={{
            position: 'fixed',
            right: isMobile ? 12 : 20,
            bottom: isMobile ? 12 : 20,
            left: isMobile ? 12 : undefined,
            zIndex: 60,
            borderRadius: 14,
            padding: '13px 15px',
            border:
              toast.type === 'success'
                ? '1px solid rgba(34,197,94,0.35)'
                : toast.type === 'error'
                  ? '1px solid rgba(239,68,68,0.35)'
                  : '1px solid var(--border)',
            background:
              toast.type === 'success'
                ? 'rgba(34,197,94,0.12)'
                : toast.type === 'error'
                  ? 'rgba(239,68,68,0.12)'
                  : 'var(--surface)',
            color:
              toast.type === 'success'
                ? '#16a34a'
                : toast.type === 'error'
                  ? '#dc2626'
                  : 'var(--text)',
            fontWeight: 850,
            fontSize: 13,
            boxShadow: '0 18px 45px rgba(0,0,0,0.12)',
          }}
        >
          {toast.message}
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: isMobile ? 28 : 40, textAlign: 'center' }}>
          <Loader2 className="animate-spin" />
          <p style={{ marginTop: 12, color: 'var(--text2)' }}>Cargando ARCA...</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: isMobile ? 14 : 18, minWidth: 0 }}>
          <Card
            title="Estado general"
            subtitle="Resumen de la configuración fiscal y remitos"
            icon={<ShieldCheck size={20} />}
            right={<StatusBadge tone={status.tone}>{status.text}</StatusBadge>}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: 12,
              }}
            >
              <div className="card" style={{ padding: 14 }}>
                <p style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 800 }}>
                  Razón social
                </p>
                <p style={{ marginTop: 5, fontWeight: 950 }}>
                  {config?.businessName || 'Sin configurar'}
                </p>
              </div>

              <div className="card" style={{ padding: 14 }}>
                <p style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 800 }}>
                  CUIT
                </p>
                <p style={{ marginTop: 5, fontWeight: 950 }}>{config?.cuit || '—'}</p>
              </div>

              <div className="card" style={{ padding: 14 }}>
                <p style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 800 }}>
                  Certificado
                </p>
                <p style={{ marginTop: 5, fontWeight: 950 }}>
                  {config?.certExpiresAt ? `Vence ${formatDate(config.certExpiresAt)}` : 'Sin certificado'}
                </p>
              </div>

              <div className="card" style={{ padding: 14 }}>
                <p style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 800 }}>
                  CAI remitos
                </p>
                <p style={{ marginTop: 5, fontWeight: 950 }}>
                  {activeRemitoCai
                    ? `PV ${activeRemitoCai.pointOfSale} · Próx. ${activeRemitoCai.nextNumber || '—'}`
                    : 'Sin CAI activo'}
                </p>
              </div>
            </div>

            {config?.lastError && (
              <div
                style={{
                  marginTop: 14,
                  border: '1px solid rgba(239,68,68,0.25)',
                  background: 'rgba(239,68,68,0.08)',
                  borderRadius: 14,
                  padding: 14,
                  display: 'flex',
                  gap: 10,
                  color: '#dc2626',
                  fontWeight: 750,
                }}
              >
                <AlertCircle size={18} />
                {config.lastError}
              </div>
            )}
          </Card>

          <Card
            title="Datos fiscales del negocio"
            subtitle="Estos datos salen en facturas, tickets fiscales y remitos"
            icon={<Building2 size={20} />}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(230px, 1fr))',
                gap: 14,
              }}
            >
              <Field
                label="Razón social"
                value={fiscalForm.businessName}
                onChange={(value) => setFiscalForm((prev) => ({ ...prev, businessName: value }))}
                help="Nombre legal o razón social que se imprime en los comprobantes."
              />

              <Field
                label="CUIT"
                value={fiscalForm.cuit}
                onChange={(value) =>
                  setFiscalForm((prev) => ({ ...prev, cuit: normalizeCuit(value) }))
                }
                placeholder="30719386500"
                help="CUIT de la empresa sin guiones. Debe tener 11 dígitos."
              />

              <SelectField
                label="Condición IVA"
                value={fiscalForm.ivaCondition}
                onChange={(value) =>
                  setFiscalForm((prev) => ({ ...prev, ivaCondition: value }))
                }
                options={IVA_CONDITION_OPTIONS}
                help="Elegí la condición fiscal exacta. No se escribe manualmente para evitar errores en facturas, tickets y remitos."
              />

              <Field
                label="Ingresos Brutos"
                value={fiscalForm.iibb}
                onChange={(value) => setFiscalForm((prev) => ({ ...prev, iibb: value }))}
                placeholder="Número de IIBB"
                help="Número de inscripción en Ingresos Brutos. Sale impreso en el remito."
              />

              <Field
                label="Inicio de actividad"
                type="date"
                value={fiscalForm.activityStart}
                onChange={(value) => setFiscalForm((prev) => ({ ...prev, activityStart: value }))}
                help="Fecha de inicio de actividades de la empresa. Sale impresa en los remitos."
              />

              <SelectField
                label="Ambiente"
                value={fiscalForm.environment}
                onChange={(value) => setFiscalForm((prev) => ({ ...prev, environment: value }))}
                options={ENVIRONMENT_OPTIONS}
                help="Homologación es para pruebas. Producción emite comprobantes reales."
              />

              <Field
                label="Punto de venta principal"
                value={fiscalForm.defaultPointOfSale}
                onChange={(value) =>
                  setFiscalForm((prev) => ({ ...prev, defaultPointOfSale: value }))
                }
                placeholder="1"
                help="Número de punto de venta fiscal usado por defecto para comprobantes."
              />

              <SelectField
                label="Moneda"
                value={fiscalForm.defaultCurrencyId}
                onChange={(value) =>
                  setFiscalForm((prev) => ({ ...prev, defaultCurrencyId: value }))
                }
                options={CURRENCY_OPTIONS}
                help="Moneda fiscal predeterminada. En Argentina normalmente se usa PES."
              />

              <SelectField
                label="Concepto AFIP"
                value={fiscalForm.defaultConcept}
                onChange={(value) =>
                  setFiscalForm((prev) => ({ ...prev, defaultConcept: value }))
                }
                options={CONCEPT_OPTIONS}
                help="1 = productos, 2 = servicios, 3 = productos y servicios. Para un POS de mercadería normalmente se usa Productos."
              />

              <div style={{ gridColumn: '1 / -1' }}>
                <Field
                  label="Domicilio fiscal"
                  value={fiscalForm.fiscalAddress}
                  onChange={(value) =>
                    setFiscalForm((prev) => ({ ...prev, fiscalAddress: value }))
                  }
                  placeholder="Calle, número, localidad, provincia"
                  help="Domicilio fiscal registrado de la empresa. También puede salir impreso en remitos."
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18, flexDirection: isMobile ? 'column' : 'row' }}>
              <PrimaryButton
                icon={<Save size={16} />}
                onClick={handleSaveFiscal}
                loading={savingFiscal}
                disabled={savingFiscal}
              >
                Guardar datos fiscales
              </PrimaryButton>
            </div>
          </Card>

          <Card
            title="Certificado ARCA"
            subtitle="Generá CSR, subí el certificado .crt y activá la configuración"
            icon={<FileKey2 size={20} />}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 14,
              }}
            >
              <div className="card" style={{ padding: 14 }}>
                <p style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 800 }}>
                  CSR generado
                </p>
                <p style={{ marginTop: 5, fontWeight: 950 }}>
                  {config?.csrGeneratedAt ? formatDateTime(config.csrGeneratedAt) : 'No generado'}
                </p>
              </div>

              <div className="card" style={{ padding: 14 }}>
                <p style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 800 }}>
                  Alias certificado
                </p>
                <p style={{ marginTop: 5, fontWeight: 950 }}>{config?.certAlias || '—'}</p>
              </div>

              <div className="card" style={{ padding: 14 }}>
                <p style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 800 }}>
                  Vencimiento
                </p>
                <p style={{ marginTop: 5, fontWeight: 950 }}>
                  {formatDate(config?.certExpiresAt)}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18, flexDirection: isMobile ? 'column' : 'row' }}>
              <SecondaryButton
                icon={<FileText size={16} />}
                onClick={handleGenerateCsr}
                loading={saving}
              >
                Generar CSR
              </SecondaryButton>

              <SecondaryButton
                icon={<Download size={16} />}
                onClick={handleDownloadCsr}
                disabled={!config?.csrGeneratedAt}
              >
                Descargar CSR
              </SecondaryButton>

              <SecondaryButton icon={<BadgeCheck size={16} />} onClick={handleActivate} loading={saving}>
                Activar ARCA
              </SecondaryButton>

              <SecondaryButton icon={<CheckCircle2 size={16} />} onClick={handleTestWsaa} loading={saving}>
                Test WSAA
              </SecondaryButton>

              <SecondaryButton icon={<CheckCircle2 size={16} />} onClick={handleTestWsfeDummy} loading={saving}>
                Test WSFE
              </SecondaryButton>

              <SecondaryButton
                danger
                icon={<XCircle size={16} />}
                onClick={handleDeleteCertificates}
                loading={saving}
              >
                Borrar certificados
              </SecondaryButton>
            </div>

            <div
              style={{
                marginTop: 20,
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 14,
              }}
            >
              <div style={{ display: 'grid', gap: 7 }}>
                <HelpLabel
                  label="Certificado .crt"
                  help="Archivo que descarga ARCA después de subir el CSR generado por el sistema."
                />
                <input
                  type="file"
                  accept=".crt,.pem,.cer"
                  onChange={(event) => setCertFile(event.target.files?.[0] || null)}
                  style={{ width: '100%', minWidth: 0 }}
                />
              </div>

              <div style={{ display: 'grid', gap: 7 }}>
                <HelpLabel
                  label="Private key .key opcional"
                  help="Solo se usa si no generaste el CSR desde el sistema y tenés una clave privada manual."
                />
                <input
                  type="file"
                  accept=".key,.pem"
                  onChange={(event) => setKeyFile(event.target.files?.[0] || null)}
                  style={{ width: '100%', minWidth: 0 }}
                />
              </div>

              <Field
                label="Vencimiento certificado opcional"
                type="date"
                value={certExpiresAt}
                onChange={setCertExpiresAt}
                help="Si lo dejás vacío, el backend intenta leer el vencimiento desde el certificado."
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <PrimaryButton icon={<Upload size={16} />} onClick={handleUploadCertificate} loading={saving}>
                Subir certificado
              </PrimaryButton>
            </div>
          </Card>

          <Card
            title="Puntos de venta fiscales"
            subtitle="Configurá los números habilitados en ARCA para emitir facturas y notas de crédito"
            icon={<FileText size={20} />}
          >
            <div
              style={{
                marginBottom: 16,
                border: '1px solid rgba(59,130,246,0.25)',
                background: 'rgba(59,130,246,0.08)',
                borderRadius: 14,
                padding: 14,
                display: 'grid',
                gap: 8,
                color: 'var(--text)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 950 }}>
                <HelpCircle size={17} />
                ¿Qué es un punto de venta?
              </div>

              <p style={{ margin: 0, color: 'var(--text2)', fontSize: 13, lineHeight: 1.5 }}>
                Es el número que ARCA asigna para emitir comprobantes fiscales. Por ejemplo,
                el punto de venta <b>0001</b> se carga acá como <b>1</b>. Ese número después
                aparece en la factura como parte del comprobante, por ejemplo:
                <b> 0001-00000023</b>.
              </p>

              <p style={{ margin: 0, color: 'var(--text2)', fontSize: 13, lineHeight: 1.5 }}>
                En “Tipos habilitados” cargá los códigos que ese punto puede emitir. Para una
                configuración común podés usar <b>1,6,11,3,8,13</b>: Facturas A/B/C y Notas de
                Crédito A/B/C.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 14,
              }}
            >
              <Field
                label="Número de punto de venta"
                value={pointForm.number}
                onChange={(value) => setPointForm((prev) => ({ ...prev, number: value }))}
                placeholder="Ej: 1"
                help="Es el número de punto de venta dado de alta en ARCA. Si en ARCA aparece como 0001, acá cargá 1."
              />

              <Field
                label="Descripción interna"
                value={pointForm.description}
                onChange={(value) => setPointForm((prev) => ({ ...prev, description: value }))}
                placeholder="Ej: Local principal / Facturación electrónica"
                help="Es solo una referencia interna. Ejemplo: Local principal, Caja 1, Facturación electrónica."
              />

              <Field
                label="Tipos de comprobantes habilitados"
                value={pointForm.enabledCbteTypes}
                onChange={(value) =>
                  setPointForm((prev) => ({ ...prev, enabledCbteTypes: value }))
                }
                placeholder="Ej: 1,6,11,3,8,13"
                help="Códigos comunes: 1 Factura A, 6 Factura B, 11 Factura C, 3 Nota de Crédito A, 8 Nota de Crédito B, 13 Nota de Crédito C. Separalos por coma."
              />

              <div style={{ display: 'grid', gap: 12, alignContent: 'center' }}>
                <CheckboxField
                  label="Usar este punto de venta"
                  checked={pointForm.enabled}
                  onChange={(value) => setPointForm((prev) => ({ ...prev, enabled: value }))}
                  help="Si está activado, el sistema puede usar este punto de venta para facturar."
                />

                <CheckboxField
                  label="Marcar como principal"
                  checked={pointForm.isDefault}
                  onChange={(value) => setPointForm((prev) => ({ ...prev, isDefault: value }))}
                  help="El punto principal se usa por defecto cuando no se elige otro."
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18, flexDirection: isMobile ? 'column' : 'row' }}>
              <PrimaryButton
                icon={pointForm.id ? <Save size={16} /> : <Plus size={16} />}
                onClick={handleSavePointOfSale}
                loading={saving}
              >
                {pointForm.id ? 'Actualizar punto' : 'Agregar punto'}
              </PrimaryButton>

              {pointForm.id && (
                <SecondaryButton onClick={() => setPointForm(emptyPointForm)}>
                  Cancelar edición
                </SecondaryButton>
              )}
            </div>

            {isMobile ? (
              <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                {points.map((point) => (
                  <div
                    key={point.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                      padding: 14,
                      background: 'var(--surface2)',
                      display: 'grid',
                      gap: 12,
                      minWidth: 0,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--text3)', fontWeight: 900 }}>
                          Punto de venta
                        </p>
                        <p style={{ margin: '4px 0 0', fontFamily: 'var(--mono)', fontWeight: 950 }}>
                          {String(point.number).padStart(4, '0')}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <StatusBadge tone={point.enabled ? 'green' : 'gray'}>
                          {point.enabled ? 'Activo' : 'Inactivo'}
                        </StatusBadge>
                        {point.isDefault && <StatusBadge tone="blue">Principal</StatusBadge>}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: 4 }}>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--text3)', fontWeight: 900 }}>
                        Descripción
                      </p>
                      <p style={{ margin: 0, color: 'var(--text2)', fontSize: 13, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                        {point.description || '—'}
                      </p>
                    </div>

                    <div style={{ display: 'grid', gap: 4 }}>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--text3)', fontWeight: 900 }}>
                        Tipos habilitados
                      </p>
                      <p style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)', overflowWrap: 'anywhere' }}>
                        {point.enabledCbteTypes?.join(', ') || '—'}
                      </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <SecondaryButton icon={<Edit2 size={14} />} onClick={() => editPoint(point)}>
                        Editar
                      </SecondaryButton>
                      <SecondaryButton
                        danger
                        icon={<Trash2 size={14} />}
                        onClick={() => deletePoint(point.id)}
                      >
                        Borrar
                      </SecondaryButton>
                    </div>
                  </div>
                ))}

                {!points.length && (
                  <div style={{ padding: 18, color: 'var(--text3)', textAlign: 'center' }}>
                    No hay puntos de venta cargados.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: 18 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text3)' }}>
                      <th style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>PV</th>
                      <th style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                        Descripción
                      </th>
                      <th style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                        Tipos
                      </th>
                      <th style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                        Estado
                      </th>
                      <th style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((point) => (
                      <tr key={point.id}>
                        <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                          {String(point.number).padStart(4, '0')}
                        </td>
                        <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                          {point.description || '—'}
                        </td>
                        <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                          {point.enabledCbteTypes?.join(', ') || '—'}
                        </td>
                        <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                          <StatusBadge tone={point.enabled ? 'green' : 'gray'}>
                            {point.enabled ? 'Activo' : 'Inactivo'}
                          </StatusBadge>
                          {point.isDefault && (
                            <span style={{ marginLeft: 8 }}>
                              <StatusBadge tone="blue">Principal</StatusBadge>
                            </span>
                          )}
                        </td>
                        <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <SecondaryButton icon={<Edit2 size={14} />} onClick={() => editPoint(point)}>
                              Editar
                            </SecondaryButton>
                            <SecondaryButton
                              danger
                              icon={<Trash2 size={14} />}
                              onClick={() => deletePoint(point.id)}
                            >
                              Borrar
                            </SecondaryButton>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {!points.length && (
                      <tr>
                        <td colSpan={5} style={{ padding: 18, color: 'var(--text3)' }}>
                          No hay puntos de venta cargados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

          </Card>

          <Card
            title="CAI de remitos"
            subtitle="Se usa para emitir remitos R. El sistema guarda el CAI usado en cada remito."
            icon={<FileText size={20} />}
            right={
              activeRemitoCai ? (
                <StatusBadge tone="green">CAI activo</StatusBadge>
              ) : (
                <StatusBadge tone="yellow">Falta CAI</StatusBadge>
              )
            }
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: 14,
              }}
            >
              <SelectField
                label="Modo"
                value={remitoCaiForm.mode}
                onChange={(value) =>
                  setRemitoCaiForm((prev) => ({ ...prev, mode: value }))
                }
                options={REMITO_MODE_OPTIONS}
                help="Digital completo imprime todo desde el sistema. Formulario preimpreso sirve si tenés talonario autorizado y solo completás datos."
              />

              <Field
                label="Punto de venta remito"
                value={remitoCaiForm.pointOfSale}
                onChange={(value) =>
                  setRemitoCaiForm((prev) => ({ ...prev, pointOfSale: value }))
                }
                placeholder="1"
                help="Punto de venta asociado al CAI de remitos."
              />

              <Field
                label="CAI"
                value={remitoCaiForm.cai}
                onChange={(value) => setRemitoCaiForm((prev) => ({ ...prev, cai: value }))}
                placeholder="12345678901234"
                help="Código de Autorización de Impresión otorgado por ARCA para los remitos."
              />

              <Field
                label="Vencimiento CAI"
                type="date"
                value={remitoCaiForm.expiresAt}
                onChange={(value) =>
                  setRemitoCaiForm((prev) => ({ ...prev, expiresAt: value }))
                }
                help="Fecha hasta la cual está autorizado ese CAI. Si vence, no se debe usar para emitir remitos."
              />

              <Field
                label="Desde número"
                value={remitoCaiForm.rangeFrom}
                onChange={(value) =>
                  setRemitoCaiForm((prev) => ({ ...prev, rangeFrom: value }))
                }
                help="Primer número autorizado por ese CAI."
              />

              <Field
                label="Hasta número"
                value={remitoCaiForm.rangeTo}
                onChange={(value) =>
                  setRemitoCaiForm((prev) => ({ ...prev, rangeTo: value }))
                }
                help="Último número autorizado por ese CAI."
              />

              <Field
                label="Próximo número"
                value={remitoCaiForm.nextNumber}
                onChange={(value) =>
                  setRemitoCaiForm((prev) => ({ ...prev, nextNumber: value }))
                }
                help="Número que va a usar el próximo remito. Después de emitir, el backend lo aumenta solo."
              />

              <div style={{ display: 'grid', alignContent: 'center' }}>
                <CheckboxField
                  label="CAI activo"
                  checked={remitoCaiForm.enabled}
                  onChange={(value) =>
                    setRemitoCaiForm((prev) => ({ ...prev, enabled: value }))
                  }
                  help="Solo los CAI activos y no vencidos se usan para emitir remitos."
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18, flexDirection: isMobile ? 'column' : 'row' }}>
              <PrimaryButton
                icon={remitoCaiForm.id ? <Save size={16} /> : <Plus size={16} />}
                onClick={handleSaveRemitoCai}
                loading={saving}
              >
                {remitoCaiForm.id ? 'Actualizar CAI' : 'Agregar CAI'}
              </PrimaryButton>

              {remitoCaiForm.id && (
                <SecondaryButton onClick={() => setRemitoCaiForm(emptyRemitoCaiForm)}>
                  Cancelar edición
                </SecondaryButton>
              )}
            </div>

            {isMobile ? (
              <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                {remitoCais.map((item) => {
                  const expired = new Date(item.expiresAt).getTime() < INITIAL_NOW_TS;

                  return (
                    <div
                      key={item.id}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 14,
                        padding: 14,
                        background: 'var(--surface2)',
                        display: 'grid',
                        gap: 12,
                        minWidth: 0,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 11, color: 'var(--text3)', fontWeight: 900 }}>
                            CAI
                          </p>
                          <p style={{ margin: '4px 0 0', fontFamily: 'var(--mono)', fontWeight: 950, overflowWrap: 'anywhere' }}>
                            {item.cai}
                          </p>
                        </div>

                        {expired ? (
                          <StatusBadge tone="red">Vencido</StatusBadge>
                        ) : item.enabled ? (
                          <StatusBadge tone="green">Activo</StatusBadge>
                        ) : (
                          <StatusBadge tone="gray">Inactivo</StatusBadge>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                          gap: 10,
                        }}
                      >
                        <div>
                          <p style={{ margin: 0, fontSize: 11, color: 'var(--text3)', fontWeight: 900 }}>
                            Punto de venta
                          </p>
                          <p style={{ margin: '4px 0 0', fontFamily: 'var(--mono)', fontSize: 13 }}>
                            {String(item.pointOfSale).padStart(4, '0')}
                          </p>
                        </div>

                        <div>
                          <p style={{ margin: 0, fontSize: 11, color: 'var(--text3)', fontWeight: 900 }}>
                            Vence
                          </p>
                          <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                            {formatDate(item.expiresAt)}
                          </p>
                        </div>

                        <div>
                          <p style={{ margin: 0, fontSize: 11, color: 'var(--text3)', fontWeight: 900 }}>
                            Rango
                          </p>
                          <p style={{ margin: '4px 0 0', fontFamily: 'var(--mono)', fontSize: 12 }}>
                            {item.rangeFrom || '—'} a {item.rangeTo || '—'}
                          </p>
                        </div>

                        <div>
                          <p style={{ margin: 0, fontSize: 11, color: 'var(--text3)', fontWeight: 900 }}>
                            Próximo
                          </p>
                          <p style={{ margin: '4px 0 0', fontFamily: 'var(--mono)', fontSize: 12 }}>
                            {item.nextNumber || '—'}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <SecondaryButton
                          icon={<Edit2 size={14} />}
                          onClick={() => editRemitoCai(item)}
                        >
                          Editar
                        </SecondaryButton>
                        <SecondaryButton
                          danger
                          icon={<Trash2 size={14} />}
                          onClick={() => deleteRemitoCai(item.id)}
                        >
                          Borrar
                        </SecondaryButton>
                      </div>
                    </div>
                  );
                })}

                {!remitoCais.length && (
                  <div style={{ padding: 18, color: 'var(--text3)', textAlign: 'center' }}>
                    No hay CAI de remitos cargado.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: 18 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text3)' }}>
                      <th style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>PV</th>
                      <th style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>CAI</th>
                      <th style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                        Vence
                      </th>
                      <th style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                        Rango
                      </th>
                      <th style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                        Próximo
                      </th>
                      <th style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                        Estado
                      </th>
                      <th style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {remitoCais.map((item) => {
                      const expired = new Date(item.expiresAt).getTime() < INITIAL_NOW_TS;

                      return (
                        <tr key={item.id}>
                          <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                            {String(item.pointOfSale).padStart(4, '0')}
                          </td>
                          <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                            {item.cai}
                          </td>
                          <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                            {formatDate(item.expiresAt)}
                          </td>
                          <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                            {item.rangeFrom || '—'} a {item.rangeTo || '—'}
                          </td>
                          <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                            {item.nextNumber || '—'}
                          </td>
                          <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                            {expired ? (
                              <StatusBadge tone="red">Vencido</StatusBadge>
                            ) : item.enabled ? (
                              <StatusBadge tone="green">Activo</StatusBadge>
                            ) : (
                              <StatusBadge tone="gray">Inactivo</StatusBadge>
                            )}
                          </td>
                          <td style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <SecondaryButton
                                icon={<Edit2 size={14} />}
                                onClick={() => editRemitoCai(item)}
                              >
                                Editar
                              </SecondaryButton>
                              <SecondaryButton
                                danger
                                icon={<Trash2 size={14} />}
                                onClick={() => deleteRemitoCai(item.id)}
                              >
                                Borrar
                              </SecondaryButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {!remitoCais.length && (
                      <tr>
                        <td colSpan={7} style={{ padding: 18, color: 'var(--text3)' }}>
                          No hay CAI de remitos cargado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

          </Card>
        </div>
      )}
    </AppLayout>
  );
}