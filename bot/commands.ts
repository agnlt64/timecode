import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, TextChannel, Client } from 'discord.js';

interface Project {
    rank: number;
    projectName: string;
    seconds: number;
}

interface APIResponse {
    from: string;
    to: string;
    limit: number;
    items: Project[];
}

const API_BASE = process.env.TIMECODE_API_URL ?? 'https://timecode.agnlt64.xyz';

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h${m}m`;
}

function todayLocal(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgoLocal(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PERIOD_CHOICES = [
    { name: '7 derniers jours', value: '7d' },
    { name: '30 derniers jours', value: '30d' },
    { name: "Aujourd'hui", value: '1d' },
];

async function fetchLeaderboardEmbed(periodChoice: string, limit: number): Promise<EmbedBuilder | string> {
    const to = todayLocal();
    const days = parseInt(periodChoice.replace('d', ''), 10);
    const from = days === 1 ? to : daysAgoLocal(days - 1);
    const url = `${API_BASE}/api/v1/leaderboard?from=${from}&to=${to}&limit=${limit}`;

    let data: APIResponse;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        data = await res.json() as APIResponse;
    } catch {
        return '❌ Impossible de contacter l\'API Timecode.';
    }

    if (data.items.length === 0) return '📭 Aucune donnée pour cette période.';

    const durations = data.items.map(item => formatDuration(item.seconds));
    const maxNameLen = Math.max(...data.items.map(item => item.projectName.length));
    const maxDurLen = Math.max(...durations.map(d => d.length));

    const rows = data.items.map((item, i) => {
        const medal = RANK_MEDALS[item.rank - 1] ?? `\`${String(item.rank).padStart(1)}.\``;
        const name = item.projectName.padEnd(maxNameLen);
        const duration = durations[i]!.padStart(maxDurLen);
        return `${medal} \`${name}  ${duration}\``;
    });

    const periodLabel = PERIOD_CHOICES.find(p => p.value === periodChoice)?.name ?? periodChoice;

    return new EmbedBuilder()
        .setTitle('⌨️  Timecode Leaderboard')
        .setDescription(rows.join('\n'))
        .setColor(0x5865F2)
        .addFields({ name: 'Période', value: periodLabel, inline: true })
        .setFooter({ text: `Top ${data.items.length} projet${data.items.length > 1 ? 's' : ''}` })
        .setTimestamp();
}

// Scheduler: posts the leaderboard automatically at a fixed interval
export function startScheduler(client: Client): void {
    const channelId = process.env.LEADERBOARD_CHANNEL_ID;
    const intervalHours = parseFloat(process.env.LEADERBOARD_INTERVAL_HOURS ?? '168'); // one week
    const period = process.env.LEADERBOARD_PERIOD ?? '7d';
    const limit = parseInt(process.env.LEADERBOARD_LIMIT ?? '10', 10);

    if (!channelId) return;

    const post = async () => {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel?.isTextBased()) return;

        const result = await fetchLeaderboardEmbed(period, limit);
        if (typeof result === 'string') {
            await (channel as TextChannel).send(result);
        } else {
            await (channel as TextChannel).send({ embeds: [result] });
        }
    };

    setInterval(post, intervalHours * 3600 * 1000);
    console.log(`Leaderboard scheduler started (every ${intervalHours}h → #${channelId})`);
}

const leaderboard = new SlashCommandBuilder()
    .setName('timecode-leaderboard')
    .setDescription('Classement des projets par temps de code')
    .addStringOption(opt =>
        opt.setName('period')
            .setDescription('Période à afficher')
            .addChoices(...PERIOD_CHOICES)
    )
    .addIntegerOption(opt =>
        opt.setName('limit')
            .setDescription('Nombre de projets à afficher (défaut: 10, max: 100)')
            .setMinValue(1)
            .setMaxValue(100)
    );

const commandsFunctions = new Map<string, Function>();
commandsFunctions.set(leaderboard.name, async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    const periodChoice = interaction.options.getString('period') ?? '7d';
    const limit = interaction.options.getInteger('limit') ?? 10;
    const result = await fetchLeaderboardEmbed(periodChoice, limit);

    if (typeof result === 'string') {
        await interaction.editReply({ content: result });
    } else {
        await interaction.editReply({ embeds: [result] });
    }
});

const commandsData = [leaderboard];

export { commandsData, commandsFunctions };
