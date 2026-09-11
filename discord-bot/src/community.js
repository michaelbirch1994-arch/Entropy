import {
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';

export const ENTROPY_GOLD = 0xd6a62e;

export const ENTROPY_LINKS = {
  website: 'https://entropy-um58.vercel.app/',
  releases: 'https://github.com/michaelbirch1994-arch/Entropy/releases/latest',
  github: 'https://github.com/michaelbirch1994-arch/Entropy',
  arcdps: 'https://www.deltaconnected.com/arcdps/',
  healing: 'https://github.com/Krappa322/arcdps_healing_stats/releases/latest',
};

export function entropyEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(ENTROPY_GOLD)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: 'ENTROPY  •  ANALYZE  •  IMPROVE  •  DOMINATE' })
    .setTimestamp();
}

export function buildBugModal() {
  const modal = new ModalBuilder().setCustomId('entropy:bug').setTitle('Report an Entropy Bug');
  const fields = [
    ['summary', 'Bug summary', TextInputStyle.Short, true],
    ['steps', 'How can we reproduce it?', TextInputStyle.Paragraph, true],
    ['expected', 'What did you expect?', TextInputStyle.Paragraph, true],
    ['actual', 'What actually happened?', TextInputStyle.Paragraph, true],
    ['context', 'Version, browser/desktop, log link (optional)', TextInputStyle.Paragraph, false],
  ];
  for (const [id, label, style, required] of fields) {
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setMaxLength(1000),
    ));
  }
  return modal;
}

export function buildRequestModal() {
  const modal = new ModalBuilder().setCustomId('entropy:request').setTitle('Request an Entropy Feature');
  const fields = [
    ['title', 'Feature title', TextInputStyle.Short, true],
    ['problem', 'What problem would this solve?', TextInputStyle.Paragraph, true],
    ['proposal', 'What would you like Entropy to do?', TextInputStyle.Paragraph, true],
    ['value', 'Why would this help WvW players?', TextInputStyle.Paragraph, false],
  ];
  for (const [id, label, style, required] of fields) {
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setMaxLength(1000),
    ));
  }
  return modal;
}

function findChannel(guild, name) {
  return guild.channels.cache.find((channel) => channel.name === name);
}

function tagId(channel, tagName) {
  return channel.availableTags?.find((tag) => tag.name.toLowerCase() === tagName.toLowerCase())?.id;
}

export async function submitBug(interaction) {
  const forum = findChannel(interaction.guild, 'bug-reports');
  if (!forum || forum.type !== ChannelType.GuildForum) throw new Error('bug-reports forum not found');
  const summary = interaction.fields.getTextInputValue('summary');
  const steps = interaction.fields.getTextInputValue('steps');
  const expected = interaction.fields.getTextInputValue('expected');
  const actual = interaction.fields.getTextInputValue('actual');
  const context = interaction.fields.getTextInputValue('context') || 'Not provided';
  const newTag = tagId(forum, 'New');
  const embed = entropyEmbed('BUG REPORT', `**${summary}**\n\n**REPRODUCTION**\n${steps}\n\n**EXPECTED**\n${expected}\n\n**ACTUAL**\n${actual}\n\n**ENVIRONMENT / LOG**\n${context}\n\n— ${interaction.user}`);
  const thread = await forum.threads.create({ name: summary.slice(0, 100), message: { embeds: [embed] }, appliedTags: newTag ? [newTag] : [] });
  await interaction.reply({ content: `Bug submitted: ${thread}`, flags: MessageFlags.Ephemeral });
}

export async function submitRequest(interaction) {
  const forum = findChannel(interaction.guild, 'feature-requests');
  if (!forum || forum.type !== ChannelType.GuildForum) throw new Error('feature-requests forum not found');
  const title = interaction.fields.getTextInputValue('title');
  const problem = interaction.fields.getTextInputValue('problem');
  const proposal = interaction.fields.getTextInputValue('proposal');
  const value = interaction.fields.getTextInputValue('value') || 'Not provided';
  const newTag = tagId(forum, 'New');
  const embed = entropyEmbed('FEATURE REQUEST', `**${title}**\n\n**PROBLEM**\n${problem}\n\n**PROPOSED CHANGE**\n${proposal}\n\n**WvW VALUE**\n${value}\n\n— ${interaction.user}`);
  const thread = await forum.threads.create({ name: title.slice(0, 100), message: { embeds: [embed] }, appliedTags: newTag ? [newTag] : [] });
  await interaction.reply({ content: `Feature request submitted: ${thread}`, flags: MessageFlags.Ephemeral });
}

