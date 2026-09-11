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
    name: '◆ START HERE',
    aliases: ['START HERE'],
    channels: [
      ['welcome', ChannelType.GuildText, 'The front door to Entropy — orientation, identity, and where to begin.'],
      ['rules', ChannelType.GuildText, 'Community standards designed to keep discussion useful, focused, and respectful.'],
      ['getting-started', ChannelType.GuildText, 'A concise guide to Entropy, support, feedback, and development channels.'],
      ['downloads-and-setup', ChannelType.GuildText, 'Entropy downloads, ArcDPS, Healing Stats, and WvW logging setup.'],
    ],
  },
  {
    name: '◆ ENTROPY',
    aliases: ['ENTROPY'],
    channels: [
      ['announcements', ChannelType.GuildAnnouncement, 'Major Entropy announcements and important project updates.'],
      ['release-notes', ChannelType.GuildText, 'Shipped versions, fixes, refinements, and new capabilities.'],
      ['roadmap', ChannelType.GuildText, 'What is being explored, built, validated, and prepared next.'],
      ['known-issues', ChannelType.GuildText, 'Confirmed issues, status, workarounds, and resolution notes.'],
    ],
  },
  {
    name: '◆ COMMUNITY',
    aliases: ['COMMUNITY'],
    channels: [
      ['general', ChannelType.GuildText, 'General Entropy discussion, questions, ideas, and community conversation.'],
      ['wvw', ChannelType.GuildText, 'Guild Wars 2 World vs. World discussion, fights, strategy, and combat analysis.'],
      ['build-discussion', ChannelType.GuildText, 'Builds, squad compositions, roles, and theorycrafting.'],
      ['screenshots-clips', ChannelType.GuildText, 'Share combat moments, UI captures, replays, screenshots, and clips.'],
    ],
  },
  {
    name: '◆ SUPPORT & FEEDBACK',
    aliases: ['SUPPORT & FEEDBACK'],
    channels: [
      ['help', ChannelType.GuildText, 'Troubleshooting, how-to questions, setup assistance, and support.'],
      ['bug-reports', ChannelType.GuildForum, 'Structured, reproducible Entropy bug reports with status tracking.'],
      ['feature-requests', ChannelType.GuildForum, 'Propose, refine, and discuss new Entropy capabilities.'],
      ['ui-feedback', ChannelType.GuildForum, 'Focused UI, UX, visual, mobile, desktop, and accessibility feedback.'],
    ],
  },
  {
    name: '◆ TESTING',
    aliases: ['TESTING'],
    channels: [
      ['beta-testing', ChannelType.GuildText, 'Coordinate beta builds, focused validation passes, and test priorities.'],
      ['test-results', ChannelType.GuildForum, 'Structured validation results, regressions, and retest evidence.'],
      ['experimental-features', ChannelType.GuildText, 'Preview and discuss experimental Entropy systems before wider release.'],
    ],
  },
];

const FORUM_TAGS = {
  'bug-reports': ['New', 'Needs Info', 'Confirmed', 'In Progress', 'Fixed'],
  'feature-requests': ['New', 'Under Review', 'Planned', 'In Progress', 'Shipped'],
  'ui-feedback': ['UI', 'UX', 'Accessibility', 'Mobile', 'Desktop'],
  'test-results': ['Pass', 'Fail', 'Regression', 'Needs Retest'],
};

async function ensureRole(guild, spec) {
  let role = guild.roles.cache.find((r) => r.name === spec.name && !r.managed);
  if (!role) {
    role = await guild.roles.create({
      name: spec.name,
      colors: { primaryColor: spec.color },
      hoist: spec.hoist,
      reason: 'Entropy community bootstrap',
    });
  } else if (role.color !== spec.color || role.hoist !== spec.hoist) {
    await role.edit({
      colors: { primaryColor: spec.color },
      hoist: spec.hoist,
      reason: 'Entropy visual identity sync',
    });
  }
  return role;
}

