const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toValidDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function datePartsAR(value: string | Date = new Date()) {
  const date = toValidDate(value) ?? new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ARGENTINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';

  return { year, month, day };
}

export function todayInputAR() {
  const { year, month, day } = datePartsAR();
  return `${year}-${month}-${day}`;
}

export function firstDayOfCurrentMonthAR() {
  const { year, month } = datePartsAR();
  return `${year}-${month}-01`;
}

export function toDateInputAR(value?: string | Date | null) {
  if (!value) return '';

  if (typeof value === 'string' && ISO_DATE_RE.test(value.slice(0, 10))) {
    return value.slice(0, 10);
  }

  const date = toValidDate(value);
  if (!date) return '';

  const { year, month, day } = datePartsAR(date);
  return `${year}-${month}-${day}`;
}

export function startOfDayAR(value: string | Date) {
  const input = typeof value === 'string' && ISO_DATE_RE.test(value.slice(0, 10))
    ? value.slice(0, 10)
    : toDateInputAR(value);

  return new Date(`${input}T00:00:00.000-03:00`);
}

export function endOfDayAR(value: string | Date) {
  const input = typeof value === 'string' && ISO_DATE_RE.test(value.slice(0, 10))
    ? value.slice(0, 10)
    : toDateInputAR(value);

  return new Date(`${input}T23:59:59.999-03:00`);
}

export function compareDateInputsAR(a: string, b: string) {
  return startOfDayAR(a).getTime() - startOfDayAR(b).getTime();
}

export function isSameDayAR(a?: string | Date | null, b?: string | Date | null) {
  if (!a || !b) return false;
  return toDateInputAR(a) === toDateInputAR(b);
}

export function formatDateAR(value?: string | Date | null) {
  const date = toValidDate(value);
  if (!date) return '—';

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ARGENTINA_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatDateTimeAR(value?: string | Date | null) {
  const date = toValidDate(value);
  if (!date) return '—';

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ARGENTINA_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatShortDateAR(value?: string | Date | null) {
  const date = toValidDate(value);
  if (!date) return '—';

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ARGENTINA_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}
