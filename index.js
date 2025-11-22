require('dotenv').config();           

const Groq = require('groq-sdk');     

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const { Client, Intents } = require('discord.js');
const token = 'MTE1OTExOTg3OTA3MzQ0Nzk0Nw.GWbAkG.OALGPRNoZJsBf-Cs3_FkM_p5VSke_XdV5_Trjk';

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_VOICE_STATES,
    ],
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);

    let botStatus = [
        'akulah mister D',
        `${client.users.cache.size} users!`,
        `${client.guilds.cache.size} servers!`
    ];

    setInterval(() => {
        let status = botStatus[Math.floor(Math.random() * botStatus.length)];
        client.user.setActivity(status, { type: 'LISTENING' });
    }, 5000);

    console.log(`${client.user.username} is online!`);
});

async function handleMessage(message) {
    console.log(`Message from ${message.author.tag}: ${message.content}`);

    if (message.author.bot) return;

        // === LLM: !ditos <pesan> ===
    if (message.content.startsWith('!ditos ')) {
    const prompt = message.content.slice('!ditos '.length).trim();
    if (!prompt) {
        return message.reply('tulis pesannya juga dong, contoh: `!ditos jelasin apa itu GPU`');
    }

    try {
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile', // model default Groq yang kenceng :contentReference[oaicite:0]{index=0}
            messages: [
                {
                    role: 'system',
                    content:
                        'Kamu adalah bot Discord bernama Ditos. Gaya bicara santai, campur Indonesia dan sedikit English. Suka ngejokes, konyol, kadang nyolot dikit tapi tetap bantu jelasin dengan jelas dan ringkas. Jangan terlalu panjang, jangan formal.'
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.8,
            max_completion_tokens: 300,
        });

        const replyText = completion.choices?.[0]?.message?.content?.trim();

        if (!replyText) {
            return message.reply('Ditos lagi ngeblank, coba tanya sekali lagi dong 😵‍💫');
        }

        return message.reply(replyText);

    } catch (error) {
        console.error('Groq error:', error);
        return message.reply('otak Groq-nya lagi error nih, coba sebentar lagi ya 😭');
    }
}

    if (message.content === '!ping') {
        return message.reply('!pong');
    }

    if (message.content.toLowerCase() === 'halo') {
        return message.channel.send('Halo! Ada yang bisa saya bantu?');
    }

    if (message.content.toLowerCase() === 'woi <@1159119879073447947>') {
        return message.channel.send('apcb');
    }

    if (message.content.toLowerCase() === '<@1159119879073447947>') {
        return message.channel.send('apcb');
    }

    if (message.content === '!sinijoin') {
        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) {
            return message.reply('Minimal kalo mau command ini lu di vois dulu bos');
        }

        try {
        await voiceChannel.join();
    } catch (err) {
        if (err.code === 'VOICE_CONNECTION_TIMEOUT') {
            console.log('false alarm, cuekin aja ini.');
        } else {
            console.error(err);
            return message.reply('Seseorang bilangin <@756989869108101243> kalo bot nya error');
        }
    }

    console.log('Joined voice:', voiceChannel.name);
    return message.reply(`mana nih..? **${voiceChannel.name}** `);
}

    if (message.content === '!sanaleave') {
        const meVoice = message.guild.me?.voice?.channel;
        if (!meVoice) {
            return message.reply('vois aja kagak gw');
        }

        meVoice.leave();
        return message.reply('nooo aku di kik :sob:');
    }
}

client.on('messageCreate', handleMessage);
client.on('message', handleMessage);

client.login(token);