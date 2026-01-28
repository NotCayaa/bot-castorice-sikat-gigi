const {
    joinVoiceChannel,
    createAudioPlayer,
    NoSubscriberBehavior,
    AudioPlayerStatus
} = require('@discordjs/voice');
const ytpl = require('ytpl');
const ytSearch = require('yt-search');
const { musicQueues } = require('../../data/state');
const { playNext } = require('../../utils/voiceManager');
const { spotifyApi } = require('../../utils/spotifyManager');
const { generateMusicEmbed, getMusicButtons } = require('../../utils/uiHelpers');

module.exports = {
    name: 'play',
    aliases: ['p'],
    description: 'Setel lagu dari YouTube/Spotify',
    async execute(message, args, client) {
        const { guildId } = message;
        const voiceChannel = message.member.voice.channel;

        if (!voiceChannel) {
            return message.reply('Kalo mau dengerin musik, kamu join voice dulu ya');
        }

        const query = args.join(' ');
        if (!query) {
            return message.reply('Kasih judul atau link lagunya dong, contoh: `t!play blinding lights` atau `t!play https://www.youtube.com/watch?v=xxx`');
        }

        let url;
        let title;

        // --- YOUTUBE PLAYLIST ---
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

                    player.on(AudioPlayerStatus.Playing, () => {
                        const embed = generateMusicEmbed(guildId);
                        if (embed) {
                            queue.textChannel.send({
                                embeds: [embed],
                                components: getMusicButtons(guildId)
                            });
                        }
                    });

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
            // Fallback if needed, but original returned here.
            // But we can just let it flow if validateID was false? 
            // Original logic has 'return' inside the try block if successful.
            // If error, it replies and returns.
            await message.reply(
                'Gagal baca playlist YouTube-nya.. coba link lain atau cek lagi URL-nya.'
            );
            return;
        }

        // --- SPOTIFY ---
        if (query.includes('spotify.com')) {
            try {
                await message.reply('Bentar ya, lagi convert dari Spotify...');
                const spotifyRegex = /spotify\.com\/(track|playlist|album)\/([a-zA-Z0-9]+)/;
                const match = query.match(spotifyRegex);

                if (!match) {
                    return message.reply('Link Spotify nya gak valid');
                }

                const [, type, id] = match;

                // TRACK
                if (type === 'track') {
                    const trackData = await spotifyApi.getTrack(id);
                    const track = trackData.body;
                    const searchQuery = `${track.name} ${track.artists.map(a => a.name).join(' ')}`;
                    const res = await ytSearch(searchQuery);
                    const video = res.videos && res.videos.length ? res.videos[0] : null;

                    if (!video) {
                        return message.reply(`Gak nemu "${searchQuery}" di YouTube`);
                    }

                    url = video.url;
                    title = `${track.name} - ${track.artists[0].name}`;
                    console.log(`[Spotify→YT] Track: ${searchQuery} → ${title}`);
                }
                // PLAYLIST
                else if (type === 'playlist') {
                    const playlistData = await spotifyApi.getPlaylist(id);
                    const playlist = playlistData.body;

                    await message.reply(
                        `Converting Spotify playlist: **${playlist.name}** (${playlist.tracks.total} lagu)...\n` +
                        `Ini bakal agak lama ya, sabar...`
                    );

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
                            behaviors: { noSubscriber: NoSubscriberBehavior.Play },
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

                        player.on(AudioPlayerStatus.Idle, () => { queue.songs.shift(); playNext(guildId); });
                        player.on('error', (err) => { console.error('Player error:', err); queue.songs.shift(); playNext(guildId); });

                        wasEmpty = true;
                    }

                    const tracks = playlist.tracks.items.slice(0, 50).filter(item => item.track);
                    const searchPromises = tracks.map(async (item) => {
                        const track = item.track;
                        const searchQuery = `${track.name} ${track.artists.map(a => a.name).join(' ')}`;
                        try {
                            const res = await ytSearch(searchQuery);
                            const video = res.videos && res.videos.length ? res.videos[0] : null;
                            if (video) {
                                return {
                                    title: `${track.name} - ${track.artists[0].name}`,
                                    url: video.url,
                                    requestedBy: message.author.tag,
                                };
                            }
                        } catch (err) { console.error(`[Spotify] Skip: ${searchQuery}`); }
                        return null;
                    });

                    const results = await Promise.all(searchPromises);
                    const validSongs = results.filter(song => song !== null);
                    queue.songs.push(...validSongs);

                    const successCount = validSongs.length;
                    await message.reply(
                        `✅ Berhasil convert **${successCount}/${tracks.length}** lagu dari playlist **${playlist.name}**`
                    );

                    if (wasEmpty && queue.songs.length > 0) {
                        playNext(guildId);
                    }
                    return;
                }
                // ALBUM
                else if (type === 'album') {
                    // Logic album skipped per original code instruction
                    return message.reply('Album support masih WIP, coba playlist dulu ya');
                }

            } catch (err) {
                console.error('Spotify error:', err);
                if (err.statusCode === 401) {
                    return message.reply('Spotify API token expired, coba lagi bentar lagi');
                }
                if (err.statusCode === 404) {
                    return message.reply(
                        'Spotify balas 404 (Resource not found). Biasanya ini terjadi kalo playlist-nya ' +
                        'tipe khusus / dibuat Spotify / personal (Made For You) yang gak bisa diambil lewat API. ' +
                        'Coba pake playlist lain atau link track biasa.'
                    );
                }
                return message.reply('Error pas convert dari Spotify: ' + (err.message || err));
            }
        }

        // --- YOUTUBE DIRECT / SEARCH ---
        try {
            // NEW: Only search if URL isn't already set (e.g. from Spotify)
            if (!url) {
                const isYTUrl = query.includes('youtube.com/watch') || query.includes('youtu.be/');

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
                    // Search
                    const res = await ytSearch(query);
                    const video = res.videos && res.videos.length ? res.videos[0] : null;
                    if (!video) {
                        return message.reply('Gak nemu lagu yang cocok');
                    }
                    url = video.url;
                    title = video.title;
                }
            }
        } catch (err) {
            console.error('Play command error:', err);
            return message.reply('Ada yang error pas nyari lagunya');
        }

        // --- QUEUE LOGIC ---
        let queue = musicQueues.get(guildId);
        const wasEmpty = !queue || !queue.songs || queue.songs.length === 0;

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

            player.on(AudioPlayerStatus.Playing, () => {
                const embed = generateMusicEmbed(guildId);
                if (embed) {
                    queue.textChannel.send({
                        embeds: [embed],
                        components: getMusicButtons(guildId)
                    }).catch(console.error);
                }
            });

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

        queue.songs.push({ title, url, requestedBy: message.author.tag });

        await message.reply(`Nambahin **${title}** ke antrian`);

        if (wasEmpty) {
            playNext(guildId);
        } else {
            if (queue.songs.length === 2 && !queue.songs[1].isResolved) {
                const nextSong = queue.songs[1];
                console.log(`[Music] Proactive Prefetch: ${nextSong.title}`);
                nextSong.isResolving = true;
                musicService.searchTrack(nextSong.title).then(res => {
                    if (res) {
                        nextSong.url = res.url;
                        nextSong.videoId = res.videoId;
                        nextSong.title = res.title;
                        nextSong.isResolved = true;

                        if (nextSong.spotifyId) {
                            musicCache.setLearnedMatch(nextSong.spotifyId, res.videoId);
                        }
                        musicService.getStreamUrl(res.videoId).catch(console.error);

                        console.log(`[Music] Proactive Prefetch DONE: ${nextSong.title}`);
                    }
                }).catch(console.error);
            }
        }
    },
};
