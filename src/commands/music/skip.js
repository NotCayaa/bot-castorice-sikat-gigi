const { musicQueues } = require('../../data/state');
const { playNext } = require('../../utils/voiceManager');

module.exports = {
    name: 'skip',
    aliases: ['s'],
    description: 'Skip lagu yang lagi diputer',
    async execute(message, args, client) {
        const { guildId } = message;
        const queue = musicQueues.get(guildId);

        if (!queue || !queue.songs.length) {
            return message.reply('Aku lagi gak nyetel apa-apa, jadi gak bisa skip ya');
        }

        queue.player.stop();
        const embed = generateMusicEmbed(guildId);
        if (embed) {
            return message.channel.send({ embeds: [embed], components: [getMusicButtons(guildId)] });
        }
        return message.reply('Oke, skip');
    },
};
