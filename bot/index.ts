import { Client, Events, GatewayIntentBits } from 'discord.js';
import { commandsFunctions, startScheduler } from './commands.js';

const token = process.env.BOT_TOKEN;
const client = new Client({ intents: GatewayIntentBits.Guilds });

client.once(Events.ClientReady, (readyClient) => {
    console.log(`bot is connected as ${readyClient.user.tag}`);
    startScheduler(readyClient);
});

client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = commandsFunctions.get(interaction.commandName);

    if (!command) {
        console.log(`no command ${interaction.commandName} found`);
        return;
    }

    command(interaction);
});

client.login(token);