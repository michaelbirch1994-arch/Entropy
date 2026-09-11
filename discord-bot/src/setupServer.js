import {
  ChannelType,
  GuildFeature,
  PermissionFlagsBits,
} from 'discord.js';

const GOLD = 0xd6a62e;
const GOLD_DARK = 0xa77b1f;
const GOLD_MUTED = 0x80652f;
const STEEL = 0x595f66;

const ROLE_SPECS = [
  { name: 'Entropy Team', color: GOLD, hoist: true },
  { name: 'Moderator', color: GOLD_DARK, hoist: true },
  { name: 'Beta Tester', color: GOLD_MUTED, hoist: false },
  { name: 'Community', color: STEEL, hoist: false },
];

const CATEGORY_SPECS = [
  {
    name: '◆ START HERE', aliases: ['START HERE'], channels: [
      ['welcome', ChannelType.GuildText, 'Entropy orientation, community standards, and the fastest path to getting started.'],
      ['getting-started', ChannelType.GuildText, 'Downloads, ArcDPS logging, Healing Stats, essential links, FAQ, and feature guidance.'],
    ],
  },
  {
    name: '◆ ENTROPY', aliases: ['ENTROPY'], channels: [
      ['announcements', ChannelType.GuildAnnouncement, 'Major Entropy announcements and important project updates.'],
      ['release-notes', ChannelType.GuildText, 'Releases, known issues, current development direction, fixes, and shipped capabilities.'],
    ],
  },
  {
    name: '◆ COMMUNITY', aliases: ['COMMUNITY'], channels: [
      ['general', ChannelType.GuildText, 'General Entropy discussion, questions, ideas, and community conversation.'],
      ['wvw', ChannelType.GuildText, 'WvW strategy, builds, compositions, fight review, and combat analysis.'],
      ['screenshots-clips', ChannelType.GuildText, 'Share combat moments, UI captures, replays, screenshots, and clips.'],
    ],
  },
  {
    name: '◆ SUPPORT & FEEDBACK', aliases: ['SUPPORT & FEEDBACK'], channels: [
      ['help', ChannelType.GuildText, 'Troubleshooting, how-to questions, setup assistance, and support.'],
      ['bug-reports', ChannelType.GuildForum, 'Structured, reproducible Entropy bug reports with status tracking.'],
      ['feature-requests', ChannelType.GuildForum, 'Feature, UI, UX, accessibility, and product feedback with status tracking.'],
    ],
  },
  {
    name: '◆ TESTING', aliases: ['TESTING'], channels: [
      ['beta-testing', ChannelType.GuildText, 'Beta builds, experimental systems, validation results, regressions, and retesting.'],
    ],
  },
];

const FORUM_TAGS = {
  'bug-reports': ['New', 'Needs Info', 'Confirmed', 'In Progress', 'Fixed'],
  'feature-requests': ['New', 'UI/UX', 'Accessibility', 'Under Review', 'Planned', 'In Progress', 'Shipped'],
};

const REDUNDANT_CHANNELS = new Set([
  'rules', 'downloads-and-setup', 'about-entropy', 'resources', 'faq', 'feature-guide',
  'roadmap', 'known-issues', 'build-discussion', 'ui-feedback', 'test-results',
  'experimental-features', 'moderation',
]);

async function ensureRole(guild, spec) {
  let role = guild.roles.cache.find((r) => r.name === spec.name && !r.managed);
  if (!role) role = await guild.roles.create({ name: spec.name, colors: { primaryColor: spec.color }, hoist: spec.hoist, reason: 'Entropy community bootstrap' });
  else if (role.color !== spec.color || role.hoist !== spec.hoist) await role.edit({ colors: { primaryColor: spec.color }, hoist: spec.hoist, reason: 'Entropy visual identity sync' });
  return role;
}

async function ensureCategory(guild, spec) {
  let channel = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && (c.name === spec.name || spec.aliases?.includes(c.name)));
  if (!channel) channel = await guild.channels.create({ name: spec.name, type: ChannelType.GuildCategory, reason: 'Entropy community bootstrap' });
  else if (channel.name !== spec.name) await channel.edit({ name: spec.name, reason: 'Entropy visual identity sync' });
  return channel;
}

