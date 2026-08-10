declare module "@axiapps/code" {
  export function decodeCompCode(code: string): unknown;
  export function decodeShareCode(code: string): unknown;
  export function encodeCompCode(comp: never): string;
  export function encodeShareCode(build: never): string;
  export function isValidCompCode(code: string): boolean;
  export function isValidShareCode(code: string): boolean;
}
