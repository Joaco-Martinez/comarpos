export function getParamAsString(value: unknown, name = "param"): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
    return value[0];
  }

  throw new Error(`${name} inválido o faltante`);
}