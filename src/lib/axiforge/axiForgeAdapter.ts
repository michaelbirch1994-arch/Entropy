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

const ENTROPY_BUILD_PREFIX = "<Entropy:Build:";
const ENTROPY_COMP_PREFIX = "<Entropy:Comp:";
const AXIFORGE_BUILD_PREFIX = "<AxiForge:Build:";
const AXIFORGE_COMP_PREFIX = "<AxiForge:Comp:";

function replacePrefix(code: string, from: string, to: string): string {
  return code.startsWith(from) ? `${to}${code.slice(from.length)}` : code;
}

export function brandEntropyCode(code: string): string {
  const trimmed = code.trim();
  return replacePrefix(
    replacePrefix(trimmed, AXIFORGE_BUILD_PREFIX, ENTROPY_BUILD_PREFIX),
    AXIFORGE_COMP_PREFIX,
    ENTROPY_COMP_PREFIX,
  );
}

function normalizeCodecCode(code: string): string {
  const trimmed = code.trim();
  return replacePrefix(
    replacePrefix(trimmed, ENTROPY_BUILD_PREFIX, AXIFORGE_BUILD_PREFIX),
    ENTROPY_COMP_PREFIX,
    AXIFORGE_COMP_PREFIX,
  );
}

export function detectAxiForgeCodeKind(code: string): AxiForgeCodeKind {
  const trimmed = normalizeCodecCode(code);

  if (isValidCompCode(trimmed)) return "comp";
  if (isValidShareCode(trimmed)) return "build";

  return "unknown";
}

export function decodeAxiForgeCode(code: string): AxiForgeDecodeResult {
  const trimmed = normalizeCodecCode(code);
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
      error: "Unsupported build code format.",
    };
  } catch (error) {
    return {
      ok: false,
      kind,
      value: null,
      error: error instanceof Error ? error.message : "Failed to decode build code.",
    };
  }
}

export function encodeAxiForgeBuildCode(build: unknown): string {
  return brandEntropyCode(encodeShareCode(build as never));
}

export function encodeAxiForgeCompCode(comp: unknown, builds: Record<string, unknown>): string | null {
  const code = encodeCompCode(comp as never, builds as never);
  return code ? brandEntropyCode(code) : null;
}
