const { joinVoiceChannel } = require('@discordjs/voice');
const { playLocalSound } = require('../../utils/voiceManager');
const { generateMusicEmbed, getMusicButtons } = require('../../utils/uiHelpers');
const { musicQueues } = require('../../data/state');
const { OWNER_ID } = require('../../config');

module.exports = {
    name: 'join',
    aliases: ['j'],
    description: 'Panggil Tia ke voice channel',
    async execute(message, args, client) {
        const voiceChannel = message.member?.voice.channel;
        const guildId = message.guild.id;

        if (!voiceChannel) {
            return message.reply('Join voice dulu ya buat manggil Tia~');
        }

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: false,
            });

            console.log('Joined voice:', voiceChannel.name);

            const embed = generateMusicEmbed(guildId);
            if (embed) {
                // Check if queue exists, if so send embed
                const queue = musicQueues.get(guildId);
                if (queue) {
                    return message.channel.send({ embeds: [embed], components: [getMusicButtons(guildId)] });
                }
            }

            return message.reply(`Hai~ **${voiceChannel.name}**`);
        } catch (err) {
            console.error(err);
            return message.reply(
                `Seseorang bilangin <@${OWNER_ID}> kalo Tia error`
            );
        }
    },
};
