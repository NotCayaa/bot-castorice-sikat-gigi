const { saveMemory } = require('../../utils/helpers');
const state = require('../../data/state');

module.exports = {
    name: 'forget',
    description: 'Hapus memory yang disimpan Tia',
    aliases: ['forg'],
    async execute(message, args, client) {
        const memory = state.memoryData;
        const scope = args[0]?.toLowerCase();
        const isGlobal = scope === 'global' || scope === 'g';

        if (isGlobal) {
            const data = memory.global;

            if (!data) {
                return message.reply('Tia gak punya global memory apa-apa, jadi gak ada yang bisa dihapus.');
            }

            let notes = [];
            if (Array.isArray(data.notes)) {
                notes = data.notes;
            } else if (data.note) {
                notes = [
                    {
                        note: data.note,
                        updatedAt: data.updatedAt || new Date().toISOString(),
                    },
                ];
            }

            const arg = args[1]?.toLowerCase();

            if (arg === 'all') {
                delete memory.global;
                await saveMemory(memory);
                return message.reply('Semua global memory udah Tia hapus~ 🧹');
            }

            const index = parseInt(arg, 10);

            if (!index || index < 1 || index > notes.length) {
                return message.reply(
                    `Pilih global memory nomor berapa yang mau dihapus (1-${notes.length}), atau pake:\n` +
                    '`t!forg global all` buat hapus semua global memory.'
                );
            }

            const removed = notes.splice(index - 1, 1)[0];

            if (notes.length === 0) {
                delete memory.global;
            } else {
                memory.global = {
                    username: 'GLOBAL',
                    notes,
                };
            }

            await saveMemory(memory);

            return message.reply(
                `Oke, global memory nomor ${index} udah Tia hapus:\n> ${removed.note}`
            );
        }

        // MODE LAMA: per-user
        const userId = message.author.id;
        const data = memory[userId];

        if (!data) {
            return message.reply('Tia gak inget apa-apa tentang kamu, jadi gak ada yang bisa dihapus.');
        }

        let notes = [];
        if (Array.isArray(data.notes)) {
            notes = data.notes;
        } else if (data.note) {
            notes = [
                {
                    note: data.note,
                    updatedAt: data.updatedAt || new Date().toISOString(),
                },
            ];
        }

        const arg = args[0]?.toLowerCase();

        if (arg === 'all') {
            delete memory[userId];
            await saveMemory(memory);
            return message.reply('Semua memory tentang Kamu udah Tia hapus~ 🧹');
        }

        const index = parseInt(arg, 10);

        if (!index || index < 1 || index > notes.length) {
            return message.reply(
                `Pilih memory nomor berapa yang mau dihapus (1-${notes.length}), atau pake:\n` +
                '`t!forget all` buat hapus semuanya.'
            );
        }

        const removed = notes.splice(index - 1, 1)[0];

        if (notes.length === 0) {
            delete memory[userId];
        } else {
            memory[userId] = {
                username: data.username,
                notes,
            };
        }

        await saveMemory(memory);

        return message.reply(
            `Oke, memory nomor ${index} udah Tia hapus:\n> ${removed.note}`);
    },
};
