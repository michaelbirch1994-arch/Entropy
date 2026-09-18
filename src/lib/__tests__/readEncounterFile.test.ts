import { expect, it } from 'vitest';
import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js';
import { readEncounterFile } from '../insight/readEncounterFile';
async function archive(contents: string[]) {
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
  for (const [i, text] of contents.entries()) await writer.add(`${i}.evtc`, new BlobReader(new Blob([text])));
  return writer.close();
}
it('reads uncompressed and compressed EVTC identically', async () => {
  const original = 'EVTCtest';
  expect(new TextDecoder().decode(await readEncounterFile(new Blob([original])))).toBe(original);
  expect(new TextDecoder().decode(await readEncounterFile(await archive([original])))).toBe(original);
});
it('rejects multiple files, nonlogs and excessive expanded size', async () => {
  await expect(readEncounterFile(await archive(['EVTCa', 'EVTCb']))).rejects.toThrow(/exactly one/);
  await expect(readEncounterFile(await archive(['not a log']))).rejects.toThrow(/does not contain/);
  await expect(readEncounterFile(await archive(['EVTC' + 'x'.repeat(5000)]), 1000)).rejects.toThrow(/oversized/);
});
