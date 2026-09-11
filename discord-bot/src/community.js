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

export function entropyEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(ENTROPY_GOLD)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: 'Entropy • WvW Combat Intelligence' })
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
  const embed = entropyEmbed('🐛 Bug Report', `**Summary**\n${summary}\n\n**Reproduction**\n${steps}\n\n**Expected**\n${expected}\n\n**Actual**\n${actual}\n\n**Environment / Log**\n${context}\n\nReported by ${interaction.user}`);
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
  const embed = entropyEmbed('✨ Feature Request', `**Problem**\n${problem}\n\n**Proposed change**\n${proposal}\n\n**WvW value**\n${value}\n\nRequested by ${interaction.user}`);
  const thread = await forum.threads.create({ name: title.slice(0, 100), message: { embeds: [embed] }, appliedTags: newTag ? [newTag] : [] });
  await interaction.reply({ content: `Feature request submitted: ${thread}`, flags: MessageFlags.Ephemeral });
}

export async function seedCommunity(guild) {
  const messages = {
    welcome: entropyEmbed('Welcome to Entropy', '**Entropy** is a Guild Wars 2 WvW combat analytics and intelligence platform.\n\nStart in **#getting-started**, discuss fights and builds with the community, and use `/bug` or `/request` whenever you want to help improve Entropy.\n\nThe goal here is simple: turn combat logs into information commanders and players can actually use.'),
    rules: entropyEmbed('Entropy Community Rules', '1. Treat people with respect. Debate builds, metrics and methodology — not people.\n2. Keep reports reproducible and evidence-driven when possible.\n3. Do not post private information, credentials, exploits intended for abuse, or malicious files.\n4. Keep feedback constructive and relevant to Entropy or Guild Wars 2 WvW.\n5. Staff may reorganize duplicate reports and requests to keep development signal clean.'),
    'getting-started': entropyEmbed('Getting Started', '**Using Entropy**\nLoad your supported combat logs into Entropy and explore the available fight, squad and intelligence views.\n\n**Need help?** Use **#help**.\n**Found a bug?** Run `/bug`.\n**Have an idea?** Run `/request`.\n**Want development news?** Watch **#announcements** and **#release-notes**.'),
  };
  let seeded = 0;
  for (const [channelName, embed] of Object.entries(messages)) {
    const channel = findChannel(guild, channelName);
    if (!channel?.isTextBased()) continue;
    const recent = await channel.messages.fetch({ limit: 20 });
    if (recent.some((message) => message.author.id === guild.members.me?.id && message.embeds.some((item) => item.title === embed.data.title))) continue;
    await channel.send({ embeds: [embed] });
    seeded += 1;
  }
  return seeded;
}
