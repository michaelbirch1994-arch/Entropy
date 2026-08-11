import type { WvWReport } from "../types/report";
import { fmtCompact, fmtFixed, fmtNum } from "./format";

const DISCORD_WEBHOOK_STORAGE_KEY = "entropy.discordWebhookUrl";

export function loadDiscordWebhookUrl(): string {
  try {
    return localStorage.getItem(DISCORD_WEBHOOK_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveDiscordWebhookUrl(url: string): void {
  const trimmed = url.trim();
  try {
    if (trimmed) {
      localStorage.setItem(DISCORD_WEBHOOK_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(DISCORD_WEBHOOK_STORAGE_KEY);
    }
  } catch {
    // Non-fatal. The caller still keeps the value in component state.
  }
}

export function clearDiscordWebhookUrl(): void {
  try {
    localStorage.removeItem(DISCORD_WEBHOOK_STORAGE_KEY);
  } catch {
    // Non-fatal.
  }
}

export function isDiscordWebhookUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^https:\/\/(discord(?:app)?\.com)\/api\/webhooks\/\d+\/[\w.-]+(?:\?.*)?$/i.test(trimmed);
}

function clampText(value: unknown, maxLength: number, fallback = "Not available"): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim() || fallback;
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function safeViewerUrl(viewerUrl?: string | null): string | null {
  if (!viewerUrl) return null;
  try {
    const url = new URL(viewerUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // Discord rejects giant markdown/url fields. Entropy's old share links could
    // contain the whole report in the query string, which is useful locally but
    // way too large for a webhook embed.
    if (url.href.length > 900) return null;
    return url.href;
  } catch {
    return null;
  }
}

function topLine(entry: { account?: string; profession?: string; value?: number } | undefined, unit = ""): string {
  if (!entry?.account) return "Not available";
  const prof = entry.profession ? ` (${entry.profession})` : "";
  return `${entry.account}${prof} - ${fmtCompact(entry.value)}${unit}`;
}

function maxStatLine(stat: { player?: string; profession?: string; value?: number } | undefined, unit = ""): string {
  if (!stat?.player) return "Not available";
  const prof = stat.profession ? ` (${stat.profession})` : "";
  return `${stat.player}${prof} - ${fmtCompact(stat.value)}${unit}`;
}

function mvpLine(card: { account?: string; player?: string; profession?: string; score?: number } | undefined): string {
  const name = card?.player || card?.account;
  if (!name) return "Not available";
  const prof = card.profession ? ` (${card.profession})` : "";
  return `${name}${prof}${typeof card.score === "number" ? ` - ${fmtFixed(card.score, 1)} score` : ""}`;
}

function reportUrlField(viewerUrl?: string | null) {
  const url = safeViewerUrl(viewerUrl);
  if (!url) return null;
  return {
    name: "Open report",
    value: `[Launch Entropy viewer](${url})`,
    inline: false,
  };
}

export function buildDiscordReportPayload(report: WvWReport, viewerUrl?: string | null) {
  const stats = report.stats;
  const offenseLeader = stats.leaderboards?.damage?.[0] ?? stats.leaderboards?.damageAll?.[0];
  const downLeader = stats.leaderboards?.downContribution?.[0];
  const healingLeader = stats.leaderboards?.healing?.[0];
  const stripLeader = stats.leaderboards?.boonStrips?.[0];
  const totalDamage = stats.offensePlayers?.reduce((sum, player) => sum + (player.offenseTotals?.damage ?? 0), 0) ?? 0;
  const totalHealing = stats.healingPlayers?.reduce((sum, player) => sum + (player.healingTotals?.healing ?? 0), 0) ?? 0;
  const totalBarrier = stats.healingPlayers?.reduce((sum, player) => sum + (player.healingTotals?.barrier ?? 0), 0) ?? 0;
  const totalStrips = stats.supportPlayers?.reduce((sum, player) => sum + (player.supportTotals?.boonStrips ?? 0), 0) ?? 0;
  const safeUrl = safeViewerUrl(viewerUrl);
  const fields = [
    { name: "Fights", value: fmtNum(stats.total), inline: true },
    { name: "Record", value: `${fmtNum(stats.wins)}W / ${fmtNum(stats.losses)}L`, inline: true },
    { name: "Squad KDR", value: fmtFixed(stats.squadKDR, 2), inline: true },
    { name: "Squad size", value: fmtFixed(stats.avgSquadSize, 1), inline: true },
    { name: "Enemy size", value: fmtFixed(stats.avgEnemies, 1), inline: true },
    { name: "Kills / Deaths", value: `${fmtNum(stats.totalSquadKills)} / ${fmtNum(stats.totalSquadDeaths)}`, inline: true },
    { name: "Squad damage", value: fmtCompact(totalDamage), inline: true },
    { name: "Healing + barrier", value: `${fmtCompact(totalHealing)} + ${fmtCompact(totalBarrier)}`, inline: true },
    { name: "Boon strips", value: fmtCompact(totalStrips), inline: true },
    { name: "Top damage", value: topLine(offenseLeader), inline: false },
    { name: "Top down contribution", value: topLine(downLeader), inline: false },
    { name: "Top healing", value: topLine(healingLeader), inline: false },
    { name: "Top strips", value: topLine(stripLeader), inline: false },
    { name: "MVP", value: mvpLine(stats.mvp) || maxStatLine(stats.maxDownContrib), inline: false },
    reportUrlField(safeUrl),
  ]
    .filter(Boolean)
    .slice(0, 25)
    .map((field) => ({
      ...field,
      name: clampText((field as { name: string }).name, 256),
      value: clampText((field as { value: string }).value, 1024),
    }));

  return {
    username: clampText("Entropy", 80),
    embeds: [
      {
        title: clampText(report.meta.title || "Entropy WvW Report", 256),
        description: clampText(`${report.meta.dateLabel || "Report summary"} - compact squad analytics`, 4096),
        color: 0xf59e0b,
        fields,
        footer: {
          text: clampText(`Entropy ${report.meta.appVersion || ""}`.trim(), 2048, "Entropy"),
        },
        timestamp: new Date().toISOString(),
        ...(safeUrl ? { url: safeUrl } : {}),
      },
    ],
  };
}

export async function sendDiscordWebhook(webhookUrl: string, payload: unknown): Promise<void> {
  const trimmed = webhookUrl.trim();
  if (!isDiscordWebhookUrl(trimmed)) {
    throw new Error("Paste a valid Discord webhook URL first.");
  }

  const response = await fetch(trimmed, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    const hint = details ? ` Discord said: ${clampText(details, 220, "")}` : " Check that the webhook is still active and the channel still exists.";
    throw new Error(`Discord rejected the post (${response.status}).${hint}`);
  }
}
