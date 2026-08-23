export function buildAxiForgeShareUrl(code: string): string {
  if (typeof window === "undefined") return code;
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set("axi", code);
  return url.toString();
}

export function parseAxiForgeShareQuery(search: string): string | null {
  const params = new URLSearchParams(search);
  const code = params.get("axi");
  return code && code.trim().length > 0 ? code.trim() : null;
}

export function clearAxiForgeShareQuery(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("axi")) return;
  url.searchParams.delete("axi");
  window.history.replaceState(null, "", url.toString());
}