export async function seedCommunity(guild) {
  const messages = {
    welcome: entropyEmbed(
      'ENTROPY // WvW COMBAT INTELLIGENCE',
      '**See the fight beneath the fight.**\n\nEntropy turns Guild Wars 2 WvW combat logs into clear, actionable intelligence — not just numbers. Explore performance, support, positioning, fight flow, player comparisons, replay, and the intelligence layer built around what actually happened.\n\n**START HERE**\n• Read **#getting-started**\n• Open **#downloads-and-setup** to install Entropy and configure logging\n• Watch **#announcements** and **#release-notes**\n• Ask for help in **#help**\n• Use `/bug` for reproducible issues\n• Use `/request` for ideas worth building\n\nWelcome to the place where Entropy gets sharper.'
    ),
    rules: entropyEmbed(
      'COMMUNITY STANDARD',
      '**Signal over noise. Evidence over ego.**\n\n**01 — Respect the person**\nChallenge builds, metrics, methodology, and conclusions — not people.\n\n**02 — Keep feedback useful**\nIf something is broken, explain what happened and how to reproduce it. If something could be better, explain why.\n\n**03 — Protect privacy and security**\nDo not post credentials, private personal information, malicious files, or material intended to harm other players.\n\n**04 — Keep discussion relevant**\nEntropy, Guild Wars 2 WvW, combat analysis, squad strategy, testing, builds, and product feedback belong here.\n\n**05 — Help us keep the signal clean**\nStaff may merge duplicates, retag reports, move threads, and close resolved discussions.'
    ),
    'getting-started': entropyEmbed(
      'GETTING STARTED',
      '**1. INSTALL**\nUse **#downloads-and-setup** for Entropy, ArcDPS, Healing Stats, and logging instructions.\n\n**2. LOAD**\nBring your generated WvW `.evtc`, `.zevtc`, or supported report into Entropy.\n\n**3. ANALYZE**\nUse fight, squad, offensive, defensive, support, replay, comparison, and intelligence views to understand what happened.\n\n**4. QUESTION**\nIf a result looks wrong or confusing, bring it to **#help** or submit a `/bug`.\n\n**5. IMPROVE**\nUse **#build-discussion**, **#wvw**, and the feedback forums to turn analysis into better decisions.'
    ),
    'downloads-and-setup': entropyEmbed(
      'DOWNLOADS // LOGGING SETUP',
      `**ENTROPY**\n[Open Entropy Web](${ENTROPY_LINKS.website})  •  [Download the latest desktop release](${ENTROPY_LINKS.releases})  •  [GitHub repository](${ENTROPY_LINKS.github})\n\n**REQUIRED — ARCDPS**\n[Official ArcDPS site](${ENTROPY_LINKS.arcdps})\n1. Close Guild Wars 2.\n2. Download ArcDPS and place the ArcDPS \`d3d11.dll\` next to \`gw2-64.exe\`.\n3. Start Guild Wars 2 and open ArcDPS options with **Alt + Shift + T**.\n4. Open **LOGGING**.\n5. Under the **WvW** section, enable **SAVE (AFTER SQUAD COMBAT)**.\n6. Set **MINIMUM ENEMY PLAYERS** to a value appropriate for your group. For organized zerg fights, **10** is a useful starting point; use a lower value for smaller-scale groups.\n\nArcDPS normally writes combat logs under:\n\`Documents\\Guild Wars 2\\addons\\arcdps\\arcdps.cbtlogs\`\n\n**RECOMMENDED — HEALING STATS**\n[Download ArcDPS Healing Stats](${ENTROPY_LINKS.healing})\n1. Download the latest stable \`arcdps_healing_stats.dll\`.\n2. Place it in the same directory as ArcDPS.\n3. Restart Guild Wars 2.\n4. Open **Alt + Shift + T → Extensions → healing_stats**.\n5. Enable **log healing** so healing-extension data is written into the EVTC log.\n6. Enable **live stats sharing** if you want squad members running the extension to exchange healing data live.\n\n**WHY THIS MATTERS**\nEntropy can analyze normal ArcDPS combat data without Healing Stats, but healing attribution is richer when the Healing Stats extension was present and logging its extension data. Not every squad member must run it, but coverage improves as more do.\n\n**READY**\nAfter a WvW squad combat segment ends, locate the newly created log and load it into Entropy. If Entropy cannot read a log or a metric looks incomplete, post in **#help** or use `/bug`.`
    ),
    roadmap: entropyEmbed(
      'ROADMAP // PRINCIPLE',
      'Entropy is developed around one rule: **new features must make the combat data more useful, more understandable, or more actionable.**\n\nThis channel is where planned work, experiments, major refinements, and longer-term direction will be surfaced as they become ready for public discussion.'
    ),
    'known-issues': entropyEmbed(
      'KNOWN ISSUES // STATUS BOARD',
      'Confirmed issues and workarounds will be posted here when they affect a meaningful portion of Entropy users.\n\nFor a new problem, use `/bug` so the report enters the structured feedback workflow instead of getting buried in chat.'
    ),
  };

  let seeded = 0;
  for (const [channelName, embed] of Object.entries(messages)) {
    const channel = findChannel(guild, channelName);
    if (!channel?.isTextBased()) continue;
    const recent = await channel.messages.fetch({ limit: 20 });
    const existing = recent.find((message) => message.author.id === guild.members.me?.id && message.embeds.some((item) => item.title === embed.data.title));
    if (existing) {
      const current = existing.embeds[0];
      if (current.description !== embed.data.description || current.footer?.text !== embed.data.footer?.text) {
        await existing.edit({ embeds: [embed] });
      }
      continue;
    }
    await channel.send({ embeds: [embed] });
    seeded += 1;
  }
  return seeded;
}
