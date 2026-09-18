/** Accepts the ArcDPS encounter formats supported by Entropy's importer. */
export function isRawLogFile(file: Pick<File, "name">): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".zevtc") || name.endsWith(".evtc") || name.endsWith(".evtc.zip");
}
