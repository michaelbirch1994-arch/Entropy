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
      '✦ ENTROPY // WvW COMBAT INTELLIGENCE',
      `**See the fight beneath the fight.**\n\nEntropy is a Guild Wars 2 WvW analytics platform built to turn combat logs into useful squad intelligence instead of a wall of numbers.\n\n**WHAT YOU CAN DO**\n▸ Analyze squad and player performance\n▸ Review offensive, defensive, support, and healing data\n▸ Compare players from the logs currently loaded\n▸ Inspect fight flow, positioning, replay, and critical events\n▸ Explore Entropy Intelligence findings\n▸ Use the Builder for builds, roles, and composition planning\n\n**START HERE**\n▸ **#getting-started** — learn the workflow\n▸ **#downloads-and-setup** — install Entropy and configure logging\n▸ **#release-notes** — see what shipped\n▸ **#help** — get assistance\n▸ **/bug** — report something broken\n▸ **/request** — propose a feature\n\n[Open Entropy Web](${ENTROPY_LINKS.website})  •  [Latest Desktop Release](${ENTROPY_LINKS.releases})`
    ),
    rules: entropyEmbed(
      '◆ COMMUNITY STANDARD',
      '**Signal over noise. Evidence over ego.**\n\n**01 — Respect the person**\nChallenge builds, metrics, methodology, and conclusions — not people.\n\n**02 — Keep feedback useful**\nIf something is broken, explain what happened and how to reproduce it. If something could be better, explain why.\n\n**03 — Protect privacy and security**\nDo not post credentials, private personal information, malicious files, or material intended to harm other players.\n\n**04 — Keep discussion relevant**\nEntropy, Guild Wars 2 WvW, combat analysis, squad strategy, testing, builds, and product feedback belong here.\n\n**05 — Help us keep the signal clean**\nStaff may merge duplicates, retag reports, move threads, and close resolved discussions.'
    ),
    'getting-started': entropyEmbed(
      '⚙ GETTING STARTED // 5 MINUTE PATH',
      `**1 — INSTALL**\nUse **#downloads-and-setup** for Entropy, ArcDPS, Healing Stats, and WvW logging.\n\n**2 — CREATE A LOG**\nRun ArcDPS during WvW and let it save your squad-combat log.\n\n**3 — LOAD IT**\nOpen [Entropy Web](${ENTROPY_LINKS.website}) or the desktop app and load your \`.evtc\`, \`.zevtc\`, or supported parsed report.\n\n**4 — READ THE FIGHT**\nStart with Overview, then move into offensive, defensive, support, player comparison, replay, and intelligence views.\n\n**5 — IMPROVE**\nBring questions to **#wvw**, builds to **#build-discussion**, problems to **#help**, and reproducible issues to **/bug**.`
    ),
    'downloads-and-setup': entropyEmbed(
      '⬇ DOWNLOADS // LOGGING SETUP',
      `**ENTROPY**\n[Open Entropy Web](${ENTROPY_LINKS.website})  •  [Download latest desktop release](${ENTROPY_LINKS.releases})  •  [GitHub repository](${ENTROPY_LINKS.github})\n\n**REQUIRED — ARCDPS**\n[Official ArcDPS site](${ENTROPY_LINKS.arcdps})\n1. Close Guild Wars 2.\n2. Place ArcDPS \`d3d11.dll\` beside \`gw2-64.exe\`.\n3. Launch GW2 and open ArcDPS options with **Alt + Shift + T**.\n4. Open **LOGGING**.\n5. Under **WvW**, enable **SAVE (AFTER SQUAD COMBAT)**.\n6. Choose an appropriate **MINIMUM ENEMY PLAYERS** value. **10** is a good organized-zerg starting point; use less for havoc or smaller fights.\n\n**DEFAULT LOG LOCATION**\n\`Documents\\Guild Wars 2\\addons\\arcdps\\arcdps.cbtlogs\`\n\n**RECOMMENDED — HEALING STATS**\n[Download Healing Stats](${ENTROPY_LINKS.healing})\n1. Download \`arcdps_healing_stats.dll\`.\n2. Place it beside ArcDPS.\n3. Restart GW2.\n4. Open **Alt + Shift + T → Extensions → healing_stats**.\n5. Enable **log healing**.\n6. Optionally enable **live stats sharing**.\n\n**WHY IT MATTERS**\nEntropy works without Healing Stats, but healing attribution and support coverage are richer when the extension data is present.`
    ),
    announcements: entropyEmbed(
      '★ ENTROPY // OFFICIAL UPDATES',
      `This channel is reserved for high-signal project announcements: major releases, important fixes, public testing windows, and changes that affect how you use Entropy.\n\nFor normal version-by-version detail, follow **#release-notes**.\n\n[Entropy Web](${ENTROPY_LINKS.website})  •  [GitHub](${ENTROPY_LINKS.github})`
    ),
    'release-notes': entropyEmbed(
      '⬆ RELEASE NOTES // WHERE TO FOLLOW BUILDS',
      `Every shipped Entropy version is published through GitHub Releases.\n\n**LATEST STABLE DOWNLOAD**\n${ENTROPY_LINKS.releases}\n\nUse this channel for concise release summaries: what changed, why it matters, known limitations, and whether a change affects desktop, web, parsing, analytics, intelligence, replay, or Builder workflows.`
    ),
    roadmap: entropyEmbed(
      '◇ ROADMAP // PRODUCT DIRECTION',
      '**CORE PRINCIPLE**\nNew features should make combat data more useful, understandable, or actionable.\n\n**CURRENT PRODUCT AREAS**\n▸ Combat analytics and report quality\n▸ Entropy Intelligence and critical-event interpretation\n▸ Fight replay and evidence presentation\n▸ Builder and squad-composition workflows\n▸ Player-v-player comparison from currently loaded logs\n▸ Desktop/web polish and performance\n▸ Better onboarding, support, and community tooling\n\nIdeas that deserve consideration belong in **#feature-requests** or through **/request**.'
    ),
    'known-issues': entropyEmbed(
      '⚠ KNOWN ISSUES // STATUS BOARD',
      'Confirmed issues and workarounds will be posted here when they affect a meaningful portion of Entropy users.\n\n**Before reporting**\n▸ Make sure you are on the latest Entropy version\n▸ Note whether you are using web or desktop\n▸ Include browser/version when relevant\n▸ Include a log or report link when the issue depends on combat data\n\nUse **/bug** so the report enters the structured workflow instead of getting buried in chat.'
    ),
    help: entropyEmbed(
      '✚ ENTROPY SUPPORT // HOW TO GET A FAST ANSWER',
      `When asking for help, include:\n▸ Entropy version\n▸ Web or desktop\n▸ Browser if using web\n▸ What you were trying to do\n▸ What happened instead\n▸ A log/report link when safe and relevant\n\n**COMMON LINKS**\n[Entropy Web](${ENTROPY_LINKS.website})\n[Latest Desktop Release](${ENTROPY_LINKS.releases})\n[ArcDPS](${ENTROPY_LINKS.arcdps})\n[Healing Stats](${ENTROPY_LINKS.healing})\n\nFor a reproducible product defect, use **/bug**.`
    ),
    wvw: entropyEmbed(
      '⚔ WvW // COMBAT DISCUSSION',
      'Use this channel for fight review, squad strategy, positioning, engage timing, boon/support discussion, comp decisions, and anything that connects WvW gameplay to Entropy data.\n\nScreenshots and clips belong in **#screenshots-clips**; specific build theory belongs in **#build-discussion**.'
    ),
    'build-discussion': entropyEmbed(
      '◆ BUILDS // ROLES // COMPOSITIONS',
      'Use this channel for profession builds, subgroup structure, role coverage, support pairings, target-cap considerations, and squad-composition theorycrafting.\n\nWhen possible, explain the job the build is meant to perform — not just the gear and traits.'
    ),
    'beta-testing': entropyEmbed(
      '◈ BETA TESTING // VALIDATION',
      'Use this channel for focused test passes against upcoming Entropy changes.\n\nGood test feedback includes the build/version, test scenario, expected result, actual result, and evidence. Structured outcomes can be posted in **#test-results**.'
    ),
    'experimental-features': entropyEmbed(
      '✦ EXPERIMENTAL // PREVIEW SYSTEMS',
      'This is where unfinished or higher-risk Entropy ideas can be discussed before they are promoted into the normal product. Expect iteration, changing behavior, and occasional rough edges.'
    ),
  };

  let seeded = 0;
  for (const [channelName, embed] of Object.entries(messages)) {
    const channel = findChannel(guild, channelName);
    if (!channel?.isTextBased()) continue;
    const recent = await channel.messages.fetch({ limit: 30 });
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
