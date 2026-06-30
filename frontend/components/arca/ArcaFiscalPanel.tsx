import { Building2, Loader2, Save, ShieldCheck } from 'lucide-react';
import type { ArcaConfigPayload } from '@/types/arca';
import { IVA_CONDITIONS } from './arca.constants';
import { Field, InfoBox, Panel, ui } from './arca.ui';
import { onlyDigits } from './arca.utils';

export function ArcaFiscalPanel({
  form,
  saving,
  onChange,
  onSave,
}: {
  form: ArcaConfigPayload;
  saving: boolean;
  onChange: (form: ArcaConfigPayload) => void;
  onSave: () => void;
}) {
  return (
    <Panel
      title="Datos fiscales"
      description="Información del contribuyente que emite los comprobantes."
      icon={Building2}
      action={
        <button type="button" onClick={onSave} disabled={saving} className={ui.primaryBtn}>
          {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
          Guardar datos
        </button>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Razón social">
          <input className={ui.input} value={form.businessName || ''} onChange={(e) => onChange({ ...form, businessName: e.target.value })} placeholder="Nombre del negocio" />
        </Field>

        <Field label="CUIT" hint="Ingresá solo números. Deben ser 11 dígitos.">
          <input className={ui.input} value={form.cuit || ''} onChange={(e) => onChange({ ...form, cuit: onlyDigits(e.target.value).slice(0, 11) })} placeholder="30711222333" inputMode="numeric" />
        </Field>

        <Field label="Condición IVA">
          <select className={ui.input} value={form.ivaCondition || ''} onChange={(e) => onChange({ ...form, ivaCondition: e.target.value })}>
            {IVA_CONDITIONS.map((condition) => (
              <option key={condition} value={condition} className="bg-[#ffffff] text-slate-900">
                {condition}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Inicio de actividades">
          <input type="date" className={ui.input} value={String(form.activityStart || '')} onChange={(e) => onChange({ ...form, activityStart: e.target.value })} />
        </Field>

        <Field label="Domicilio fiscal">
          <input className={ui.input} value={form.fiscalAddress || ''} onChange={(e) => onChange({ ...form, fiscalAddress: e.target.value })} placeholder="Domicilio declarado en ARCA" />
        </Field>

        <Field label="Ambiente">
          <select className={ui.input} value={form.environment || 'HOMOLOGACION'} onChange={(e) => onChange({ ...form, environment: e.target.value as any })}>
            <option value="HOMOLOGACION" className="bg-[#ffffff] text-slate-900">Homologación / pruebas</option>
            <option value="PRODUCCION" className="bg-[#ffffff] text-slate-900">Producción / real</option>
          </select>
        </Field>
      </div>

      <div className="mt-5">
        <InfoBox tone="warning" icon={ShieldCheck}>
          Este negocio no necesita cargar usuario ni clave fiscal. Este módulo trabaja con certificado digital, private key y punto de venta Web Service.
        </InfoBox>
      </div>
    </Panel>
  );
}
