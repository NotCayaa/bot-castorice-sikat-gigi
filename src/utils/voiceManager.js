const {
    createAudioResource,
    StreamType,
    getVoiceConnection,
    joinVoiceChannel,
    createAudioPlayer,
    NoSubscriberBehavior,
    AudioPlayerStatus
} = require('@discordjs/voice');
const ytSearch = require('yt-search'); // [NEW] Needed for JIT
const ytdlExec = require('yt-dlp-exec');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { musicQueues, songCache, saveSongToCache } = require('../data/state');
const { SOUNDBOARD_CLIPS } = require('../data/constants');
const { GTTS_PATH, TEMP_DIR } = require('../config');
const { generateMusicEmbed, getMusicButtons } = require('./uiHelpers');

async function resolveSong(song) {
    if (!song || song.url) return song; // Already resolved or null

    // [CACHE CHECK]
    if (songCache.has(song.title)) {
        console.log(`[Music] Cache hit: ${song.title}`);
        song.url = songCache.get(song.title);
        song.isResolved = true;
        return song;
    }

    try {
        console.log(`[Music] Resolving: ${song.title}`);
        const res = await ytSearch(song.title);
        const video = res.videos && res.videos.length ? res.videos[0] : null;

        if (video) {
            song.url = video.url;
            song.isResolved = true;
            // [CACHE SAVE]
            saveSongToCache(song.title, video.url);
            console.log(`[Music] Cached to Disk: ${song.title}`);
            return song;
        } else {
            console.warn(`[Music] Failed to resolve: ${song.title}`);
            return null;
        }
    } catch (err) {
        console.error(`[Music] Resolve error for ${song.title}:`, err);
        return null;
    }
}

async function playNext(guildId) { // Auto play musik selanjutnya
    const queue = musicQueues.get(guildId);

    if (!queue || !queue.songs || queue.songs.length === 0) {
        // [FIX] Kalau distop manual, jangan destroy/leave.
        if (queue && queue.stopOnIdle) {
            console.log(`[Music] Stopped manually in ${guildId}. Staying in VC.`);
            queue.stopOnIdle = false; // reset flag
            // Queue tetep ada biar button work / bisa play lagi
            return;
        }

        console.log(`[Music] Queue kosong di guild ${guildId}, stop.`);

        if (queue && queue.connection) {
            queue.connection.destroy(); // Auto-leave kalau abis lagunya
        }
        musicQueues.delete(guildId);
        return;
    }

    let song = queue.songs[0];

    // [JIT RESOLVE]
    // Kalau song belum ada URL (dari Spotify Lazy Load), resolve sekarang.
    if (!song.url) {
        if (song.isResolving) {
            console.log(`[Music] PlayNext: Song is currently pre-fetching... waiting? No, joining race.`);
            // Ideally we should wait for the promise, but currently we just re-run resolveSong 
            // which will check cache OR re-run search.
            // If we add 'isResolving' check in resolveSong handles it? 
            // resolveSong doesn't check isResolving property yet.
        }
        console.log(`[Music] PlayNext: URL Missing for ${song.title}. Triggering JIT Resolve.`);
        const resolved = await resolveSong(song);
        if (!resolved) {
            // Failed to find on YouTube, skip
            queue.textChannel.send(`⚠️ Gagal memutar **${song.title}**, gak nemu di YouTube. Skip.`);
            queue.songs.shift();
            return playNext(guildId);
        }
        song = resolved;
    } else {
        console.log(`[Music] PlayNext: URL Ready! (Instant Start) -> ${song.title}`);
    }

    queue.nowPlaying = song;

    try {
        console.log(`[Music] Spawning yt-dlp...`);

        // Optimize flags for speed
        const subprocess = ytdlExec.exec(song.url, {
            output: '-',
            // [FORMAT OPTIMIZATION] Prefer Opus (Native for Discord) -> M4A -> Any
            format: 'bestaudio[acodec=opus]/bestaudio[ext=m4a]/bestaudio',
            // [FLAGS OPTIMIZATION]
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: ['referer:youtube.com', 'user-agent:googlebot'],
            forceIpv4: true, // [NET] Force IPv4 (faster connection usually)

            // [BUFFER OPTIMIZATION]
            // Reduce buffer to ensure stream starts ASAP
            // (yt-dlp default is mostly fine, but let's try strict mode)
            bufferSize: 1024 * 1024, // 1MB buffer
            socketTimeout: 5, // 5 seconds timeout for socket operations
        });

        subprocess.stderr.on('data', (data) => {
            // console.log('[yt-dlp]', data.toString()); 
        });

        // [RACE CONDITION FIX]
        if (!musicQueues.has(guildId)) {
            subprocess.kill();
            return;
        }

        const resource = createAudioResource(subprocess.stdout, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true,
        });

        queue.player.play(resource);
        resource.volume.setVolume(queue.volume || 1);

        const embed = generateMusicEmbed(guildId);
        if (embed && queue.textChannel) {
            queue.textChannel.send({
                embeds: [embed],
                components: getMusicButtons(guildId)
            }).catch(err => console.error("Gagal kirim embed music:", err));
        }

        // [PRE-FETCH]
        // While current song plays, resolve the NEXT song in background
        if (queue.songs.length > 1) {
            const nextSong = queue.songs[1];
            if (!nextSong.url && !nextSong.isResolving) { // [Prevent Double Fetch]
                console.log(`[Music] Prefetch START: ${nextSong.title}`);
                nextSong.isResolving = true; // Mark as in-progress
                const pfStart = Date.now();

                resolveSong(nextSong)
                    .then(res => {
                        if (res) {
                            console.log(`[Music] Prefetch DONE: ${nextSong.title} (${Date.now() - pfStart}ms)`);
                        } else {
                            console.log(`[Music] Prefetch FAILD: ${nextSong.title}`);
                            nextSong.isResolving = false; // Reset on fail
                        }
                    })
                    .catch(err => {
                        console.error("Prefetch error:", err);
                        nextSong.isResolving = false;
                    });
            }
        }

    } catch (err) {
        console.error('yt-dlp error:', err);
        queue.songs.shift(); // remove failed song
        playNext(guildId);
    }
}

async function playLocalSound(voiceChannel, key, textChannel) { // Soundboard (Masih pake local)
    const clip = SOUNDBOARD_CLIPS[key];
    if (!clip) {
        if (textChannel) {
            await textChannel.send(`Soundboard \`${key}\` belum ada.`);
        }
        return;
    }

    if (!fs.existsSync(clip.file)) {
        // Try resolving relative to root? 
        // index.js assumes ./sounds/... relative to CWD.
        // If running from same CWD, it should fine.
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
            // debug: true
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

async function ttsGoogle(text, outputFileName) { // TTS pake gTTS CLI
    return new Promise((resolve, reject) => {
        const safe = text.replace(/"/g, '\\"');
        const outPath = path.join(TEMP_DIR, outputFileName);

        const cmd = `"${GTTS_PATH}" "${safe}" --lang id --output "${outPath}"`;

        exec(cmd, (err) => {
            if (err) return reject(err);
            resolve(outPath);
        });
    });
}

module.exports = { playNext, playLocalSound, ttsGoogle };
