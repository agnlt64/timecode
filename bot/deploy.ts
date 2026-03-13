// only run this when commands *definition* changes

import { REST, Routes } from 'discord.js';
import { commandsData } from './commands.js';

const token = process.env.BOT_TOKEN!;
const clientId = process.env.CLIENT_ID!;
const guildId = process.env.GUILD_ID!;

const rest = new REST().setToken(token);

(async () => {
    try {
        console.log('refreshing slash commands...');
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
            body: Array.from(commandsData, c => c.toJSON()),
        });
        console.log('reloaded commands');
    } catch (e) {
        console.log(e);
    }
})();