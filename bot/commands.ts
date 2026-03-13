import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';

const leaderboard = new SlashCommandBuilder().setName('timecode-leaderboard').setDescription('le leaderboard');

const commandsFunctions = new Map<string, Function>();
commandsFunctions.set(leaderboard.name, (interaction: ChatInputCommandInteraction) => {
    interaction.reply('hello');
});

const commandsData = [leaderboard];

export { commandsData, commandsFunctions };