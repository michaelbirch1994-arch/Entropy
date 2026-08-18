// Builds a standalone, dependency-free HTML snapshot of a report's key
// numbers - static tables, no imports, no JS - so it can be emailed, posted
// in Discord, or opened on any machine without Entropy installed. This is a
// summary snapshot (MVPs, squad totals, per-player breakdown), not a full
// re-implementation of every view in the app.
import type { WvWReport } from "../types/report";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function compact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return Math.round(n).toLocaleString();
}

export function buildReportHtmlExport(report: WvWReport): string {
  const s = report.stats;
  const meta = report.meta;

  const totalsByAccount = new Map<
    string,
    { profession: string; damage: number; downContrib: number; healing: number; barrier: number; cleanses: number; strips: number; fights: number }
  >();
  function ensure(account: string, profession: string) {
    let e = totalsByAccount.get(account);
    if (!e) {
      e = { profession, damage: 0, downContrib: 0, healing: 0, barrier: 0, cleanses: 0, strips: 0, fights: 0 };
      totalsByAccount.set(account, e);
    }
    return e;
  }
  (s.generalPlayers ?? []).forEach((p) => {
    const e = ensure(p.account, p.profession);
    e.fights = p.logsJoined ?? 0;
  });
  (s.offensePlayers ?? []).forEach((p) => {
    const e = ensure(p.account, p.profession);
    e.damage += p.offenseTotals?.damage ?? 0;
    e.downContrib += p.offenseTotals?.downContribution ?? 0;
  });
  (s.healingPlayers ?? []).forEach((p) => {
    const e = ensure(p.account, p.profession);
    e.healing += p.healingTotals?.healing ?? 0;
    e.barrier += p.healingTotals?.barrier ?? 0;
  });
  (s.supportPlayers ?? []).forEach((p) => {
    const e = ensure(p.account, p.profession);
    e.cleanses += p.supportTotals?.condiCleanse ?? 0;
    e.strips += p.supportTotals?.boonStrips ?? 0;
  });

  const playerRows = Array.from(totalsByAccount.entries())
    .sort((a, b) => b[1].damage - a[1].damage)
    .map(
      ([account, e]) => `<tr><td>${esc(account)}</td><td>${esc(e.profession)}</td><td class="num">${e.fights}</td><td class="num dmg">${compact(e.damage)}</td><td class="num heal">${compact(e.healing)}</td><td class="num">${compact(e.barrier)}</td><td class="num">${compact(e.downContrib)}</td><td class="num">${e.cleanses}</td><td class="num">${e.strips}</td></tr>`,
    )
    .join("\n");

  const totalDamage = Array.from(totalsByAccount.values()).reduce((a, e) => a + e.damage, 0);
  const totalHealing = Array.from(totalsByAccount.values()).reduce((a, e) => a + e.healing, 0);

  function mvpCard(label: string, card: typeof s.offensiveMvp | undefined): string {
    if (!card) return "";
    return `<div class="mvp"><div class="mvp-label">${esc(label)}</div><div class="mvp-name">${esc(card.account)}</div><div class="mvp-prof">${esc(card.profession)}</div>${card.reason ? `<div class="mvp-reason">${esc(card.reason)}</div>` : ""}</div>`;
  }

  const mvpsHtml = [mvpCard("Offensive MVP", s.offensiveMvp), mvpCard("Defensive MVP", s.defensiveMvp)].filter(Boolean).join("\n");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(meta.title)} - Entropy Report Snapshot</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #05070f; font-family: system-ui, sans-serif; color: #e2e8f0; padding: 32px 16px; }
  .wrap { max-width: 960px; margin: 0 auto; }
  h1 { font-size: 20px; text-transform: uppercase; letter-spacing: 0.08em; color: #f59e0b; margin: 0 0 4px; }
  .subtitle { font-size: 12px; color: #94a3b8; margin: 0 0 24px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(245,158,11,0.15); border-radius: 12px; padding: 12px 14px; }
  .card-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; font-weight: 700; }
  .card-value { font-size: 20px; font-weight: 900; color: #f1f5f9; font-family: monospace; margin-top: 2px; }
  .mvps { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
  .mvp { background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 12px 16px; min-width: 180px; }
  .mvp-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #fbbf24; font-weight: 700; }
  .mvp-name { font-size: 15px; font-weight: 800; color: #f1f5f9; margin-top: 2px; }
  .mvp-prof { font-size: 11px; color: #94a3b8; }
  .mvp-reason { font-size: 11px; color: #cbd5e1; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; font-family: monospace; }
  th { text-align: left; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; color: #64748b; border-bottom: 1px solid rgba(148,163,184,0.2); padding: 8px 10px; font-family: system-ui, sans-serif; }
  td { padding: 7px 10px; border-bottom: 1px solid rgba(148,163,184,0.08); }
  td.num { text-align: right; }
  td.dmg { color: #fb923c; font-weight: 700; }
  td.heal { color: #34d399; }
  .footer { margin-top: 20px; font-size: 10px; color: #475569; }
</style></head>
<body><div class="wrap">
  <h1>${esc(meta.title)}</h1>
  <p class="subtitle">${esc(meta.dateLabel)} ${meta.commanders.length ? "&middot; Cmdr " + esc(meta.commanders.join(", ")) : ""} &middot; snapshot exported from Entropy, no live data</p>

  <div class="cards">
    <div class="card"><div class="card-label">Fights</div><div class="card-value">${s.total ?? 0}</div></div>
    <div class="card"><div class="card-label">Wins / Losses</div><div class="card-value">${s.wins ?? 0} / ${s.losses ?? 0}</div></div>
    <div class="card"><div class="card-label">Avg Squad Size</div><div class="card-value">${(s.avgSquadSize ?? 0).toFixed(1)}</div></div>
    <div class="card"><div class="card-label">Squad Damage</div><div class="card-value">${compact(totalDamage)}</div></div>
    <div class="card"><div class="card-label">Squad Healing</div><div class="card-value">${compact(totalHealing)}</div></div>
  </div>

  ${mvpsHtml ? `<div class="mvps">${mvpsHtml}</div>` : ""}

  <table>
    <thead><tr><th>Player</th><th>Class</th><th class="num">Fights</th><th class="num">Damage</th><th class="num">Healing</th><th class="num">Barrier</th><th class="num">Down Contrib</th><th class="num">Cleanses</th><th class="num">Strips</th></tr></thead>
    <tbody>${playerRows}</tbody>
  </table>

  <p class="footer">Generated by Entropy &middot; this is a static snapshot, not a live view - open the original report in Entropy for the full breakdown, charts and replay.</p>
</div></body></html>`;
}
