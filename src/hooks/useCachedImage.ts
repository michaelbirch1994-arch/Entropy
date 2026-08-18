// Downloads a remote image via fetch() and serves it back as a local blob:
// URL instead of pointing an <img> tag straight at the remote host.
//
// Why this exists: skill/boon icons come from render.guildwars2.com URLs
// embedded in the uploaded report JSON. Users kept seeing every single icon
// fall back to its numbered badge at once (not just a few broken ones),
// which points to something blocking the whole domain rather than bad data -
// most likely either an ad blocker/privacy extension, or (in StackBlitz's
// case) the preview iframe's Content-Security-Policy restricting img-src to
// same-origin. A directly-blocked ad blocker will still block this (it
// blocks the network request itself, not just the <img> tag), but a CSP-type
// block is bypassed: the fetch() call is governed by connect-src (usually
// permissive) rather than img-src, and the resulting blob: URL we hand back
// to the <img> tag is same-origin by construction.
//
// Blob URLs are cached per remote URL for the life of the tab so repeated
// icons (a skill appearing in Top Skills, Buffs, Rotations, etc.) only cost
// one network request each, not one per usage.
import { useEffect, useState } from "react";

const blobUrlCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

function fetchAsBlobUrl(url: string): Promise<string> {
  const cached = blobUrlCache.get(url);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(url);
  if (pending) return pending;

  const promise = fetch(url, { referrerPolicy: "no-referrer" })
    .then((res) => {
      if (!res.ok) throw new Error(`Icon fetch failed: HTTP ${res.status}`);
      return res.blob();
    })
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      blobUrlCache.set(url, objectUrl);
      return objectUrl;
    })
    .finally(() => {
      inFlight.delete(url);
    });

  inFlight.set(url, promise);
  return promise;
}

/**
 * Resolves a remote image URL to a locally-hosted blob: URL.
 * - `src` is undefined until the download finishes (render a loading state).
 * - `failed` is true if the download errored (render a fallback).
 */
export function useCachedImage(url: string | undefined): { src: string | undefined; failed: boolean } {
  const [state, setState] = useState<{ src: string | undefined; failed: boolean }>(() =>
    url && blobUrlCache.has(url) ? { src: blobUrlCache.get(url), failed: false } : { src: undefined, failed: false }
  );

  useEffect(() => {
    if (!url) {
      setState({ src: undefined, failed: true });
      return;
    }
    const cached = blobUrlCache.get(url);
    if (cached) {
      setState({ src: cached, failed: false });
      return;
    }

    let cancelled = false;
    setState({ src: undefined, failed: false });
    fetchAsBlobUrl(url)
      .then((objectUrl) => {
        if (!cancelled) setState({ src: objectUrl, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ src: undefined, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
