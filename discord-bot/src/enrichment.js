import { ChannelType, EmbedBuilder } from 'discord.js';

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
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: 'ENTROPY  •  ANALYZE  •  IMPROVE  •  DOMINATE' });
}

export function buildLinksEmbed() {
  return embed(
    '🔗 ENTROPY // ESSENTIAL LINKS',
    `**USE ENTROPY**\n[Open Entropy Web](${ENTROPY_RESOURCES.website})\n[Download the latest desktop release](${ENTROPY_RESOURCES.releases})\n[Entropy on GitHub](${ENTROPY_RESOURCES.github})\n\n**COMBAT LOGGING**\n[ArcDPS — official site](${ENTROPY_RESOURCES.arcdps})\n[Healing Stats extension](${ENTROPY_RESOURCES.healing})\n\n**LOG ECOSYSTEM**\n[Elite Insights Parser](${ENTROPY_RESOURCES.eliteInsights})\n[dps.report](${ENTROPY_RESOURCES.dpsReport})\n\nUse **#downloads-and-setup** for the complete setup path.`
  );
}

export function buildAboutEmbed() {
  return embed(
    '✦ ABOUT ENTROPY // READ THE FIGHT',
    `Entropy is a **Guild Wars 2 World vs. World combat analytics and squad-intelligence platform**. It is designed to answer more useful questions than “who did the most damage?”\n\n**CORE ANALYSIS**\n▸ Fight and squad performance\n▸ Offensive, defensive, healing, boon, cleanse, strip, and support context\n▸ Player comparison using the logs currently loaded\n▸ Fight replay and positional evidence\n▸ Build and squad-composition workflows\n\n**ENTROPY INTELLIGENCE**\nEntropy adds interpretation on top of raw combat metrics: fight flow, critical events, squad separation, survival-support context, and other evidence-backed findings where the log data supports them.\n\n**DESIGN PHILOSOPHY**\nThe log is evidence. Entropy should make that evidence easier to understand without inventing certainty the data cannot support.\n\n[Launch Entropy](${ENTROPY_RESOURCES.website})  •  [Source & releases](${ENTROPY_RESOURCES.github})`
  );
}

export function buildLoggingEmbed() {
  return embed(
    '⚙ LOGGING // QUICK SETUP',
    `**1 — INSTALL ARCDPS**\nGet ArcDPS from the [official site](${ENTROPY_RESOURCES.arcdps}) and place its \`d3d11.dll\` beside \`gw2-64.exe\` while Guild Wars 2 is closed.\n\n**2 — ENABLE WvW LOGGING**\nLaunch GW2 → **Alt + Shift + T** → **LOGGING** → under WvW enable **SAVE (AFTER SQUAD COMBAT)**.\n\n**3 — ADD HEALING STATS (RECOMMENDED)**\nInstall [Healing Stats](${ENTROPY_RESOURCES.healing}), then enable **log healing** under ArcDPS Extensions. This improves healing/support attribution when extension data is available.\n\n**4 — FIND THE LOG**\nArcDPS normally writes logs under:\n\`Documents\\Guild Wars 2\\addons\\arcdps\\arcdps.cbtlogs\`\n\n**5 — LOAD INTO ENTROPY**\nOpen [Entropy](${ENTROPY_RESOURCES.website}) and load the generated \`.evtc\`, \`.zevtc\`, or other supported report.\n\nFor the fuller walkthrough, use **#downloads-and-setup**.`
  );
}

const CHANNELS = [
  {
    categoryNames: ['◆ START HERE', 'START HERE'],
    name: 'about-entropy',
    topic: 'What Entropy is, what it analyzes, and how the intelligence layer is intended to be used.',
    message: buildAboutEmbed,
  },
  {
    categoryNames: ['◆ START HERE', 'START HERE'],
    name: 'resources',
    topic: 'Official Entropy links plus trusted ArcDPS, Healing Stats, Elite Insights, and dps.report resources.',
    message: buildLinksEmbed,
  },
  {
    categoryNames: ['◆ START HERE', 'START HERE'],
    name: 'faq',
    topic: 'Common Entropy, logging, data coverage, and troubleshooting questions.',
    message: () => embed(
      '❓ ENTROPY // FAQ',
      `**Do I need the desktop app?**\nNo. The web app is available at ${ENTROPY_RESOURCES.website}. The desktop release is an alternative workflow.\n\n**Do I need Healing Stats?**\nNo. Entropy can analyze normal ArcDPS combat data, but Healing Stats can improve healing attribution and support coverage when its extension data is present.\n\n**Why can a metric be partial or unavailable?**\nEntropy only presents information supported by the log. Some metrics depend on extension coverage or specific event data.\n\n**Where do I report a bug?**\nUse **/bug** and include your version, environment, reproduction steps, and a log/report when relevant.\n\n**Where do feature ideas go?**\nUse **/request** or **#feature-requests**.`
    ),
  },
  {
    categoryNames: ['◆ ENTROPY', 'ENTROPY'],
    name: 'feature-guide',
    topic: 'A guided map of Entropy analysis, replay, comparison, intelligence, and Builder workflows.',
    message: () => embed(
      '◈ ENTROPY // FEATURE GUIDE',
      `**ANALYZE**\nUse Overview and combat-stat views to establish what happened across the fight and squad.\n\n**COMPARE**\nUse player comparison on the currently loaded logs to investigate differences in performance, skills, support, mitigation, and other supported metrics.\n\n**REPLAY**\nUse Fight Replay to connect metrics to positioning, movement, timing, and critical moments instead of treating numbers in isolation.\n\n**INTELLIGENCE**\nUse Entropy Intelligence for evidence-backed interpretations such as critical events, survival-support context, and squad-separation findings.\n\n**BUILD**\nUse Builder to reason about professions, roles, subgroup structure, and squad composition.\n\n**VALIDATE**\nWhen something looks wrong, compare the view against the source log and report reproducible issues through **/bug**.`
    ),
  },
];

function findCategory(guild, names) {
  return guild.channels.cache.find((channel) => channel.type === ChannelType.GuildCategory && names.includes(channel.name));
}

async function ensureTextChannel(guild, spec) {
  const category = findCategory(guild, spec.categoryNames);
  if (!category) return null;

  let channel = guild.channels.cache.find((item) => item.parentId === category.id && item.name === spec.name);
  if (!channel) {
    channel = await guild.channels.create({
      name: spec.name,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: spec.topic,
      reason: 'Entropy Discord enrichment',
    });
  } else if ('topic' in channel && channel.topic !== spec.topic) {
    await channel.edit({ topic: spec.topic, reason: 'Entropy Discord enrichment sync' });
  }
  return channel;
}

async function upsertEmbed(guild, channel, desired) {
  const recent = await channel.messages.fetch({ limit: 30 });
  const existing = recent.find((message) =>
    message.author.id === guild.members.me?.id &&
    message.embeds.some((item) => item.title === desired.data.title)
  );

  if (existing) {
    const current = existing.embeds[0];
    if (current.description !== desired.data.description || current.footer?.text !== desired.data.footer?.text) {
      await existing.edit({ embeds: [desired] });
    }
    return false;
  }

  await channel.send({ embeds: [desired] });
  return true;
}

export async function seedEnrichment(guild) {
  await guild.channels.fetch();
  let published = 0;

  for (const spec of CHANNELS) {
    const channel = await ensureTextChannel(guild, spec);
    if (!channel?.isTextBased()) continue;
    if (await upsertEmbed(guild, channel, spec.message())) published += 1;
  }

  return published;
}
