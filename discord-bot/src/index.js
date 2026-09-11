import {
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import { setupEntropyServer } from './setupServer.js';

const token = process.env.DISCORD_BOT_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !applicationId || !guildId) {
  console.error(
    'Missing DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID, or DISCORD_GUILD_ID.',
  );
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Create or repair the Entropy Discord community structure.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check whether the Entropy bot is online.'),
].map((command) => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(applicationId, guildId), {
    body: commands,
  });
  console.log(`Registered ${commands.length} guild commands.`);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Entropy Discord bot online as ${readyClient.user.tag}.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'status') {
    await interaction.reply({
      content: '🟡 **Entropy is online.** Community systems are operational.',
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName !== 'setup') return;

  if (!interaction.inGuild() || interaction.guildId !== guildId) {
    await interaction.reply({
      content: 'This setup command is restricted to the configured Entropy server.',
      ephemeral: true,
    });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content: 'You need **Manage Server** permission to run `/setup`.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const result = await setupEntropyServer(interaction.guild);
    await interaction.editReply(
      [
        '✅ **Entropy community setup complete.**',
        '',
        `Roles: ${result.rolesCreatedOrFound}`,
        `Categories: ${result.categoriesCreatedOrFound}`,
        `Public channels/forums: ${result.publicChannelsCreatedOrFound}`,
        '',
        'The setup is non-destructive and can be run again to restore missing Entropy resources.',
      ].join('\n'),
    );
  } catch (error) {
    console.error('Entropy setup failed:', error);

    if (error?.code === 'COMMUNITY_REQUIRED') {
      await interaction.editReply(
        '⚠️ **Enable Discord Community first.** Go to Server Settings → Enable Community, finish Discord’s setup, then run `/setup` again. Entropy uses Community features for forum-style bug reports and feature requests.',
      );
      return;
    }

    await interaction.editReply(
      '❌ Setup failed. Check the bot logs and confirm it still has Manage Channels and Manage Roles permissions.',
    );
  }
});

try {
  await registerCommands();
  await client.login(token);
} catch (error) {
  console.error('Failed to start Entropy Discord bot:', error);
  process.exit(1);
}
