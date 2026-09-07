import { getConfiguredShareViewerUrl } from "../shareLinks";
import { brandEntropyCode } from "./axiForgeAdapter";

export function buildAxiForgeShareUrl(code: string, currentHref?: string): string {
  if (typeof window === "undefined" && !currentHref) return brandEntropyCode(code);
  const url = new URL(getConfiguredShareViewerUrl(currentHref));
  url.search = "";
  url.hash = "";
  url.searchParams.set("view", "entropy-builder");
  url.searchParams.set("entropy", brandEntropyCode(code));
  return url.toString();
}

export function parseAxiForgeShareQuery(search: string): string | null {
  const params = new URLSearchParams(search);
  const code = params.get("entropy") ?? params.get("axi");
  return code && code.trim().length > 0 ? code.trim() : null;
}

export function clearAxiForgeShareQuery(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("entropy") && !url.searchParams.has("axi")) return;
  url.searchParams.delete("entropy");
  url.searchParams.delete("axi");
  window.history.replaceState(null, "", url.toString());
}