async function ensureChannel(guild, category, [name, type, topic]) {
  let channel = guild.channels.cache.find((c) => c.parentId === category.id && c.name === name && c.type === type);
  if (!channel) {
    const options = { name, type, parent: category.id, reason: 'Entropy community bootstrap', topic };
    if (type === ChannelType.GuildForum) { options.availableTags = (FORUM_TAGS[name] ?? []).map((tagName) => ({ name: tagName })); options.defaultAutoArchiveDuration = 10080; }
    channel = await guild.channels.create(options);
  } else {
    const edit = {};
    if ('topic' in channel && channel.topic !== topic) edit.topic = topic;
    if (type === ChannelType.GuildForum) {
      const existing = new Set((channel.availableTags ?? []).map((tag) => tag.name));
      const desired = FORUM_TAGS[name] ?? [];
      if (desired.some((tag) => !existing.has(tag))) edit.availableTags = desired.map((tag) => ({ name: tag }));
    }
    if (Object.keys(edit).length) await channel.edit({ ...edit, reason: 'Entropy compact community sync' });
  }
  return channel;
}

async function ensureTeamCategory(guild, teamRole, moderatorRole) {
  let category = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && ['◆ ENTROPY TEAM', 'ENTROPY TEAM'].includes(c.name));
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: teamRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: moderatorRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];
  if (!category) category = await guild.channels.create({ name: '◆ ENTROPY TEAM', type: ChannelType.GuildCategory, permissionOverwrites: overwrites, reason: 'Entropy community bootstrap' });
  else await category.edit({ name: '◆ ENTROPY TEAM', permissionOverwrites: overwrites, reason: 'Entropy compact community sync' });

  for (const [name, topic] of [
    ['dev-chat', 'Private product, engineering, intelligence, design, and moderation discussion.'],
    ['release-coordination', 'Coordinate releases, changelogs, rollout timing, and announcements.'],
  ]) {
    const existing = guild.channels.cache.find((c) => c.parentId === category.id && c.name === name);
    if (!existing) await guild.channels.create({ name, type: ChannelType.GuildText, parent: category.id, topic, reason: 'Entropy community bootstrap' });
    else if (existing.topic !== topic) await existing.edit({ topic, reason: 'Entropy compact community sync' });
  }
}

async function removeEmptyLegacyChannels(guild) {
  let removed = 0;
  for (const channel of guild.channels.cache.values()) {
    if (!REDUNDANT_CHANNELS.has(channel.name) || channel.type === ChannelType.GuildCategory) continue;
    // Never destroy community conversation. Only remove a legacy channel when its recent history is empty
    // or consists entirely of Entropy bot messages. Non-empty user channels are preserved for manual review.
    if (!channel.isTextBased() || channel.type === ChannelType.GuildForum) continue;
    const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
    if (!recent) continue;
    const botId = guild.members.me?.id;
    if (recent.every((message) => message.author.id === botId)) {
      await channel.delete('Entropy channel consolidation: redundant bot-only channel');
      removed += 1;
    }
  }
  return removed;
}

export async function setupEntropyServer(guild) {
  if (!guild.features.includes(GuildFeature.Community)) { const error = new Error('COMMUNITY_REQUIRED'); error.code = 'COMMUNITY_REQUIRED'; throw error; }
  await guild.roles.fetch();
  await guild.channels.fetch();

  const roles = new Map();
  for (const spec of ROLE_SPECS) roles.set(spec.name, await ensureRole(guild, spec));
  for (const spec of CATEGORY_SPECS) {
    const category = await ensureCategory(guild, spec);
    for (const channelSpec of spec.channels) await ensureChannel(guild, category, channelSpec);
  }
  await ensureTeamCategory(guild, roles.get('Entropy Team'), roles.get('Moderator'));
  const legacyChannelsRemoved = await removeEmptyLegacyChannels(guild);

  return {
    rolesCreatedOrFound: ROLE_SPECS.length,
    categoriesCreatedOrFound: CATEGORY_SPECS.length + 1,
    publicChannelsCreatedOrFound: CATEGORY_SPECS.reduce((sum, category) => sum + category.channels.length, 0),
    legacyChannelsRemoved,
  };
}
