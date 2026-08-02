// Runtime-aware facade over the two folder-watcher implementations:
// folderWatcher.ts (browser File System Access API) and
// folderWatcher.native.ts (Tauri fs/dialog plugins). RawLogImporter.tsx
// should import from here instead of directly from folderWatcher.ts once
// the Tauri shell is wired up, so the exact same component works whether
// Entropy is running as a website or as the packaged desktop app.
import { isTauriRuntime } from "./runtime";
import * as web from "./folderWatcher";
import * as native from "./folderWatcher.native";

const impl = isTauriRuntime() ? native : web;

export const isFolderWatchSupported = impl.isFolderWatchSupported;
export const pickLogFolder = impl.pickLogFolder;
export const getSavedFolderHandle = impl.getSavedFolderHandle;
export const checkPermission = impl.checkPermission;
export const clearFolderHandle = impl.clearFolderHandle;
export const scanForLogFiles = impl.scanForLogFiles;
// Identical in both implementations - no branching needed.
export const loadSeenFileKeys = web.loadSeenFileKeys;
export const saveSeenFileKeys = web.saveSeenFileKeys;
export const fileKey = web.fileKey;
export type ScannedLogFile = web.ScannedLogFile;
