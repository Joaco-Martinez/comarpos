export function isAfipUnavailable(err: any) {
  const status = err?.response?.status;
  const data = err?.response?.data;

  const htmlUnavailable =
    typeof data === "string" && data.toLowerCase().includes("service unavailable");

  return (
    status === 503 ||
    status === 502 ||
    status === 504 ||
    htmlUnavailable ||
    err?.code === "ETIMEDOUT" ||
    err?.code === "ECONNRESET" ||
    err?.code === "ECONNABORTED"
  );
}
