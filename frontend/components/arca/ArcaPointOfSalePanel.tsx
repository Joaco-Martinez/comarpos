import { AlertCircle, Check, Loader2, Plus, ServerCog, Trash2 } from 'lucide-react';
import type { ArcaPointOfSale } from '@/types/arca';
import { CBTE_TYPES } from './arca.constants';
import { Field, Panel, ui } from './arca.ui';
import { onlyDigits } from './arca.utils';

type PointForm = {
  number: string;
  description: string;
  isDefault: boolean;
  enabled: boolean;
  enabledCbteTypes: number[];
};

function ToggleChip({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        'inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition',
        checked ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100',
      ].join(' ')}
    >
      {checked ? <Check size={15} /> : <AlertCircle size={15} />}
      {label}
    </button>
  );
}

function CbteButton({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'rounded-2xl border px-3 py-3 text-center text-sm font-bold transition',
        checked ? 'border-indigo-400/30 bg-indigo-500/15 text-indigo-200 ring-2 ring-indigo-500/15' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

export function ArcaPointOfSalePanel({
  points,
  pointForm,
  saving,
  onChange,
  onToggleCbte,
  onSave,
  onDelete,
}: {
  points: ArcaPointOfSale[];
  pointForm: PointForm;
  saving: boolean;
  onChange: (form: PointForm) => void;
  onToggleCbte: (id: number) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Panel title="Puntos de venta" description="Configurá el punto de venta habilitado en ARCA para emitir mediante Web Service." icon={ServerCog}>
      <div className="grid gap-5 md:grid-cols-[170px_1fr]">
        <Field label="Número">
          <input className={ui.input} value={pointForm.number} onChange={(e) => onChange({ ...pointForm, number: onlyDigits(e.target.value) })} placeholder="Ej: 5" inputMode="numeric" />
        </Field>

        <Field label="Descripción">
          <input className={ui.input} value={pointForm.description} onChange={(e) => onChange({ ...pointForm, description: e.target.value })} placeholder="Punto de venta Web Service" />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <ToggleChip checked={pointForm.isDefault} label="Usar como default" onChange={(value) => onChange({ ...pointForm, isDefault: value })} />
        <ToggleChip checked={pointForm.enabled} label="Habilitado" onChange={(value) => onChange({ ...pointForm, enabled: value })} />
      </div>

      <div className="my-6 border-t border-slate-200" />

      <label className={ui.label}>Comprobantes habilitados</label>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {CBTE_TYPES.map((cbte) => (
          <CbteButton key={cbte.id} label={cbte.label} checked={pointForm.enabledCbteTypes.includes(cbte.id)} onToggle={() => onToggleCbte(cbte.id)} />
        ))}
      </div>

      <div className="mt-6">
        <button type="button" onClick={onSave} disabled={saving} className={ui.secondaryBtn}>
          {saving ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />}
          Agregar punto de venta
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Número</th>
                <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Descripción</th>
                <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Estado</th>
                <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Tipos</th>
                <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Acción</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10 bg-[#ffffff]">
              {points.length > 0 ? (
                points.map((point) => (
                  <tr key={point.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4 font-mono text-base font-black text-slate-900">{String(point.number).padStart(4, '0')}</td>
                    <td className="px-5 py-4 font-medium text-slate-600">{point.description || '—'}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {point.isDefault ? <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-200">Default</span> : null}
                        <span className={['rounded-full px-3 py-1 text-xs font-bold', point.enabled ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-700' : 'border border-slate-200 bg-slate-50 text-slate-500'].join(' ')}>
                          {point.enabled ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-500">{point.enabledCbteTypes?.join(', ') || '—'}</td>
                    <td className="px-5 py-4 text-right">
                      <button type="button" onClick={() => onDelete(point.id)} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-700" title="Eliminar">
                        <Trash2 size={17} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 text-slate-500">
                        <ServerCog size={24} />
                      </div>
                      <p className="font-black text-slate-900">Sin puntos de venta</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-500">Agregá el punto de venta Web Service que configuraste en ARCA.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}
