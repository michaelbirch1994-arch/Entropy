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

export function normalizeAxiForgeCodecCode(code: string): string {
  const trimmed = code.trim();
  return replacePrefix(
    replacePrefix(trimmed, ENTROPY_BUILD_PREFIX, AXIFORGE_BUILD_PREFIX),
    ENTROPY_COMP_PREFIX,
    AXIFORGE_COMP_PREFIX,
  );
}
