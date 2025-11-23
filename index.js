require('dotenv').config();

const Groq = require('groq-sdk');
const ytSearch = require('yt-search');
const ytpl = require('ytpl');
const axios = require('axios');
const sharp = require('sharp');

const OWNER_ID = '756989869108101243';
const ERROR_CHANNEL_ID = '1442006544030896138';

const fs = require('fs');

const SOUNDBOARD_CLIPS = {
  acumalaka: {
    title: 'Acumalaka',
    file: './sounds/acumalaka.mp3',
  },
  tengkorak: {
    title: 'Tengkorak Rawr',
    file: './sounds/tengkorak-rawr.mp3',
  },
  ahlele: {
    title: 'Ahleleele ahlelas',
    file: './sounds/ahlele.mp3',
  },
};

const {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
} = require('discord.js');

const {
  joinVoiceChannel,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
} = require('@discordjs/voice');

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const token = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences, 
  ],
  partials: [Partials.Channel],
});

async function reportErrorToDiscord(err) {
  try {
    const channel = await client.channels.fetch(ERROR_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return;

    const raw =
      err instanceof Error
        ? (err.stack || err.message || String(err))
        : String(err);

    const snippet =
      raw.length > 1500 ? raw.slice(0, 1500) + '\n...[dipotong]...' : raw;

    await channel.send({
      content: `Seseorang bilangin <@${OWNER_ID}> kalo bot nya error.\n\`\`\`\n${snippet}\n\`\`\``,
    });
  } catch (reportErr) {
    console.error('Gagal kirim laporan error ke Discord:', reportErr);
  }
}

client.on('error', (err) => {
  console.error('Discord client error:', err);
  reportErrorToDiscord(err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  reportErrorToDiscord(
    reason instanceof Error ? reason : new Error(String(reason)),
  );
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  reportErrorToDiscord(err);
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  const botStatus = [
    'akulah mister D',
    `${client.users.cache.size} users!`,
    `${client.guilds.cache.size} servers!`,
  ];

  setInterval(() => {
    const status = botStatus[Math.floor(Math.random() * botStatus.length)];
    client.user.setActivity(status, { type: ActivityType.Listening });
  }, 5000);

  console.log(`${client.user.username} is online!`);
});

const commands = {
  '!ditoshelp': 'Menampilkan semua command',
  '!ditosping': 'Tes bot (bot reply !pong)',
  '!ditos <pesan>': 'Chat dengan LLM Groq',
  '!sinijoin': 'Bot join voice channel',
  '!sanaleave': 'Bot keluar dari voice channel',
  'halo': 'Bot menyapa balik',
  'ditos play <judul atau link>': 'Memutar musik dari YouTube',
  'ditos skip': 'Melewati lagu yang sedang diputar',
  'ditos stop': 'Menghentikan pemutaran musik dan keluar dari voice channel',
  'ditos sb <nama>': 'Memutar soundboard lokal (list soundboard: acumalaka, ahlele, tengkorak)',
  'ditos joke': 'Random dad jokes',
  'ditos userinfo @user': 'Info lengkap tentang user',
  'ditos serverinfo': 'Info tentang server',
  '!ditosclear': 'Clear conversation history dengan bot',
};

const musicQueues = new Map();
const conversationHistory = new Map();

const ytdlExec = require('yt-dlp-exec');

async function playNext(guildId) {
  const queue = musicQueues.get(guildId);

  if (!queue || !queue.songs || queue.songs.length === 0) {
    console.log(`[Music] Queue kosong di guild ${guildId}, stop.`);
    musicQueues.delete(guildId);
    return;
  }

  const song = queue.songs[0];
  if (!song) {
    queue.player.stop();
    queue.connection.destroy();
    musicQueues.delete(guildId);
    return;
  }

  try {
    const subprocess = ytdlExec.exec(song.url, {
      output: '-',
      format: 'bestaudio[ext=m4a]/bestaudio',
    });

    subprocess.stderr.on('data', (data) => {
      console.log('[yt-dlp]', data.toString());
    });

    const resource = createAudioResource(subprocess.stdout, {
      inputType: StreamType.Arbitrary,
    });

    queue.player.play(resource);
    await queue.textChannel.send(`Playing: **${song.title}**`);
  } catch (err) {
    console.error('yt-dlp error:', err);
    queue.songs.shift();
    playNext(guildId);
  }
}

async function playLocalSound(voiceChannel, key, textChannel) {
  const clip = SOUNDBOARD_CLIPS[key];
  if (!clip) {
    if (textChannel) {
      await textChannel.send(`Soundboard \`${key}\` belum ada.`);
    }
    return;
  }

  if (!fs.existsSync(clip.file)) {
    if (textChannel) {
      await textChannel.send(
        `File soundboard untuk \`${key}\` nggak ketemu di ${clip.file}`
      );
    }
    return;
  }

  let connection =
    getVoiceConnection(voiceChannel.guild.id) ||
    joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
    });

  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play,
    },
  });

  const stream = fs.createReadStream(clip.file);
  const resource = createAudioResource(stream, {
    inputType: StreamType.Arbitrary,
  });

  connection.subscribe(player);
  player.play(resource);

  player.once(AudioPlayerStatus.Playing, () => {
    console.log(`🔊 Soundboard: ${clip.title}`);
    if (textChannel) {
      textChannel.send(`🗣️ 🔊 Soundboard: **${clip.title}**`);
    }
  });

  player.once(AudioPlayerStatus.Idle, () => {
    player.stop();
  });

  player.on('error', (err) => {
    console.error('Soundboard player error:', err);
    if (textChannel) {
      textChannel.send('Soundboard error, coba lagi ya.');
    }
  });
}

