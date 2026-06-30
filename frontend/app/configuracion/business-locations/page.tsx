'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { formatDateTimeAR } from '@/lib/dateAR';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Edit2,
  HelpCircle,
  Info,
  Loader2,
  MapPin,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Star,
  Trash2,
  Warehouse,
  XCircle,
} from 'lucide-react';

type BusinessLocationType = 'BRANCH' | 'WAREHOUSE' | 'STORE';

type BusinessLocation = {
  id: string;
  name: string;
  type: BusinessLocationType;

  addressStreet?: string | null;
  addressNumber?: string | null;
  addressCity?: string | null;
  addressProvince?: string | null;
  addressPostalCode?: string | null;
  addressNotes?: string | null;

  latitude?: number | null;
  longitude?: number | null;

  isDefault: boolean;
  isActive: boolean;

  createdAt: string;
  updatedAt: string;
};

type ApiListResponse =
  | {
      ok: boolean;
      locations: BusinessLocation[];
    }
  | BusinessLocation[];

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
} | null;

type LocationForm = {
  name: string;
  type: BusinessLocationType;

  addressStreet: string;
  addressNumber: string;
  addressCity: string;
  addressProvince: string;
  addressPostalCode: string;
  addressNotes: string;

  latitude: string;
  longitude: string;

  isDefault: boolean;
  isActive: boolean;
};

const emptyForm: LocationForm = {
  name: '',
  type: 'WAREHOUSE',

  addressStreet: '',
  addressNumber: '',
  addressCity: '',
  addressProvince: '',
  addressPostalCode: '',
  addressNotes: '',

  latitude: '',
  longitude: '',

  isDefault: false,
  isActive: true,
};

function getErrorMessage(error: unknown, fallback: string) {
  const e = error as {
    response?: {
      data?: {
        message?: string;
        error?: string;
      };
    };
  };

  return e?.response?.data?.message ?? e?.response?.data?.error ?? fallback;
}

function normalizeArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (
    value &&
    typeof value === 'object' &&
    'locations' in value &&
    Array.isArray((value as { locations?: unknown }).locations)
  ) {
    return (value as { locations: T[] }).locations;
  }

  if (
    value &&
    typeof value === 'object' &&
    'content' in value &&
    Array.isArray((value as { content?: unknown }).content)
  ) {
    return (value as { content: T[] }).content;
  }

  return [];
}

function typeLabel(type: BusinessLocationType) {
  if (type === 'WAREHOUSE') return 'Depósito';
  if (type === 'STORE') return 'Local';
  return 'Sucursal';
}

function typeDescription(type: BusinessLocationType) {
  if (type === 'WAREHOUSE') return 'Lugar principal de stock o guardado de mercadería.';
  if (type === 'STORE') return 'Local de atención o punto de venta físico.';
  return 'Sucursal secundaria o punto operativo.';
}

function typeIcon(type: BusinessLocationType): ElementType {
  if (type === 'WAREHOUSE') return Warehouse;
  if (type === 'STORE') return Building2;
  return MapPin;
}

function buildAddress(location: BusinessLocation) {
  const line1 = [location.addressStreet, location.addressNumber].filter(Boolean).join(' ');
  const line2 = [
    location.addressCity,
    location.addressProvince,
    location.addressPostalCode,
  ]
    .filter(Boolean)
    .join(' · ');

  if (!line1 && !line2) return 'Sin dirección cargada';
  if (line1 && line2) return `${line1} — ${line2}`;
  return line1 || line2;
}

function formatDateTime(value?: string | null) {
  return formatDateTimeAR(value);
}

function cleanPayload(form: LocationForm) {
  return {
    name: form.name.trim(),
    type: form.type,

    addressStreet: form.addressStreet.trim() || null,
    addressNumber: form.addressNumber.trim() || null,
    addressCity: form.addressCity.trim() || null,
    addressProvince: form.addressProvince.trim() || null,
    addressPostalCode: form.addressPostalCode.trim() || null,
    addressNotes: form.addressNotes.trim() || null,

    latitude: form.latitude.trim() === '' ? null : Number(form.latitude),
    longitude: form.longitude.trim() === '' ? null : Number(form.longitude),

    isDefault: form.isDefault,
    isActive: form.isActive,
  };
}

