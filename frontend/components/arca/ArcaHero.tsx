import { FileKey2, Landmark, Loader2, RefreshCw, ServerCog, Zap } from 'lucide-react';
import type { ArcaConfig, ArcaConfigPayload } from '@/types/arca';
import { MetricCard, StatusPill, ui } from './arca.ui';
import { getStatusMeta, maskCuit, onlyDigits } from './arca.utils';

export function ArcaHero({
  config,
  form,
  certLoaded,
  loading,
  saving,
  onRefresh,
  onActivate,
}: {
  config: ArcaConfig | null;
  form: ArcaConfigPayload;
  certLoaded: boolean;
  loading: boolean;
  saving: boolean;
  onRefresh: () => void;
  onActivate: () => void;
}) {
  const status = getStatusMeta(config);
  const StatusIcon = status.icon;

  return (
    <div className="mb-6 overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.22),_transparent_32%),linear-gradient(180deg,#eef2f7_0%,#ffffff_100%)] shadow-[0_12px_40px_rgba(17,24,39,0.12)]">
      <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-white text-[#111827] shadow-lg">
            <span className="text-sm font-black tracking-tight">ARCA</span>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Facturación electrónica</h1>
              <StatusPill tone={status.tone}>{status.label}</StatusPill>
            </div>

            <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
              Configurá los datos fiscales, cargá el certificado digital, definí el punto de venta y validá la conexión con ARCA.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onRefresh} disabled={loading} className={ui.secondaryBtn}>
            {loading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
            Actualizar
          </button>

          <button type="button" onClick={onActivate} disabled={saving || loading} className={ui.primaryBtn}>
            {saving ? <Loader2 size={17} className="animate-spin" /> : <Zap size={17} />}
            Activar ARCA
          </button>
        </div>
      </div>

      <div className="border-t border-slate-200 px-6 pb-6 pt-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Estado" value={status.title} icon={StatusIcon} badge={<StatusPill tone={status.tone}>{status.label}</StatusPill>} />
          <MetricCard
            label="CUIT"
            value={maskCuit(config?.cuit || form.cuit)}
            icon={Landmark}
            badge={onlyDigits(String(form.cuit || '')).length === 11 ? <StatusPill tone="success">Completo</StatusPill> : <StatusPill tone="warning">Pendiente</StatusPill>}
          />
          <MetricCard
            label="Ambiente"
            value={form.environment === 'PRODUCCION' ? 'Producción' : 'Homologación'}
            icon={ServerCog}
            badge={form.environment === 'PRODUCCION' ? <StatusPill tone="danger">Real</StatusPill> : <StatusPill tone="warning">Pruebas</StatusPill>}
          />
          <MetricCard
            label="Certificado"
            value={certLoaded ? 'Cargado' : 'Faltante'}
            icon={FileKey2}
            badge={certLoaded ? <StatusPill tone="success">OK</StatusPill> : <StatusPill tone="danger">Pendiente</StatusPill>}
          />
        </div>
      </div>
    </div>
  );
}
