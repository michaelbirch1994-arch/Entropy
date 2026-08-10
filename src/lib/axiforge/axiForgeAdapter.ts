import {
  decodeCompCode,
  decodeShareCode,
  encodeCompCode,
  encodeShareCode,
  isValidCompCode,
  isValidShareCode,
} from "@axiapps/code";

export type AxiForgeCodeKind = "build" | "comp" | "unknown";

export interface AxiForgeDecodeResult {
  ok: boolean;
  kind: AxiForgeCodeKind;
  value: unknown | null;
  error: string | null;
}

export function detectAxiForgeCodeKind(code: string): AxiForgeCodeKind {
  const trimmed = code.trim();

  if (isValidCompCode(trimmed)) return "comp";
  if (isValidShareCode(trimmed)) return "build";

  return "unknown";
}

export function decodeAxiForgeCode(code: string): AxiForgeDecodeResult {
  const trimmed = code.trim();
  const kind = detectAxiForgeCodeKind(trimmed);

  try {
    if (kind === "comp") {
      return {
        ok: true,
        kind,
        value: decodeCompCode(trimmed),
        error: null,
      };
    }

    if (kind === "build") {
      return {
        ok: true,
        kind,
        value: decodeShareCode(trimmed),
        error: null,
      };
    }

    return {
      ok: false,
      kind: "unknown",
      value: null,
      error: "Unsupported AxiForge code format.",
    };
  } catch (error) {
    return {
      ok: false,
      kind,
      value: null,
      error: error instanceof Error ? error.message : "Failed to decode AxiForge code.",
    };
  }
}

export function encodeAxiForgeBuildCode(build: unknown): string {
  return encodeShareCode(build as never);
}

export function encodeAxiForgeCompCode(comp: unknown): string {
  return encodeCompCode(comp as never);
}