async function ensureCategory(guild, spec) {
  let channel = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && (c.name === spec.name || spec.aliases?.includes(c.name)),
  );
  if (!channel) {
    channel = await guild.channels.create({
      name: spec.name,
      type: ChannelType.GuildCategory,
      reason: 'Entropy community bootstrap',
    });
  } else if (channel.name !== spec.name) {
    await channel.edit({ name: spec.name, reason: 'Entropy visual identity sync' });
  }
  return channel;
}

async function ensureChannel(guild, category, [name, type, topic]) {
  let channel = guild.channels.cache.find(
    (c) => c.parentId === category.id && c.name === name && c.type === type,
  );

  if (!channel) {
    const options = {
      name,
      type,
      parent: category.id,
      reason: 'Entropy community bootstrap',
      topic,
    };

    if (type === ChannelType.GuildForum) {
      options.availableTags = (FORUM_TAGS[name] ?? []).map((tagName) => ({ name: tagName }));
      options.defaultAutoArchiveDuration = 10080;
    }

    channel = await guild.channels.create(options);
  } else {
    const edit = {};
    if ('topic' in channel && channel.topic !== topic) edit.topic = topic;
    if (type === ChannelType.GuildForum) {
      const existingTagNames = new Set((channel.availableTags ?? []).map((tag) => tag.name));
      const desired = FORUM_TAGS[name] ?? [];
      if (desired.some((tagName) => !existingTagNames.has(tagName))) {
        edit.availableTags = desired.map((tagName) => ({ name: tagName }));
      }
    }
    if (Object.keys(edit).length) await channel.edit({ ...edit, reason: 'Entropy visual identity sync' });
  }

  return channel;
}

async function ensureTeamCategory(guild, teamRole, moderatorRole) {
  let category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && ['◆ ENTROPY TEAM', 'ENTROPY TEAM'].includes(c.name),
  );

  const everyone = guild.roles.everyone;
  const overwrites = [
    { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: teamRole.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    },
    {
      id: moderatorRole.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    },
  ];

  if (!category) {
    category = await guild.channels.create({
      name: '◆ ENTROPY TEAM',
      type: ChannelType.GuildCategory,
      permissionOverwrites: overwrites,
      reason: 'Entropy community bootstrap',
    });
  } else {
    await category.edit({ name: '◆ ENTROPY TEAM', permissionOverwrites: overwrites, reason: 'Entropy visual identity sync' });
  }

  for (const [name, topic] of [
    ['dev-chat', 'Private product, engineering, intelligence, and design discussion.'],
    ['moderation', 'Private moderation coordination and community operations.'],
    ['release-coordination', 'Coordinate releases, changelogs, rollout timing, and announcements.'],
  ]) {
    const existing = guild.channels.cache.find((c) => c.parentId === category.id && c.name === name);
    if (!existing) {
      await guild.channels.create({ name, type: ChannelType.GuildText, parent: category.id, topic, reason: 'Entropy community bootstrap' });
    } else if (existing.topic !== topic) {
      await existing.edit({ topic, reason: 'Entropy visual identity sync' });
    }
  }
}

export async function setupEntropyServer(guild) {
  if (!guild.features.includes(GuildFeature.Community)) {
    const error = new Error('COMMUNITY_REQUIRED');
    error.code = 'COMMUNITY_REQUIRED';
    throw error;
  }

  await guild.roles.fetch();
  await guild.channels.fetch();

  const roles = new Map();
  for (const spec of ROLE_SPECS) roles.set(spec.name, await ensureRole(guild, spec));

  for (const spec of CATEGORY_SPECS) {
    const category = await ensureCategory(guild, spec);
    for (const channelSpec of spec.channels) await ensureChannel(guild, category, channelSpec);
  }

  await ensureTeamCategory(guild, roles.get('Entropy Team'), roles.get('Moderator'));

  return {
    rolesCreatedOrFound: ROLE_SPECS.length,
    categoriesCreatedOrFound: CATEGORY_SPECS.length + 1,
    publicChannelsCreatedOrFound: CATEGORY_SPECS.reduce((sum, category) => sum + category.channels.length, 0),
  };
}
