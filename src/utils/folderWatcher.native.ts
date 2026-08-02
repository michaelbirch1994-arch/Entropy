// Tauri-native implementation of the log-folder watcher. Mirrors the
// browser File System Access API version in folderWatcher.ts function-for-
// function so RawLogImporter.tsx can use either one through
// folderWatcherFacade.ts without caring which runtime it's in.
//
// Why this exists: folderWatcher.ts's showDirectoryPicker() only exists in
// Chromium. Tauri's webview is platform-native (WebView2 on Windows,
// WKWebView on macOS, WebKitGTK on Linux) so that API is Windows-only there
// too - same limitation as a regular browser. Tauri's Rust-backed fs/dialog
// plugins don't depend on the webview engine at all, so this version works
// identically on every platform, and the picked folder path is durable -
// no per-origin permission re-grant dance, no risk of a browser silently
// invalidating a stale handle across restarts.
//
// One behavioral difference from the web version worth knowing about:
// scanForLogFiles() here eagerly reads full file bytes for every matched
// log on every poll (Tauri's fs plugin has no lazy-File equivalent to the
// browser's FileSystemFileHandle.getFile()), so it does more I/O per scan
// than the web version. Fine for typical arcdps log folder sizes, but if
// this becomes a bottleneck the fix is to switch fileKey() generation to
// use stat() (path+size+mtime) without reading bytes, and only call
// readFile() for genuinely-new files right before upload.
import { open } from "@tauri-apps/plugin-dialog";
import { readDir, readFile, stat } from "@tauri-apps/plugin-fs";

const PATH_KEY = "entropy-native-log-folder";
const SEEN_FILES_KEY = "entropy-seen-log-files";
const SEEN_FILES_LIMIT = 1000;
const LOG_FILE_RE = /\.(zevtc|evtc)(\.zip)?$/i;

export interface ScannedLogFile {
  file: File;
  path: string;
}

export function isFolderWatchSupported(): boolean {
  return true; // always available inside the packaged desktop app
}

// Opens the native OS folder picker and persists the chosen path.
export async function pickLogFolder(): Promise<string> {
  const selected = await open({ directory: true, title: "Select your arcdps cbtlogs folder" });
  if (!selected || Array.isArray(selected)) throw new Error("No folder selected");
  localStorage.setItem(PATH_KEY, selected);
  return selected;
}

export async function getSavedFolderHandle(): Promise<string | null> {
  return localStorage.getItem(PATH_KEY);
}

// Tauri's fs access is granted at the OS/app-capability level rather than
// per-directory like the browser's handle permissions - if we have a saved
// path at all, we can read it. No separate grant/re-grant flow needed.
export async function checkPermission(_handle: string, _requestIfNeeded: boolean): Promise<boolean> {
  return true;
}

export async function clearFolderHandle(): Promise<void> {
  localStorage.removeItem(PATH_KEY);
}

async function walk(dir: string, depth: number, maxDepth: number, out: ScannedLogFile[]): Promise<void> {
  const entries = await readDir(dir);
  for (const entry of entries) {
    const entryPath = `${dir}/${entry.name}`;
    if (entry.isFile && LOG_FILE_RE.test(entry.name)) {
      try {
        const bytes = await readFile(entryPath);
        const s = await stat(entryPath);
        const lastModified = s.mtime ? new Date(s.mtime).getTime() : Date.now();
        const file = new File([bytes], entry.name, { lastModified });
        out.push({ file, path: entryPath });
      } catch {
        // Unreadable (e.g. still being written by arcdps) - skip for now.
      }
    } else if (entry.isDirectory && depth < maxDepth) {
      await walk(entryPath, depth + 1, maxDepth, out);
    }
  }
}

// arcdps nests logs as <cbtlogs>/<map name>/<timestamp>-*.zevtc, so we walk
// a few levels deep - same default as the web version.
export async function scanForLogFiles(dirPath: string, maxDepth = 3): Promise<ScannedLogFile[]> {
  const out: ScannedLogFile[] = [];
  await walk(dirPath, 0, maxDepth, out);
  return out;
}

// Identical to the web version - plain localStorage, no Tauri APIs involved.
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