function FieldHelp({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 6 }}>
      <Info size={13} style={{ color: 'var(--text3)', marginTop: 1, flexShrink: 0 }} />
      <p style={{ color: 'var(--text3)', fontSize: 12, lineHeight: 1.45 }}>{children}</p>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  help,
  type = 'text',
  optional = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  help?: ReactNode;
  type?: string;
  optional?: boolean;
  disabled?: boolean;
}) {
  return (
    <label style={{ display: 'block' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 7,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--text2)' }}>
          {label}
        </span>

        {optional && (
          <span
            className="badge badge-gray"
            style={{ fontSize: 10, padding: '3px 7px' }}
          >
            OPCIONAL
          </span>
        )}
      </div>

      <input
        value={value}
        type={type}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input"
      />

      {help && <FieldHelp>{help}</FieldHelp>}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  help?: ReactNode;
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ marginBottom: 7 }}>
        <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--text2)' }}>
          {label}
        </span>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="input"
        style={{ height: 'auto', minHeight: 88, resize: 'vertical', paddingTop: 12 }}
      />

      {help && <FieldHelp>{help}</FieldHelp>}
    </label>
  );
}

function SectionCard({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ElementType;
  children: ReactNode;
}) {
  return (
    <section className="card locations-list-card" style={{ padding: 22 }}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: 22,
        }}
      >
        <span
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={19} />
        </span>

        <div>
          <h3 style={{ fontSize: 15, fontWeight: 900 }}>{title}</h3>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 3 }}>{subtitle}</p>
        </div>
      </div>

      {children}
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  help,
  badge,
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  help: string;
  badge?: ReactNode;
}) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              display: 'grid',
              placeItems: 'center',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
            }}
          >
            <Icon size={18} />
          </span>

          <div>
            <p style={{ color: 'var(--text2)', fontSize: 12, fontWeight: 800 }}>
              {label}
            </p>
            <p style={{ color: 'var(--text)', fontSize: 22, fontWeight: 950, marginTop: 2 }}>
              {value}
            </p>
          </div>
        </div>

        {badge}
      </div>

      <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 12, lineHeight: 1.45 }}>
        {help}
      </p>
    </div>
  );
}

function ToggleBox({
  title,
  subtitle,
  checked,
  onChange,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: ElementType;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        padding: 14,
        borderRadius: 16,
        border: checked ? '1px solid rgba(15,159,92,0.34)' : '1px solid var(--border)',
        background: checked ? 'rgba(15,159,92,0.08)' : 'var(--surface2)',
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={16} />
        </span>

        <div>
          <p style={{ fontSize: 13, fontWeight: 900 }}>{title}</p>
          <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 2 }}>{subtitle}</p>
        </div>
      </div>

      <span className={`badge ${checked ? 'badge-green' : 'badge-gray'}`}>
        {checked ? 'SÍ' : 'NO'}
      </span>
    </button>
  );
}

