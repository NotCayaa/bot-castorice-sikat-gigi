const { musicQueues } = require('../data/state');
const { generateMusicEmbed, getMusicButtons } = require('../utils/uiHelpers');
const { AudioPlayerStatus } = require('@discordjs/voice');
const { ButtonStyle } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.isButton()) return;

        const id = interaction.customId;

        // Only handle music buttons here
        if (!id.startsWith('music_')) return;

        const guildId = interaction.guild.id;
        const data = musicQueues.get(guildId);
        if (!data) return;

        if (id === "music_pause") {
            data.player.pause();
        }

        if (id === "music_resume") {
            data.player.unpause();
            const embed = generateMusicEmbed(guildId);

            if (embed) {
                return interaction.update({
                    embeds: [embed],
                    components: getMusicButtons(guildId)
                });
            }

            return interaction.update({ components: [] });
        }

        if (id === "music_skip") {
            const current = data.songs[0];
            const next = data.songs[1];
            await interaction.reply(`⏩ Skipping **${current?.title || 'Unknown'}**... ${next ? `Now playing: **${next.title}**` : ''}`);
            data.player.stop();
            return;
        }

        if (id === "music_stop") {
            await interaction.reply("⏹ Stopped music and cleared queue.");
            data.songs = [];
            data.player.stop();
            data.connection.destroy();
            musicQueues.delete(guildId);

            try { await interaction.message.delete().catch(() => { }); } catch (e) { }
            return;
        }

        if (id === "music_leave") {
            await interaction.reply("👋 Disconnected.");
            data.connection.destroy();
            musicQueues.delete(guildId);
            try { await interaction.message.delete().catch(() => { }); } catch (e) { }
            return;
        }

        if (id === "music_vol_up") {
            data.volume = Math.min((data.volume || 1) + 0.1, 2); // max 200%
            data.player.state.resource.volume.setVolume(data.volume);
            // Fallthrough to update embed (don't reply to avoid double interaction)
        }

        if (id === "music_vol_down") {
            data.volume = Math.max((data.volume || 1) - 0.1, 0); // min 0%
            data.player.state.resource.volume.setVolume(data.volume);
            // Fallthrough to update embed
        }

        // Update embed setelah action
        const embed = generateMusicEmbed(guildId);
        if (embed) {
            return interaction.update({
                embeds: [embed],
                components: getMusicButtons(guildId)
            });
        }

        // Default cleanup if embed fails
        try {
            if (!interaction.replied && !interaction.deferred) {
                return interaction.update({ components: [] }).catch(() => { });
            }
        } catch (e) { }
    },
};
