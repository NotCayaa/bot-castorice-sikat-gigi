const { musicQueues } = require('../../data/state');

module.exports = {
    name: 'stop',
    aliases: ['leave', 'dc', 'disconnect'], // 'leave' dan 'dc' logicnya sama di index.js (line 3231)
    description: 'Stop musik & disconnect bot',
    async execute(message, args, client) {
        const { guildId } = message;
        const queue = musicQueues.get(guildId);

        if (!queue) {
            return message.reply('Stop apaan, gada yang disetel');
        }

        // Clear songs
        queue.songs = [];
        queue.nowPlaying = null; // [FIX] Clear now playing
        queue.stopOnIdle = true; // [NEW FLAG]
        queue.player.stop();

        const embed = generateMusicEmbed(guildId);
        if (embed) {
            // Embed bakal update jadi "Tidak ada lagu", tapi gpp
            // Atau kita apus embed last playing?
        }

        return message.reply('⏹ Musik distop, antrian dihapus. (Bot stay di voice)');
    },
};
