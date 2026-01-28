const { playLocalSound } = require('../../utils/voiceManager');

module.exports = {
    name: 'sb',
    description: 'Putar soundboard (list: acumalaka, ahlele, tengkorak, ahaha)',
    async execute(message, args, client) {
        const { member, channel } = message;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return message.reply(
                'Voice dulu ya kalo mau denger soundboard'
            );
        }

        const key = args[0]?.toLowerCase();
        if (!key) {
            return message.reply(
                'Pake gini ya: `t!sb <nama>`/`t!sb tengkorak`'
            );
        }

        await playLocalSound(voiceChannel, key, channel);
    },
};
