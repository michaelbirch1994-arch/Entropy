import type { ViewNavigationTarget } from "./ViewContext";
import { KNOWN_VIEW_IDS } from "../lib/viewRegistry";

const NAVIGATION_TARGET_PARAMS = [
  "navSource",
  "fightId",
  "fightIndex",
  "account",
  "timestampMs",
  "eventId",
  "metric",
] as const;

export type KnownViewId = (typeof KNOWN_VIEW_IDS)[number];

export interface ParsedViewUrlState {
  view: KnownViewId;
  navigationTarget: ViewNavigationTarget | null;
}

const KNOWN_VIEW_SET = new Set<string>(KNOWN_VIEW_IDS);

export function normalizeViewId(view: string | null | undefined, fallback: KnownViewId = "overview"): KnownViewId {
  if (view && KNOWN_VIEW_SET.has(view)) return view as KnownViewId;
  return fallback;
}

export function parseViewUrlState(search: string, fallback: KnownViewId = "overview"): ParsedViewUrlState {
  const params = new URLSearchParams(search);
  const view = normalizeViewId(params.get("view"), fallback);
  const navSource = params.get("navSource");
  const targetView = params.get("view");

  if (!navSource || targetView !== view) {
    return { view, navigationTarget: null };
  }

  const fightIndex = parseFiniteInteger(params.get("fightIndex"));
  const timestampMs = parseFiniteInteger(params.get("timestampMs"));

  return {
    view,
    navigationTarget: {
      source: normalizeNavigationSource(navSource),
      targetView: view,
      fightId: optionalParam(params.get("fightId")),
      fightIndex,
      account: optionalParam(params.get("account")),
      timestampMs,
      eventId: optionalParam(params.get("eventId")),
      metric: optionalParam(params.get("metric")),
    },
  };
}

export function buildViewUrl(baseHref: string, view: string, target: ViewNavigationTarget | null): string {
  const url = new URL(baseHref);
  const normalizedView = normalizeViewId(view);
  url.searchParams.set("view", normalizedView);

  for (const param of NAVIGATION_TARGET_PARAMS) {
    url.searchParams.delete(param);
  }

  if (target) {
    url.searchParams.set("navSource", target.source);
    setOptionalParam(url.searchParams, "fightId", target.fightId);
    setOptionalParam(url.searchParams, "fightIndex", target.fightIndex);
    setOptionalParam(url.searchParams, "account", target.account);
    setOptionalParam(url.searchParams, "timestampMs", target.timestampMs);
    setOptionalParam(url.searchParams, "eventId", target.eventId);
    setOptionalParam(url.searchParams, "metric", target.metric);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

function parseFiniteInteger(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && Number.isFinite(parsed) ? parsed : undefined;
}

function optionalParam(value: string | null): string | undefined {
  return value && value.trim() ? value : undefined;
}

function setOptionalParam(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value === undefined || value === "") return;
  params.set(key, String(value));
}

function normalizeNavigationSource(source: string): ViewNavigationTarget["source"] {
  return source === "intelligence" || source === "archive" || source === "overview" ? source : "other";
}
