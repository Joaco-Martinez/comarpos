import {
  Activity,
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileKey2,
  FileText,
  Landmark,
  Loader2,
  PlugZap,
  ShieldCheck,
  TestTube2,
  Wifi,
} from 'lucide-react';
import type { ArcaConfig, ArcaConfigPayload, ArcaPointOfSale } from '@/types/arca';
import { Panel, StatusPill, toneStyles } from './arca.ui';
import { formatDate, getStatusMeta } from './arca.utils';

export function ArcaSidebar({
  config,
  form,
  certLoaded,
  defaultPoint,
  checklist,
  progress,
  testing,
  onTest,
}: {
  config: ArcaConfig | null;
  form: ArcaConfigPayload;
  certLoaded: boolean;
  defaultPoint?: ArcaPointOfSale;
  checklist: { ok: boolean; text: string }[];
  progress: number;
  testing: 'wsaa' | 'wsfe' | null;
  onTest: (type: 'wsaa' | 'wsfe') => void;
}) {
  const status = getStatusMeta(config);
  const StatusIcon = status.icon;

  return (
    <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
      <Panel title="Estado general" description="Resumen rápido de la configuración actual." icon={Activity}>
        <div className="mb-5 flex items-start gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${toneStyles[status.tone].icon}`}>
            <StatusIcon size={22} />
          </div>
          <div>
            <div className="mb-2"><StatusPill tone={status.tone}>{status.label}</StatusPill></div>
            <p className="text-lg font-black text-slate-900">{status.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">{status.description}</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <InfoRow label="Razón social" value={form.businessName || '—'} />
          <InfoRow label="Punto default" value={defaultPoint ? String(defaultPoint.number).padStart(4, '0') : '—'} mono />
          <InfoRow label="Certificado" value={certLoaded ? 'Cargado' : 'Faltante'} />
          <InfoRow label="Vencimiento" value={config?.certExpiresAt ? formatDate(config.certExpiresAt) : 'Sin dato'} />
        </div>
      </Panel>

      <Panel title="Pruebas de conexión" description="Validá WSAA y WSFE antes de emitir comprobantes." icon={TestTube2}>
        <div className="space-y-3">
          <TestButton label="Probar WSAA" icon={PlugZap} loading={testing === 'wsaa'} disabled={testing !== null || !config} onClick={() => onTest('wsaa')} />
          <TestButton label="Probar WSFE / FEDummy" icon={Wifi} loading={testing === 'wsfe'} disabled={testing !== null || !config} onClick={() => onTest('wsfe')} />
        </div>

        <div className="mt-5 rounded-3xl border border-slate-200 bg-[#ffffff] p-4">
          <div className="space-y-3">
            <SmallRow label="Último token" value={formatDate(config?.lastTokenAt)} />
            <SmallRow label="Último test" value={formatDate(config?.lastCheckAt)} />
            <SmallRow label="Ambiente actual" value={form.environment === 'PRODUCCION' ? 'Producción' : 'Homologación'} />
          </div>
        </div>
      </Panel>

      <Panel title="Checklist" description="Todo lo necesario para activar ARCA." icon={ClipboardCheck}>
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-500">Progreso de activación</span>
            <span className="text-sm font-black text-indigo-700">{progress}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="space-y-3">
          {checklist.map((item) => (
            <div key={item.text} className={['flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold', item.ok ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'].join(' ')}>
              {item.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-700" /> : <AlertCircle size={18} className="mt-0.5 shrink-0 text-slate-500" />}
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Cómo preparar ARCA" description="Pasos recomendados del lado fiscal." icon={ShieldCheck}>
        <ol className="space-y-3">
          {[
            { icon: Landmark, text: 'Ingresá a ARCA con CUIT y clave fiscal.' },
            { icon: FileText, text: 'Habilitá Administración de Certificados Digitales.' },
            { icon: FileKey2, text: 'Asociá el certificado al servicio WSFE.' },
            { icon: BadgeCheck, text: 'Verificá que el punto de venta sea Web Service.' },
            { icon: CalendarDays, text: 'Cargá certificado, private key y vencimiento desde este panel.' },
          ].map((step, index) => {
            const StepIcon = step.icon;
            return (
              <li key={step.text} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-[#ffffff] text-indigo-700">
                  <StepIcon size={17} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-700">Paso {index + 1}</p>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-600">{step.text}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>
    </aside>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-[#ffffff] px-4 py-3">
      <span className="font-bold text-slate-500">{label}</span>
      <span className={`text-right font-black text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function SmallRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-bold text-slate-500">{label}</span>
      <span className="text-right font-mono text-xs font-bold text-slate-700">{value}</span>
    </div>
  );
}

function TestButton({ label, icon: Icon, loading, disabled, onClick }: { label: string; icon: any; loading: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
      <span className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-[#ffffff] text-indigo-700">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
        </span>
        {label}
      </span>
      <ChevronRight size={18} className="text-slate-500" />
    </button>
  );
}
