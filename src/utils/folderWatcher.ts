// Local arcdps log-folder watcher, built on the browser's File System Access API.
//
// There is no way for a web app to get silent, standing access to a hardcoded
// path like `...\arcdps.cbtlogs` - browsers require an explicit, one-time user
// gesture (a native folder picker + permission prompt) before a page can touch
// anything on disk. Once granted, we persist the resulting FileSystemDirectoryHandle
// in IndexedDB so the same folder can be reconnected without re-picking it every
// visit (Chromium remembers the permission grant across reloads/restarts for the
// same origin+handle). Polling for new files only happens while a tab with
// Entropy open is active - browsers do not allow background/ambient filesystem
// watching once the tab or app is closed.

const DB_NAME = "entropy-fs-handles";
const STORE_NAME = "handles";
const HANDLE_KEY = "logFolder";
const SEEN_FILES_KEY = "entropy-seen-log-files";
const SEEN_FILES_LIMIT = 1000;
const LOG_FILE_RE = /\.(zevtc|evtc)(\.zip)?$/i;

export interface ScannedLogFile {
  file: File;
  path: string;
}

export function isFolderWatchSupported(): boolean {
  return typeof window !== "undefined" && typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveHandle(handle: any): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadHandle(): Promise<any | null> {
  const db = await openDb();
  const result = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result ?? null;
}

export async function clearFolderHandle(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkPermission(handle: any, requestIfNeeded: boolean): Promise<boolean> {
  const opts = { mode: "read" as const };
  try {
    if ((await handle.queryPermission(opts)) === "granted") return true;
    if (requestIfNeeded && (await handle.requestPermission(opts)) === "granted") return true;
  } catch {
    return false;
  }
  return false;
}

// Opens the native folder picker (must be called from a user gesture) and
// persists the resulting handle for future sessions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function pickLogFolder(): Promise<any> {
  const w = window as unknown as { showDirectoryPicker: (opts?: Record<string, unknown>) => Promise<unknown> };
  const handle = await w.showDirectoryPicker({ id: "entropy-arcdps-logs", mode: "read" });
  await saveHandle(handle);
  return handle;
}

// Returns a previously-connected folder handle, if any (does not itself
// prompt for permission - caller should check checkPermission separately).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSavedFolderHandle(): Promise<any | null> {
  return loadHandle();
}

// Recursively scans a directory for .zevtc/.evtc files. arcdps nests logs as
// <cbtlogs>/<map name>/<timestamp>-*.zevtc, so we walk a few levels deep.
export async function scanForLogFiles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dirHandle: any,
  maxDepth = 3
): Promise<ScannedLogFile[]> {
  const out: ScannedLogFile[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function walk(handle: any, path: string, depth: number) {
    for await (const [name, entry] of handle.entries()) {
      const entryPath = path ? `${path}/${name}` : name;
      if (entry.kind === "file") {
        if (LOG_FILE_RE.test(name)) {
          try {
            const file = await entry.getFile();
            out.push({ file, path: entryPath });
          } catch {
            // Unreadable file (e.g. locked while arcdps is still writing it) - skip for now.
          }
        }
      } else if (entry.kind === "directory" && depth < maxDepth) {
        await walk(entry, entryPath, depth + 1);
      }
    }
  }

  await walk(dirHandle, "", 0);
  return out;
}

// Tracks which files we've already auto-imported (by path + size + last
// modified time) so re-scans only surface genuinely new logs.
export function loadSeenFileKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_FILES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

export function saveSeenFileKeys(keys: Set<string>): void {
  try {
    const arr = Array.from(keys);
    const trimmed = arr.length > SEEN_FILES_LIMIT ? arr.slice(arr.length - SEEN_FILES_LIMIT) : arr;
    localStorage.setItem(SEEN_FILES_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage unavailable/full - non-fatal, just means we might re-import a file.
  }
}

export function fileKey(scanned: ScannedLogFile): string {
  return `${scanned.path}:${scanned.file.size}:${scanned.file.lastModified}`;
}
