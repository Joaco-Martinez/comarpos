import { CheckCircle2, FileKey2, KeyRound, Loader2, Trash2 } from 'lucide-react';
import { DropInput, Field, InfoBox, Panel, ui } from './arca.ui';

export function ArcaCertificatePanel({
  certLoaded,
  certText,
  keyText,
  certExpiresAt,
  saving,
  onCertTextChange,
  onKeyTextChange,
  onCertExpiresAtChange,
  onSave,
  onDelete,
}: {
  certLoaded: boolean;
  certText: string;
  keyText: string;
  certExpiresAt: string;
  saving: boolean;
  onCertTextChange: (value: string) => void;
  onKeyTextChange: (value: string) => void;
  onCertExpiresAtChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <Panel
      title="Certificado y private key"
      description="Archivos necesarios para autenticarse contra WSAA. Se guardan cifrados en el backend."
      icon={KeyRound}
      action={
        certLoaded ? (
          <button type="button" onClick={onDelete} disabled={saving} className={ui.dangerBtn}>
            {saving ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
            Eliminar
          </button>
        ) : undefined
      }
    >
      <div className="mb-5">
        {certLoaded ? (
          <InfoBox tone="success" icon={CheckCircle2}>
            El certificado y la private key ya están cargados. Si querés reemplazarlos, podés eliminarlos y cargar nuevos archivos.
          </InfoBox>
        ) : (
          <InfoBox tone="danger" icon={FileKey2}>
            Falta cargar el certificado y la private key. Sin estos archivos no se puede obtener token ni firmar solicitudes.
          </InfoBox>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <DropInput label="Certificado .crt / .pem" accept=".crt,.pem,.cer,.txt" value={certText} onFileText={onCertTextChange} />
        <DropInput label="Private key .key / .pem" accept=".key,.pem,.txt" value={keyText} onFileText={onKeyTextChange} />
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Field label="Contenido del certificado">
          <textarea className={ui.textarea} value={certText} onChange={(e) => onCertTextChange(e.target.value)} placeholder="-----BEGIN CERTIFICATE-----" />
        </Field>

        <Field label="Contenido de la private key">
          <textarea className={ui.textarea} value={keyText} onChange={(e) => onKeyTextChange(e.target.value)} placeholder="-----BEGIN PRIVATE KEY-----" />
        </Field>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[260px_1fr] md:items-end">
        <Field label="Vencimiento del certificado">
          <input type="date" className={ui.input} value={certExpiresAt} onChange={(e) => onCertExpiresAtChange(e.target.value)} />
        </Field>

        <button type="button" onClick={onSave} disabled={saving} className={ui.primaryBtn}>
          {saving ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}
          Guardar certificado
        </button>
      </div>
    </Panel>
  );
}
