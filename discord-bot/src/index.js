import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import { setupEntropyServer } from './setupServer.js';
import {
  buildBugModal,
  buildRequestModal,
  seedCommunity,
  submitBug,
  submitRequest,
} from './community.js';

const token = process.env.DISCORD_BOT_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !applicationId || !guildId) {
  console.error('Missing DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID, or DISCORD_GUILD_ID.');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Create or repair the Entropy Discord community structure.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('status').setDescription('Check whether the Entropy bot is online.'),
  new SlashCommandBuilder().setName('bug').setDescription('Submit a structured Entropy bug report.'),
  new SlashCommandBuilder().setName('request').setDescription('Submit an Entropy feature request.'),
  new SlashCommandBuilder()
    .setName('seed')
    .setDescription('Publish or repair Entropy welcome and onboarding messages.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((command) => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(applicationId, guildId), { body: commands });
  console.log(`Registered ${commands.length} guild commands.`);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Entropy Discord bot online as ${readyClient.user.tag}.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isModalSubmit()) {
      if (!interaction.inGuild() || interaction.guildId !== guildId) return;
      if (interaction.customId === 'entropy:bug') await submitBug(interaction);
      if (interaction.customId === 'entropy:request') await submitRequest(interaction);
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'status') {
      await interaction.reply({ content: '🟡 **Entropy is online.** Community systems are operational.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (!interaction.inGuild() || interaction.guildId !== guildId) {
      await interaction.reply({ content: 'This command is restricted to the configured Entropy server.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (interaction.commandName === 'bug') {
      await interaction.showModal(buildBugModal());
      return;
    }

    if (interaction.commandName === 'request') {
      await interaction.showModal(buildRequestModal());
      return;
    }

    if (interaction.commandName === 'seed') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: 'You need **Manage Server** permission to run `/seed`.', flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const count = await seedCommunity(interaction.guild);
      await interaction.editReply(`✅ Entropy onboarding is ready. Published ${count} missing branded message${count === 1 ? '' : 's'}.`);
      return;
    }

    if (interaction.commandName !== 'setup') return;

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need **Manage Server** permission to run `/setup`.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const result = await setupEntropyServer(interaction.guild);
      const seeded = await seedCommunity(interaction.guild);
      await interaction.editReply([
        '✅ **Entropy community setup complete.**',
        '',
        `Roles: ${result.rolesCreatedOrFound}`,
        `Categories: ${result.categoriesCreatedOrFound}`,
        `Public channels/forums: ${result.publicChannelsCreatedOrFound}`,
        `Onboarding messages published: ${seeded}`,
        '',
        'The setup is non-destructive and can be run again to restore missing Entropy resources.',
      ].join('\n'));
    } catch (error) {
      console.error('Entropy setup failed:', error);
      if (error?.code === 'COMMUNITY_REQUIRED') {
        await interaction.editReply('⚠️ **Enable Discord Community first.** Go to Server Settings → Enable Community, finish Discord’s setup, then run `/setup` again.');
        return;
      }
      await interaction.editReply('❌ Setup failed. Check the bot logs and confirm it has permission to manage the Entropy server structure.');
    }
  } catch (error) {
    console.error('Entropy interaction failed:', error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Entropy could not complete that request. The error has been logged.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

try {
  await registerCommands();
  await client.login(token);
} catch (error) {
  console.error('Failed to start Entropy Discord bot:', error);
  process.exit(1);
}
