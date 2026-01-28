const { getVoiceConnection } = require('@discordjs/voice');

module.exports = {
    name: 'leave',
    description: 'Leave vois',
    async execute(message, args, client) {
        const connection = getVoiceConnection(message.guild.id);
        if (!connection) {
            return message.reply('Aku kan lagi gak di voice.');
        }

        connection.destroy();
        return message.reply('Oke, Tia pergi dulu~');
    },
};
