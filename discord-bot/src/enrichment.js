import { EmbedBuilder } from 'discord.js';

const GOLD = 0xd6a62e;

export const ENTROPY_RESOURCES = {
  website: 'https://entropy-um58.vercel.app/',
  releases: 'https://github.com/michaelbirch1994-arch/Entropy/releases/latest',
  github: 'https://github.com/michaelbirch1994-arch/Entropy',
  arcdps: 'https://www.deltaconnected.com/arcdps/',
  healing: 'https://github.com/Krappa322/arcdps_healing_stats/releases/latest',
  eliteInsights: 'https://github.com/baaron4/GW2-Elite-Insights-Parser',
  dpsReport: 'https://dps.report/',
};

function embed(title, description) {
  return new EmbedBuilder().setColor(GOLD).setTitle(title).setDescription(description).setFooter({ text: 'ENTROPY  •  ANALYZE  •  IMPROVE  •  DOMINATE' });
}

export function buildLinksEmbed() {
  return embed('🔗 ENTROPY // ESSENTIAL LINKS', `**USE ENTROPY**\n[Open Entropy Web](${ENTROPY_RESOURCES.website})\n[Download latest desktop release](${ENTROPY_RESOURCES.releases})\n[Entropy on GitHub](${ENTROPY_RESOURCES.github})\n\n**COMBAT LOGGING**\n[ArcDPS — official site](${ENTROPY_RESOURCES.arcdps})\n[Healing Stats extension](${ENTROPY_RESOURCES.healing})\n\n**LOG ECOSYSTEM**\n[Elite Insights Parser](${ENTROPY_RESOURCES.eliteInsights})\n[dps.report](${ENTROPY_RESOURCES.dpsReport})`);
}

export function buildAboutEmbed() {
  return embed('✦ ABOUT ENTROPY // READ THE FIGHT', `Entropy is a **Guild Wars 2 World vs. World combat analytics and squad-intelligence platform** built to answer more useful questions than “who did the most damage?”\n\n▸ Fight and squad performance\n▸ Offensive, defensive, healing, boon, cleanse, strip, and support context\n▸ Player comparison from currently loaded logs\n▸ Fight replay and positional evidence\n▸ Evidence-backed Entropy Intelligence findings\n▸ Build and squad-composition workflows\n\nThe log is evidence. Entropy makes that evidence easier to understand without inventing certainty the data cannot support.\n\n[Launch Entropy](${ENTROPY_RESOURCES.website})  •  [Source & releases](${ENTROPY_RESOURCES.github})`);
}

export function buildLoggingEmbed() {
  return embed('⚙ LOGGING // QUICK SETUP', `**1 — INSTALL ARCDPS**\nGet ArcDPS from the [official site](${ENTROPY_RESOURCES.arcdps}) and place \`d3d11.dll\` beside \`gw2-64.exe\` while Guild Wars 2 is closed.\n\n**2 — ENABLE WvW LOGGING**\nGW2 → **Alt + Shift + T** → **LOGGING** → WvW → **SAVE (AFTER SQUAD COMBAT)**.\n\n**3 — HEALING STATS (RECOMMENDED)**\nInstall [Healing Stats](${ENTROPY_RESOURCES.healing}) and enable **log healing** under ArcDPS Extensions.\n\n**4 — FIND THE LOG**\n\`Documents\\Guild Wars 2\\addons\\arcdps\\arcdps.cbtlogs\`\n\n**5 — LOAD IT**\nOpen [Entropy](${ENTROPY_RESOURCES.website}) and load the generated \`.evtc\`, \`.zevtc\`, or supported report.`);
}

const CONTENT = {
  welcome: [
    buildAboutEmbed,
    () => embed('◆ COMMUNITY STANDARD', '**Signal over noise. Evidence over ego.**\n\nRespect people. Challenge builds, metrics, methodology, and conclusions — not the person. Keep feedback useful and reproducible. Protect credentials and private information. Keep discussion centered on Entropy, GW2 WvW, combat analysis, testing, builds, and product feedback.'),
  ],
  'getting-started': [
    buildLoggingEmbed,
    buildLinksEmbed,
    () => embed('❓ QUICK FAQ', `**Desktop required?** No — the web app works directly.\n**Healing Stats required?** No — but it can improve healing/support attribution.\n**Why is a metric partial or unavailable?** Entropy only presents information supported by the source log and extension coverage.\n**Bug?** Use **/bug**.\n**Feature/UI idea?** Use **/request** or **#feature-requests**.`),
    () => embed('◈ FEATURE MAP', '**ANALYZE** — Overview and combat statistics establish what happened.\n**COMPARE** — Compare players from the currently loaded logs.\n**REPLAY** — Connect numbers to positioning, movement, and timing.\n**INTELLIGENCE** — Inspect evidence-backed critical events and squad findings.\n**BUILD** — Reason about professions, roles, subgroups, and composition.'),
  ],
  'release-notes': [
    () => embed('◇ RELEASES // STATUS // ROADMAP', `Follow shipped versions, important known issues, workarounds, and current product direction here.\n\n[Latest stable release](${ENTROPY_RESOURCES.releases})\n\nCurrent focus areas include analytics quality, Entropy Intelligence, fight replay, Builder/composition workflows, player comparison, performance, UI polish, and community tooling.`),
  ],
  wvw: [
    () => embed('⚔ WvW // BUILDS // COMPOSITIONS', 'Use this channel for fight review, strategy, positioning, engage timing, profession builds, subgroup structure, support pairings, target-cap considerations, and squad-composition theorycrafting.'),
  ],
  'beta-testing': [
    () => embed('◈ BETA // EXPERIMENTAL // VALIDATION', 'Use this channel for beta builds, experimental features, focused test passes, regressions, retests, and evidence. Good feedback includes the version, scenario, expected result, actual result, and supporting evidence.'),
  ],
};

async function upsertEmbed(guild, channel, desired) {
  const recent = await channel.messages.fetch({ limit: 50 });
  const existing = recent.find((message) => message.author.id === guild.members.me?.id && message.embeds.some((item) => item.title === desired.data.title));
  if (existing) {
    const current = existing.embeds[0];
    if (current.description !== desired.data.description || current.footer?.text !== desired.data.footer?.text) await existing.edit({ embeds: [desired] });
    return false;
  }
  await channel.send({ embeds: [desired] });
  return true;
}

export async function seedEnrichment(guild) {
  await guild.channels.fetch();
  let published = 0;
  for (const [channelName, builders] of Object.entries(CONTENT)) {
    const channel = guild.channels.cache.find((item) => item.name === channelName && item.isTextBased());
    if (!channel) continue;
    for (const build of builders) if (await upsertEmbed(guild, channel, build())) published += 1;
  }
  return published;
}
