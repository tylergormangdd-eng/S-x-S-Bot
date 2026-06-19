import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('sxs')
    .setDescription('Open the Sword x Staff AI Codex'),

  new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask the Sword x Staff AI Codex a question')
    .addStringOption(option =>
      option
        .setName('question')
        .setDescription('Example: best Sage build, latest codes, Fantomon for healer')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('sxs-search')
    .setDescription('Search the Sword x Staff EOG.GG catalog')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('Search terms, e.g. sage dark build')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('sxs-refresh')
    .setDescription('Refresh the EOG.GG catalog and AI index')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

try {
  console.log('Registering slash commands...');
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.DISCORD_CLIENT_ID,
      process.env.DISCORD_GUILD_ID
    ),
    { body: commands }
  );
  console.log('Slash commands registered.');
} catch (error) {
  console.error(error);
  process.exit(1);
}