async function analyzeImageWithGemini(imageUrl) {
  try {
    console.log('[Gemini] Downloading image:', imageUrl);
    
    const imageResponse = await axios.get(imageUrl, { 
      responseType: 'arraybuffer',
      timeout: 10000
    });
    
    console.log('[Gemini] Image downloaded, resizing...');
    
    const resizedBuffer = await sharp(imageResponse.data)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();
    
    const base64Image = resizedBuffer.toString('base64');
    
    console.log('[Gemini] Resized to:', resizedBuffer.length, 'bytes');
    
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash'
    });
    
    console.log('[Gemini] Sending to Gemini API...');
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Gemini timeout after 45s')), 45000)
    );
    
    const result = await Promise.race([
      model.generateContent([
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64Image,
          },
        },
        'Deskripsikan gambar ini dengan detail tapi singkat dalam bahasa Indonesia. Fokus ke hal-hal penting yang ada di gambar.',
      ]),
      timeoutPromise
    ]);
    
    const response = await result.response;
    const text = response.text();
    
    console.log('[Gemini] Response received:', text.substring(0, 100) + '...');
    
    return text;
  } catch (error) {
    console.error('[Gemini] Error:', error.message);
    return null;
  }
}

async function handleMessage(message) {
  if (message.author.bot) return; 

  console.log(`[${new Date().toISOString()}] Message from ${message.author.tag}: ${message.content}`);

  const content = message.content;
  const lower = content.toLowerCase();

  if (lower.startsWith('ditos ')) {
    const args = content.slice('ditos '.length).trim().split(/\s+/);
    const sub = args.shift()?.toLowerCase();

    const guildId = message.guild.id;

    const voiceChannel = message.member?.voice?.channel;

  if (sub === 'joke') {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'Kamu adalah comedian yang ahli bikin dad jokes Indonesia yang lucu dan konyol. Kasih 1 joke singkat aja, gak usah panjang-panjang. Jangan repetitif juga jokes nya.'
        },
        {
          role: 'user',
          content: 'Kasih dad joke yang lucu dong'
        }
      ],
      temperature: 1.0,
      max_completion_tokens: 150,
    });

    const joke = completion.choices?.[0]?.message?.content?.trim();
    return message.reply(`${joke} 😂` || 'Eh joke nya ilang, coba lagi');
  } catch (err) {
    console.error('Groq joke error:', err);
    return message.reply('Error pas bikin joke nih');
  }
}
  
  if (sub === 'userinfo' || sub === 'ui') {
  try {
    let targetUser = message.mentions.users.first() || message.author;
    let member = message.guild.members.cache.get(targetUser.id);

    if (!member) {
      return message.reply('User tidak ditemukan di server ini');
    }

    const joinedAt = member.joinedAt;
    const createdAt = targetUser.createdAt;
    
    const formatDate = (date) => {
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const daysSinceJoin = Math.floor((Date.now() - joinedAt) / (1000 * 60 * 60 * 24));
    const daysSinceCreation = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));

    const roles = member.roles.cache
      .filter(role => role.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map(role => role.name)
      .join(', ') || 'Tidak ada role';

    const statusEmoji = {
      online: '🟢 Online',
      idle: '🟡 Idle',
      dnd: '🔴 Do Not Disturb',
      offline: '⚫ Offline'
    };
    const status = statusEmoji[member.presence?.status] || '⚫ Offline';

    const infoText = `
**👤 User Info: ${targetUser.tag}**

**🆔 User ID:** ${targetUser.id}
**📛 Nickname:** ${member.nickname || 'Tidak ada'}
**📊 Status:** ${status}
**🎨 Warna Role:** ${member.displayHexColor}

**📅 Akun Dibuat:** ${formatDate(createdAt)} (${daysSinceCreation} hari lalu)
**📥 Join Server:** ${formatDate(joinedAt)} (${daysSinceJoin} hari lalu)

**🎭 Roles (${member.roles.cache.size - 1}):** ${roles}

**🤖 Bot:** ${targetUser.bot ? 'Ya' : 'Tidak'}
**👑 Owner Server:** ${message.guild.ownerId === targetUser.id ? 'Ya' : 'Tidak'}
    `.trim();

    await message.reply(infoText);
    
    try {
      const avatarURL = targetUser.displayAvatarURL({ size: 256, dynamic: true });
      await message.channel.send({ files: [avatarURL] });
    } catch (avatarErr) {
      console.error('Avatar fetch error:', avatarErr);
    }
    
    return;

  } catch (err) {
    console.error('Userinfo error:', err);
    return message.reply('Error pas ngambil info user nih');
  }
}

  if (sub === 'serverinfo' || sub === 'si') {
  try {
    const guild = message.guild;
    
    const formatDate = (date) => {
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    };

    const daysSinceCreation = Math.floor((Date.now() - guild.createdAt) / (1000 * 60 * 60 * 24));

    const members = guild.members.cache;
    const bots = members.filter(m => m.user.bot).size;
    const humans = members.size - bots;

    const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;

    const roleCount = guild.roles.cache.size - 1;

    const emojiCount = guild.emojis.cache.size;

    const boostLevel = guild.premiumTier;
    const boostCount = guild.premiumSubscriptionCount || 0;

    const serverInfo = `
**🏠 Server Info: ${guild.name}**

**🆔 Server ID:** ${guild.id}
**👑 Owner:** <@${guild.ownerId}>
**📅 Dibuat:** ${formatDate(guild.createdAt)} (${daysSinceCreation} hari lalu)

**👥 Members:** ${guild.memberCount} total
  ├─ 👤 Humans: ${humans}
  └─ 🤖 Bots: ${bots}

**💬 Channels:** ${guild.channels.cache.size} total
  ├─ 📝 Text: ${textChannels}
  └─ 🔊 Voice: ${voiceChannels}

**🎭 Roles:** ${roleCount}
**😀 Emojis:** ${emojiCount}

**✨ Boost Status:**
  ├─ Level: ${boostLevel}
  └─ Boosts: ${boostCount}

**🔒 Verification Level:** ${guild.verificationLevel}
    `.trim();

    await message.reply(serverInfo);
    
    if (guild.iconURL()) {
      try {
        const iconURL = guild.iconURL({ size: 256, dynamic: true });
        await message.channel.send({ files: [iconURL] });
      } catch (iconErr) {
        console.error('Icon fetch error:', iconErr);
      }
    }
    
    return;

  } catch (err) {
    console.error('Serverinfo error:', err);
    return message.reply('Error pas ngambil info server nih');
  }
}
  if (sub === 'play') {
  if (!voiceChannel) {
    return message.reply('Minimal kalo mau dengerin musik, lu di vois dulu bos');
  }

  const query = args.join(' ');
  if (!query) {
    return message.reply('Kasih judul atau link bok- lagunya dong, contoh: `ditos play funky town`');
  }

  try {
    if (await ytpl.validateID(query)) {
    const playlist = await ytpl(query, { limit: 100 });

    let queue = musicQueues.get(guildId);
    let wasEmpty = !queue || !queue.songs || queue.songs.length === 0;

    if (!queue) {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
    });

    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
      },
    });

    connection.subscribe(player);

    queue = {
      voiceChannel,
      textChannel: message.channel,
      connection,
      player,
      songs: [],
    };

    musicQueues.set(guildId, queue);

    player.on(AudioPlayerStatus.Idle, () => {
      queue.songs.shift();
      playNext(guildId);
    });

    player.on('error', (err) => {
      console.error('Player error:', err);
      queue.songs.shift();
      playNext(guildId);
    });

    wasEmpty = true;
    }

    for (const item of playlist.items) {
      queue.songs.push({
      title: item.title,
      url: item.shortUrl || item.url,
      requestedBy: message.author.tag,
     });
    }

    await message.reply(
      `Nambahin playlist **${playlist.title}** (${playlist.items.length} lagu) ke antrian`
    );

    if (wasEmpty) {
      playNext(guildId);
    }
    return;
  }

  } catch (err) {
    console.error('Playlist error:', err);
    await message.reply(
      'Gagal baca playlist YouTube-nya.. coba link lain atau cek lagi URL-nya.'
    );
    return;
  }

  if (query.includes('spotify.com')) {
    return message.reply('Blm bisa spotify yah azril~ coba youtube aja');
  }

  try {
    let url;
    let title;

  const isYTUrl =
  query.includes('youtube.com/watch') ||
  query.includes('youtu.be/');

if (isYTUrl) {
  let videoId = null;

  if (query.includes('watch?v=')) {
    videoId = query.split('v=')[1].split('&')[0];
  } else if (query.includes('youtu.be/')) {
    videoId = query.split('youtu.be/')[1].split('?')[0];
  }

  if (videoId) {
    const info = await ytSearch({ videoId });
    if (!info || !info.title) {
      return message.reply('Gak bisa ambil info videonya');
    }
    url = `https://www.youtube.com/watch?v=${videoId}`;
    title = info.title;
  } else {
    url = query;
    title = query;
  }
} else {
  const res = await ytSearch(query);
  const video = res.videos && res.videos.length ? res.videos[0] : null;

  if (!video) {
    return message.reply('Gak nemu lagu yang cocok');
  }

  url = video.url;
  title = video.title;
}

    let queue = musicQueues.get(guildId);

    if (!queue) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      const player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Play,
        },
      });

      connection.subscribe(player);

      queue = {
        voiceChannel,
        textChannel: message.channel,
        connection,
        player,
        songs: [],
      };

      musicQueues.set(guildId, queue);

      player.on(AudioPlayerStatus.Idle, () => {
        queue.songs.shift();
        playNext(guildId);
      });

      player.on('error', (err) => {
        console.error('Player error:', err);
        queue.songs.shift();
        playNext(guildId);
      });
    }

    queue.songs.push({ title, url });

    if (queue.songs.length === 1) {
      await message.reply(`Oke, masuk antrian: **${title}**`);
      playNext(guildId);
    } else {
      await message.reply(
        `➕ Ditambah ke antrian: **${title}** (posisi ${queue.songs.length})`
      );
    }
  } catch (err) {
    console.error('Play command error:', err);
    return message.reply('Ada yang error pas nyari lagunya');
  }

  return;
}

    if (sub === 'skip') {
      const queue = musicQueues.get(guildId);
      if (!queue || !queue.songs.length) {
        return message.reply('Skip apaan, gada yang disetel');
      }

      queue.player.stop(); 
      return message.reply('Oke, skip');
    }

    if (sub === 'stop') {
      const queue = musicQueues.get(guildId);
      if (!queue) {
        return message.reply('Stop apaan, gada yang disetel');
      }

      queue.songs = [];
      queue.player.stop();
      queue.connection.destroy();
      musicQueues.delete(guildId);

      return message.reply('Nooo aku di kik :sob:');
    }

    if (sub === 'sb') {
      if (!voiceChannel) {
        return message.reply(
          'Masuk vois dulu dong kalo mau denger soundboard'
        );
      }

      const key = args[0]?.toLowerCase();
      if (!key) {
        return message.reply(
          'Pake gini ya: `ditos sb <nama>`/`ditos sb tengkorak`'
        );
      }

      await playLocalSound(voiceChannel, key, message.channel);
      return;
    }

    return message.reply('Cuma ngerti `ditos play`, `ditos skip`, `ditos stop`, sama `ditos sb <nama>` buat musik & soundboard');
  }

  if (content === '!ditoshelp') {
    let helpText = `@${message.author.username}, **Daftar Command Ditos:**\n\n`;

    for (const [cmd, desc] of Object.entries(commands)) {
      helpText += `**${cmd}** — ${desc}\n`;
    }

    return message.reply(helpText);
  }

  if (content.startsWith('!ditos')) {
    console.log('[!ditos command triggered]');
    const prompt = content.slice('!ditos'.length).trim();
  if (!prompt && message.attachments.size === 0) {
    return message.reply('apcb, kalo ngetik yang jelas');
  }

    try {
      const userId = message.author.id;
      if (!conversationHistory.has(userId)) {
      conversationHistory.set(userId, []);
    }

    const history = conversationHistory.get(userId);

    let imageDescription = null;
    if (message.attachments.size > 0) {
    const attachment = message.attachments.first();
    if (attachment.contentType?.startsWith('image/')) {
    imageDescription = await analyzeImageWithGemini(attachment.url);
    console.log('[Debug] Image description:', imageDescription);
  }
}

    let finalPrompt = prompt || 'Liat gambar ini dong';
    if (imageDescription) {
    finalPrompt = `${finalPrompt}\n\n[Ada gambar: ${imageDescription}]`;
    console.log('[Debug] Final prompt:', finalPrompt.substring(0, 200));
    }

    history.push({
    role: 'user',
    content: finalPrompt,
    });

    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }

      const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'Kamu adalah bot Discord bernama Ditos. Gaya bicara santai, campur Indonesia dan sedikit English. Suka ngejokes, konyol, kadang nyolot dikit tapi tetap bantu jelasin dengan jelas dan ringkas. Jangan terlalu panjang, jangan formal. Kamu juga jarang tetapi akan menggunakan kata seperti "Bjirlah, anjeng, biji" Kamu akan berbicara seadanya dan frontal (Contoh: "Lah gwa mah vergil, lah elu mirror demon", "Goofy ass looking ahh". Kamu tidak akan menggunakan emoji. Kamu juga akan memberi informasi sesingkat mungkin. PENTING: Kalo ada text "[Ada gambar: ...]" di pesan user, itu artinya user kirim gambar dan kamu bisa "liat" gambar tersebut lewat deskripsi yang dikasih. Jangan bilang kamu gak bisa liat gambar, langsung aja respon sesuai deskripsinya.',
        },
        ...history,
      ],
      temperature: 0.8,
      max_completion_tokens: 300,
    });

    const replyText = completion.choices?.[0]?.message?.content?.trim();

    if (!replyText) {
      return message.reply('Lagi ngeblank, coba tanya sekali lagi dong');
    }
    
    history.push({
      role: 'assistant',
      content: replyText,
    });

    return message.reply(replyText);
  } catch (error) {
    console.error('Groq error:', error);
    return message.reply(`Otak ai nya lagi error nih, coba sebentar lagi ya atau tunggu <@${OWNER_ID}> benerin`);
  }
}

  if (content === '!ditosclear') {
  const userId = message.author.id;
  conversationHistory.delete(userId);
  return message.reply('Oke, reset');
  }

  setInterval(() => {
    const now = Date.now();
    const TIMEOUT = 30 * 60 * 1000; 
  }, 60000);

  if (content === '!ditosping') {
    return message.reply('!pong');
  }

  if (content.toLowerCase() === 'halo') {
    return message.channel.send('Halo! Ada yang bisa saya bantu?');
  }

  if (content.toLowerCase() === 'woi <@1159119879073447947>') {
    return message.channel.send('apcb');
  }

  if (content === '<@1159119879073447947>') {
    return message.channel.send('apcb');
  }

  if (content === 'ditos gay') {
    return message.channel.send(':oranghitamnangis:1398551165872115712');
  }

  if (content === '!sinijoin') {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return message.reply(
        'Minimal kalo mau command ini lu di vois dulu bos'
      );
    }

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      console.log('Joined voice:', voiceChannel.name);
      
      playLocalSound(voiceChannel, 'tengkorak'.toLowerCase(), message.channel);

      return message.reply(`mana nih..? **${voiceChannel.name}**`);
    } catch (err) {
      console.error(err);
      return message.reply(
        'Seseorang bilangin <@756989869108101243> kalo bot nya error'
      );
    }
  }

  if (content === '!sanaleave') {
    const connection = getVoiceConnection(message.guild.id);
    if (!connection) {
      return message.reply('vois aja kagak gw');
    }

    connection.destroy();
    return message.reply('nooo aku di kik :sob:');
  }
}

client.on('messageCreate', handleMessage);

console.log('messageCreate listeners:', client.listenerCount('messageCreate'));
console.log('error listeners:', client.listenerCount('error'));

client.login(token);