const { musicQueues } = require('../../data/state');

module.exports = {
        name: 'stop',
        aliases: ['leave', 'dc', 'disconnect'],
        description: 'Stop musik & disconnect bot',
        async execute(message, args, client) {
                const { guildId } = message;
                const queue = musicQueues.get(guildId);

                if (!queue) {
                        return message.reply('Aku lagi gak nyetel apa-apa, jadi gak bisa stop musik ya');
                }

                queue.songs = [];
                queue.nowPlaying = null;
                queue.stopOnIdle = true;
                queue.player.stop();
                queue.connection.destroy();
                musicQueues.delete(guildId);

                const embed = generateMusicEmbed(guildId);
                if (embed) { }
                return message.reply('⏹ Musik distop, antrian dihapus. (Bot stay di voice)');
        },
};