export default function BusinessLocationsPage() {
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  const [form, setForm] = useState<LocationForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  async function fetchLocations() {
    const res = await api.get<ApiListResponse>('/business-locations');
    return normalizeArray<BusinessLocation>(res.data);
  }

  async function loadLocations(showSuccess = false) {
    setLoading(true);

    try {
      const nextLocations = await fetchLocations();
      setLocations(nextLocations);

      if (showSuccess) {
        toast.success('Ubicaciones actualizadas');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'No se pudieron cargar las ubicaciones.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;

    fetchLocations()
      .then((nextLocations) => {
        if (!alive) return;
        setLocations(nextLocations);
      })
      .catch((err) => {
        console.error(err);

        if (!alive) return;
        toast.error(getErrorMessage(err, 'No se pudieron cargar las ubicaciones.'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const filteredLocations = useMemo(() => {
    const q = search.trim().toLowerCase();

    return locations.filter((location) => {
      const matchesActive = showInactive || location.isActive;

      const matchesSearch =
        !q ||
        location.name.toLowerCase().includes(q) ||
        typeLabel(location.type).toLowerCase().includes(q) ||
        buildAddress(location).toLowerCase().includes(q);

      return matchesActive && matchesSearch;
    });
  }, [locations, search, showInactive]);

  const defaultLocation = useMemo(
    () => locations.find((location) => location.isDefault),
    [locations]
  );

  const activeCount = useMemo(
    () => locations.filter((location) => location.isActive).length,
    [locations]
  );

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(location: BusinessLocation) {
    setEditingId(location.id);
    setForm({
      name: location.name ?? '',
      type: location.type ?? 'WAREHOUSE',

      addressStreet: location.addressStreet ?? '',
      addressNumber: location.addressNumber ?? '',
      addressCity: location.addressCity ?? '',
      addressProvince: location.addressProvince ?? '',
      addressPostalCode: location.addressPostalCode ?? '',
      addressNotes: location.addressNotes ?? '',

      latitude:
        location.latitude === null || location.latitude === undefined
          ? ''
          : String(location.latitude),
      longitude:
        location.longitude === null || location.longitude === undefined
          ? ''
          : String(location.longitude),

      isDefault: Boolean(location.isDefault),
      isActive: Boolean(location.isActive),
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = cleanPayload(form);

    if (!payload.name) {
      toast.error('El nombre es obligatorio.');
      return;
    }

    if (
      payload.latitude !== null &&
      (!Number.isFinite(payload.latitude) ||
        payload.latitude < -90 ||
        payload.latitude > 90)
    ) {
      toast.error('La latitud debe estar entre -90 y 90.');
      return;
    }

    if (
      payload.longitude !== null &&
      (!Number.isFinite(payload.longitude) ||
        payload.longitude < -180 ||
        payload.longitude > 180)
    ) {
      toast.error('La longitud debe estar entre -180 y 180.');
      return;
    }

    setSaving(true);

    const toastId = toast.loading(
      editingId ? 'Guardando ubicación...' : 'Creando ubicación...'
    );

    try {
      if (editingId) {
        await api.put(`/business-locations/${editingId}`, payload);
        toast.success('Ubicación actualizada correctamente.', { id: toastId });
      } else {
        await api.post('/business-locations', payload);
        toast.success('Ubicación creada correctamente.', { id: toastId });
      }

      resetForm();
      await loadLocations();
    } catch (err) {
      toast.error(getErrorMessage(err, 'No se pudo guardar la ubicación.'), {
        id: toastId,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(id: string) {
    const toastId = toast.loading('Actualizando ubicación predeterminada...');

    try {
      await api.patch(`/business-locations/${id}/default`);
      toast.success('Ubicación predeterminada actualizada.', { id: toastId });
      await loadLocations();
    } catch (err) {
      toast.error(getErrorMessage(err, 'No se pudo marcar como predeterminada.'), {
        id: toastId,
      });
    }
  }

  async function handleDelete(location: BusinessLocation) {
    setConfirmModal({
      title: 'Eliminar ubicación',
      message: `¿Eliminar o desactivar "${location.name}"? Si tiene ventas asociadas, el sistema la va a desactivar.`,
      confirmText: 'Eliminar',
      danger: true,
      onConfirm: async () => {
        const toastId = toast.loading('Eliminando ubicación...');

        try {
          await api.delete(`/business-locations/${location.id}`);
          toast.success('Ubicación eliminada o desactivada correctamente.', {
            id: toastId,
          });

          if (editingId === location.id) resetForm();

          await loadLocations();
        } catch (err) {
          toast.error(getErrorMessage(err, 'No se pudo eliminar la ubicación.'), {
            id: toastId,
          });
        }
      },
    });
  }

  async function confirmAction() {
    if (!confirmModal) return;

    setConfirmLoading(true);

    try {
      await confirmModal.onConfirm();
      setConfirmModal(null);
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <AppLayout
      title="Sucursales y depósitos"
      subtitle="Configurá desde dónde salen ventas, envíos, remitos y entregas."
      actions={
        <button className="btn btn-secondary" onClick={() => loadLocations(true)} disabled={loading}>
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      }
    >
      <div className="locations-page" style={{ display: 'grid', gap: 18 }}>
        <section
          className="locations-stats"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 14,
          }}
        >
          <StatCard
            icon={MapPin}
            label="Ubicaciones"
            value={locations.length}
            help="Cantidad total de locales, depósitos y sucursales cargadas."
          />

          <StatCard
            icon={CheckCircle2}
            label="Activas"
            value={activeCount}
            help="Solo las ubicaciones activas deberían usarse en ventas nuevas."
            badge={<span className="badge badge-green">OPERATIVAS</span>}
          />

          <StatCard
            icon={Star}
            label="Predeterminada"
            value={defaultLocation?.name || 'Sin definir'}
            help="Se puede usar por defecto para envíos y remitos."
            badge={<span className="badge badge-yellow">DEFAULT</span>}
          />
        </section>

        <section
          className="locations-main-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '430px minmax(0, 1fr)',
            gap: 18,
            alignItems: 'start',
          }}
        >
          <form className="locations-form" onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
            <SectionCard
              title={editingId ? 'Editar ubicación' : 'Nueva ubicación'}
              subtitle="Datos principales de la sucursal, depósito o local."
              icon={editingId ? Edit2 : Plus}
            >
              <div style={{ display: 'grid', gap: 14 }}>
                <InputField
                  label="Nombre"
                  value={form.name}
                  onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
                  placeholder="Ej: Depósito principal"
                  help="Este nombre va a aparecer al seleccionar desde dónde sale una venta."
                />

                <label style={{ display: 'block' }}>
                  <div style={{ marginBottom: 7 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--text2)' }}>
                      Tipo de ubicación
                    </span>
                  </div>

                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        type: e.target.value as BusinessLocationType,
                      }))
                    }
                    className="input"
                  >
                    <option value="WAREHOUSE">Depósito</option>
                    <option value="STORE">Local</option>
                    <option value="BRANCH">Sucursal</option>
                  </select>

                  <FieldHelp>{typeDescription(form.type)}</FieldHelp>
                </label>

                <div className="location-street-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 12 }}>
                  <InputField
                    label="Calle"
                    value={form.addressStreet}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, addressStreet: value }))
                    }
                    placeholder="San Martín"
                    optional
                  />

                  <InputField
                    label="Número"
                    value={form.addressNumber}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, addressNumber: value }))
                    }
                    placeholder="810"
                    optional
                  />
                </div>

                <div className="location-two-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <InputField
                    label="Localidad"
                    value={form.addressCity}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, addressCity: value }))
                    }
                    placeholder="Villa General Belgrano"
                    optional
                  />

                  <InputField
                    label="Provincia"
                    value={form.addressProvince}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, addressProvince: value }))
                    }
                    placeholder="Córdoba"
                    optional
                  />
                </div>

                <InputField
                  label="Código postal"
                  value={form.addressPostalCode}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, addressPostalCode: value }))
                  }
                  placeholder="5194"
                  optional
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Coordenadas y uso"
              subtitle="Datos necesarios para calcular envíos automáticamente."
              icon={MapPin}
            >
              <div style={{ display: 'grid', gap: 14 }}>
                <div className="location-two-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <InputField
                    label="Latitud"
                    value={form.latitude}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, latitude: value }))
                    }
                    placeholder="-31.978"
                    optional
                    help="Después podemos autocompletar esto con Google Geocoding."
                  />

                  <InputField
                    label="Longitud"
                    value={form.longitude}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, longitude: value }))
                    }
                    placeholder="-64.556"
                    optional
                  />
                </div>

                <TextAreaField
                  label="Notas internas"
                  value={form.addressNotes}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, addressNotes: value }))
                  }
                  placeholder="Ej: entrada por portón lateral, depósito al fondo..."
                  help="Esto es solo referencia interna del negocio."
                />

                <div className="location-toggle-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <ToggleBox
                    title="Predeterminada"
                    subtitle="Usarla por defecto"
                    checked={form.isDefault}
                    onChange={(checked) =>
                      setForm((prev) => ({ ...prev, isDefault: checked }))
                    }
                    icon={Star}
                  />

                  <ToggleBox
                    title="Activa"
                    subtitle="Disponible en ventas"
                    checked={form.isActive}
                    onChange={(checked) =>
                      setForm((prev) => ({ ...prev, isActive: checked }))
                    }
                    icon={CheckCircle2}
                  />
                </div>

                <div className="location-form-actions" style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {editingId ? 'Guardar cambios' : 'Crear ubicación'}
                  </button>

                  {editingId && (
                    <button className="btn btn-secondary" type="button" onClick={resetForm}>
                      <XCircle size={16} />
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </SectionCard>
          </form>

          <section className="card" style={{ padding: 22 }}>
            <div
              className="locations-list-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                alignItems: 'flex-start',
                marginBottom: 18,
              }}
            >
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 900 }}>
                  Ubicaciones cargadas
                </h3>
                <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 3 }}>
                  Administrá los puntos desde donde salen ventas, remitos y envíos.
                </p>
              </div>

              <button
                type="button"
                className={`badge locations-filter-toggle ${showInactive ? 'badge-blue' : 'badge-gray'}`}
                onClick={() => setShowInactive((prev) => !prev)}
                style={{ cursor: 'pointer' }}
              >
                {showInactive ? 'MOSTRANDO INACTIVAS' : 'SOLO ACTIVAS'}
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: 16 }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: 13,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text3)',
                  pointerEvents: 'none',
                }}
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, tipo o dirección..."
                className="input"
                style={{ paddingLeft: 40 }}
              />
            </div>

            {loading ? (
              <div
                style={{
                  minHeight: 280,
                  border: '1px dashed var(--border)',
                  borderRadius: 18,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'var(--surface2)',
                }}
              >
                <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
                  <Loader2 size={26} className="animate-spin" />
                  <p style={{ color: 'var(--text2)', fontSize: 13, fontWeight: 800 }}>
                    Cargando ubicaciones...
                  </p>
                </div>
              </div>
            ) : filteredLocations.length === 0 ? (
              <div
                style={{
                  minHeight: 280,
                  border: '1px dashed var(--border)',
                  borderRadius: 18,
                  display: 'grid',
                  placeItems: 'center',
                  textAlign: 'center',
                  padding: 30,
                  background: 'var(--surface2)',
                }}
              >
                <div>
                  <HelpCircle size={30} style={{ color: 'var(--text3)', margin: '0 auto 10px' }} />
                  <h4 style={{ fontSize: 15, fontWeight: 900 }}>
                    No hay ubicaciones para mostrar
                  </h4>
                  <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 6 }}>
                    Creá el primer depósito o local para usarlo en ventas y envíos.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {filteredLocations.map((location) => {
                  const Icon = typeIcon(location.type);

                  return (
                    <article
                      key={location.id}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 18,
                        background: location.isActive
                          ? 'var(--surface2)'
                          : 'rgba(17,24,39,0.035)',
                        padding: 16,
                        opacity: location.isActive ? 1 : 0.65,
                      }}
                    >
                      <div
                        className="location-item-main"
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 14,
                          alignItems: 'flex-start',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              gap: 7,
                              marginBottom: 10,
                            }}
                          >
                            <span className="badge badge-gray">
                              <Icon size={13} />
                              {typeLabel(location.type)}
                            </span>

                            {location.isDefault && (
                              <span className="badge badge-yellow">
                                <Star size={13} />
                                DEFAULT
                              </span>
                            )}

                            <span
                              className={`badge ${
                                location.isActive ? 'badge-green' : 'badge-red'
                              }`}
                            >
                              {location.isActive ? 'ACTIVA' : 'INACTIVA'}
                            </span>
                          </div>

                          <h4
                            style={{
                              fontSize: 15,
                              fontWeight: 950,
                              color: 'var(--text)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {location.name}
                          </h4>

                          <p
                            style={{
                              color: 'var(--text2)',
                              fontSize: 13,
                              marginTop: 5,
                              lineHeight: 1.45,
                            }}
                          >
                            {buildAddress(location)}
                          </p>

                          {(location.latitude !== null ||
                            location.longitude !== null) && (
                            <p
                              style={{
                                color: 'var(--text3)',
                                fontSize: 12,
                                marginTop: 5,
                              }}
                            >
                              Lat: {location.latitude ?? '—'} · Lng:{' '}
                              {location.longitude ?? '—'}
                            </p>
                          )}

                          {location.addressNotes && (
                            <p
                              style={{
                                marginTop: 10,
                                padding: '9px 11px',
                                borderRadius: 13,
                                border: '1px solid var(--border)',
                                color: 'var(--text3)',
                                fontSize: 12,
                                lineHeight: 1.45,
                              }}
                            >
                              {location.addressNotes}
                            </p>
                          )}

                          <p
                            style={{
                              color: 'var(--text3)',
                              fontSize: 11,
                              marginTop: 10,
                            }}
                          >
                            Actualizado: {formatDateTime(location.updatedAt)}
                          </p>
                        </div>

                        <div
                          className="location-item-actions"
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 8,
                            justifyContent: 'flex-end',
                            flexShrink: 0,
                          }}
                        >
                          {!location.isDefault && location.isActive && (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => handleSetDefault(location.id)}
                              style={{ height: 36, padding: '0 11px' }}
                            >
                              <Star size={14} />
                              Default
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => startEdit(location)}
                            style={{ height: 36, padding: '0 11px' }}
                          >
                            <Edit2 size={14} />
                            Editar
                          </button>

                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => handleDelete(location)}
                            style={{ height: 36, padding: '0 11px' }}
                          >
                            <Trash2 size={14} />
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </div>


      <style jsx global>{`
        @media (max-width: 768px) {
          .locations-page {
            gap: 14px !important;
          }

          .locations-page .card {
            border-radius: 18px !important;
          }

          .locations-page section.card,
          .locations-list-card {
            padding: 16px !important;
          }

          .locations-stats {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .locations-stats .card {
            padding: 14px !important;
          }

          .locations-main-grid {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
          }

          .locations-form {
            min-width: 0 !important;
          }

          .location-street-grid,
          .location-two-grid,
          .location-toggle-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .location-form-actions {
            flex-direction: column !important;
          }

          .location-form-actions .btn {
            width: 100% !important;
            justify-content: center !important;
          }

          .locations-list-header {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }

          .locations-filter-toggle {
            width: 100% !important;
            justify-content: center !important;
            text-align: center !important;
            min-height: 36px !important;
          }

          .location-item-main {
            flex-direction: column !important;
            gap: 14px !important;
          }

          .location-item-main > div:first-child {
            width: 100% !important;
          }

          .location-item-main h4 {
            white-space: normal !important;
            overflow: visible !important;
            text-overflow: unset !important;
            overflow-wrap: anywhere !important;
            line-height: 1.25 !important;
          }

          .location-item-actions {
            width: 100% !important;
            display: grid !important;
            grid-template-columns: 1fr !important;
            justify-content: stretch !important;
            flex-shrink: 1 !important;
          }

          .location-item-actions .btn {
            width: 100% !important;
            justify-content: center !important;
          }

          .locations-page .input {
            width: 100% !important;
            min-width: 0 !important;
          }

          .locations-page .badge {
            max-width: 100% !important;
          }

          .modal {
            width: calc(100vw - 28px) !important;
            max-width: calc(100vw - 28px) !important;
            margin: 14px !important;
          }

          .modal-footer {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .modal-footer .btn {
            width: 100% !important;
            justify-content: center !important;
          }
        }

        @media (max-width: 420px) {
          .locations-page section.card,
          .locations-list-card {
            padding: 14px !important;
          }

          .locations-page .card {
            border-radius: 16px !important;
          }

          .locations-page .btn {
            min-height: 40px !important;
          }
        }
      `}</style>


      {confirmModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (confirmLoading) return;
            if (e.target === e.currentTarget) setConfirmModal(null);
          }}
        >
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <b>{confirmModal.title}</b>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => !confirmLoading && setConfirmModal(null)}
                disabled={confirmLoading}
              >
                <XCircle size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: confirmModal.danger
                      ? 'rgba(239,68,68,0.12)'
                      : 'var(--surface2)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AlertCircle
                    size={18}
                    style={{
                      color: confirmModal.danger ? '#dc2626' : 'var(--accent)',
                    }}
                  />
                </span>

                <p
                  style={{
                    color: 'var(--text2)',
                    fontSize: 13,
                    lineHeight: 1.55,
                    margin: 0,
                  }}
                >
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmModal(null)}
                disabled={confirmLoading}
              >
                Cancelar
              </button>

              <button
                className={confirmModal.danger ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={confirmAction}
                disabled={confirmLoading}
              >
                {confirmLoading ? <span className="spinner" /> : confirmModal.confirmText ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}