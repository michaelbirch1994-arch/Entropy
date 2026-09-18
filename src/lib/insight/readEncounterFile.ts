import { BlobReader, ZipReader } from '@zip.js/zip.js';

export async function readEncounterFile(file: Blob, limit = 150000000): Promise<ArrayBuffer> {
  if (file.size > limit) throw new Error('Encounter file exceeds the 150 MB limit.');
  const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (new TextDecoder().decode(signature) === 'EVTC') return file.arrayBuffer();
  if (signature[0] !== 80 || signature[1] !== 75) throw new Error('Select an EVTC or ZEVTC combat log.');
  const reader = new ZipReader(new BlobReader(file), { useWebWorkers: false });
  try {
    const entries = await reader.getEntries();
    if (entries.length !== 1 || entries[0].directory) throw new Error('Expected exactly one combat log in the archive.');
    const entry = entries[0];
    if (entry.encrypted || !Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize > limit) throw new Error('Encrypted or oversized encounter archive.');
    const chunks: Uint8Array[] = []; let length = 0;
    // Enforce the actual expanded size too; archive metadata is untrusted.
    await entry.getData(new WritableStream<Uint8Array>({ write(chunk) {
      length += chunk.length;
      if (length > limit) throw new Error('Expanded encounter exceeds the size limit.');
      chunks.push(chunk.slice());
    } }), { checkSignature: true });
    const result = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    if (new TextDecoder().decode(result.subarray(0, 4)) !== 'EVTC') throw new Error('Archive does not contain an EVTC log.');
    return result.buffer;
  } finally { await reader.close(); }
}
