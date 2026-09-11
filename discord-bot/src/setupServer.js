import {
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';

const GOLD = 0xd4af37;

const ROLE_SPECS = [
  { name: 'Entropy Team', color: GOLD, hoist: true },
  { name: 'Moderator', color: 0xb88a2a, hoist: true },
  { name: 'Beta Tester', color: 0x8f7440, hoist: false },
  { name: 'Community', color: 0x5f6368, hoist: false },
];

const CATEGORY_SPECS = [
  {
    name: 'START HERE',
    channels: [
      ['welcome', ChannelType.GuildText, 'Welcome to Entropy — start here.'],
      ['rules', ChannelType.GuildText, 'Community rules and expectations.'],
      ['getting-started', ChannelType.GuildText, 'How to use Entropy and where to get help.'],
    ],
  },
  {
    name: 'ENTROPY',
    channels: [
      ['announcements', ChannelType.GuildAnnouncement, 'Major Entropy announcements.'],
      ['release-notes', ChannelType.GuildText, 'New versions, fixes, and shipped features.'],
      ['roadmap', ChannelType.GuildText, 'What Entropy is building next.'],
      ['known-issues', ChannelType.GuildText, 'Confirmed issues and current workarounds.'],
    ],
  },
  {
    name: 'COMMUNITY',
    channels: [
      ['general', ChannelType.GuildText, 'General Entropy and GW2 discussion.'],
      ['wvw', ChannelType.GuildText, 'World vs. World discussion.'],
      ['build-discussion', ChannelType.GuildText, 'Builds, comps, and theorycrafting.'],
      ['screenshots-clips', ChannelType.GuildText, 'Share screenshots, clips, and combat moments.'],
    ],
  },
  {
    name: 'SUPPORT & FEEDBACK',
    channels: [
      ['help', ChannelType.GuildText, 'Questions and troubleshooting.'],
      ['bug-reports', ChannelType.GuildForum, 'Report reproducible Entropy bugs.'],
      ['feature-requests', ChannelType.GuildForum, 'Request and discuss new Entropy features.'],
      ['ui-feedback', ChannelType.GuildForum, 'UI, UX, visual, and accessibility feedback.'],
    ],
  },
  {
    name: 'TESTING',
    channels: [
      ['beta-testing', ChannelType.GuildText, 'Beta builds and testing coordination.'],
      ['test-results', ChannelType.GuildForum, 'Structured test findings and reproduction notes.'],
      ['experimental-features', ChannelType.GuildText, 'Preview experimental Entropy systems.'],
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
      color: spec.color,
      hoist: spec.hoist,
      reason: 'Entropy community bootstrap',
    });
  }
  return role;
}

async function ensureCategory(guild, name) {
  let channel = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === name,
  );
  if (!channel) {
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      reason: 'Entropy community bootstrap',
    });
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
    };

    if (type !== ChannelType.GuildCategory) options.topic = topic;

    if (type === ChannelType.GuildForum) {
      options.availableTags = (FORUM_TAGS[name] ?? []).map((tagName) => ({ name: tagName }));
      options.defaultAutoArchiveDuration = 10080;
    }

    channel = await guild.channels.create(options);
  }

  return channel;
}

async function ensureTeamCategory(guild, teamRole, moderatorRole) {
  let category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === 'ENTROPY TEAM',
  );

  const everyone = guild.roles.everyone;
  const overwrites = [
    { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: teamRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: moderatorRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
  ];

  if (!category) {
    category = await guild.channels.create({
      name: 'ENTROPY TEAM',
      type: ChannelType.GuildCategory,
      permissionOverwrites: overwrites,
      reason: 'Entropy community bootstrap',
    });
  }

  for (const [name, topic] of [
    ['dev-chat', 'Private Entropy development discussion.'],
    ['moderation', 'Private moderation coordination.'],
    ['release-coordination', 'Plan releases and announcement timing.'],
  ]) {
    const existing = guild.channels.cache.find(
      (c) => c.parentId === category.id && c.name === name,
    );
    if (!existing) {
      await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: category.id,
        topic,
        reason: 'Entropy community bootstrap',
      });
    }
  }
}

export async function setupEntropyServer(guild) {
  await guild.roles.fetch();
  await guild.channels.fetch();

  const roles = new Map();
  for (const spec of ROLE_SPECS) {
    roles.set(spec.name, await ensureRole(guild, spec));
  }

  for (const spec of CATEGORY_SPECS) {
    const category = await ensureCategory(guild, spec.name);
    for (const channelSpec of spec.channels) {
      await ensureChannel(guild, category, channelSpec);
    }
  }

  await ensureTeamCategory(
    guild,
    roles.get('Entropy Team'),
    roles.get('Moderator'),
  );

  return {
    rolesCreatedOrFound: ROLE_SPECS.length,
    categoriesCreatedOrFound: CATEGORY_SPECS.length + 1,
    publicChannelsCreatedOrFound: CATEGORY_SPECS.reduce(
      (sum, category) => sum + category.channels.length,
      0,
    ),
  };
}
