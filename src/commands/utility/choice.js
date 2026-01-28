const { callGroqWithFallback } = require('../../utils/groqManager');
const { replyAndSave } = require('../../utils/helpers');

module.exports = {
    name: 'choice',
    aliases: ['pilih'],
    description: 'Minta bot milihin sesuatu dari opsi yang dikasih',
    async execute(message, args, client, prefix) {
        // Ambil full text setelah prefix, biar newline tetep kebaca
        // Note: commandHandler passes 'prefix' as 4th arg now (we added that in step 639 implicitly? No wait, we verified messageCreate passes it? Yes line 86 of messageCreate.js)
        // Wait, I need to check if I updated messageCreate to pass prefix. 
        // Checking messageCreate view from Step 639... yes: await command.execute(message, args, client, prefix);

        // Re-construct logic
        const sub = 'choice'; // simplified assumption, or check alias
        const lowerContent = message.content.toLowerCase();
        let cmdUsed = 'choice';
        if (lowerContent.startsWith(prefix + 'pilih')) cmdUsed = 'pilih';

        const full = message.content.slice(prefix.length).trim();
        const afterCommand = full.slice(cmdUsed.length).trim();

        if (!afterCommand) {
            return message.reply(
                'Kasih pilihan dong.\n' +
                'Contoh:\n' +
                '```t!pilih\n' +
                'tidur\n' +
                'ngoding 8 jam\n' +
                'scroll tiktok```'
            );
        }

        // Split per baris, buang kosong
        const options = afterCommand
            .split('\n')
            .map(o => o.trim())
            .filter(o => o.length > 0);

        if (options.length < 2) {
            return message.reply('Minimal kasih 2 pilihan lah, gimana aku bisa milih kalo cuma 1');
        }

        try {
            const listText = options
                .map((opt, i) => `${i + 1}. ${opt}`)
                .join('\n');

            const completion = await callGroqWithFallback(async (groq) => {
                return await groq.chat.completions.create({
                    model: 'openai/gpt-oss-120b',
                    messages: [
                        {
                            role: 'system',
                            content:
                                'Kamu adalah bot Discord bernama Tia. Gaya bicara lembut, sopan, sweet, dan sedikit malu-malu. ' +
                                'Kamu ramah, hangat, dan jawab dengan nada girl-next-door yang cute. Tidak frontal, tidak kasar, tidak nyolot. ' +
                                'Campur sedikit English yang soft (“umm…”, “oh, really?”, “okay~”), tapi tetap dominan bahasa Indonesia. ' +
                                'Kamu tidak pakai kata kasar ataupun bahasa Ditos. Kepribadianmu kebalikan Ditos: kamu calm, perhatian, dan suka menenangkan user. ' +
                                'Gunakan kalimat pendek atau menengah, jangan terlalu panjang. Jangan terlalu formal. ' +
                                'Kalau kamu tidak tahu sesuatu, jawab jujur "aku nggak tau…" dengan nada lembut. Tidak boleh ngarang alasan manusiawi. ' +
                                'Kamu boleh sedikit playful dan sedikit manja, tapi tetap sopan. ' +
                                'Jangan gunakan emoji berlebihan, tapi boleh 1–2 kadang-kadang (contoh: "~", "♡"). ' +
                                'Tetap konsisten pakai Aku/Kamu saja.',
                        },
                        {
                            role: 'user',
                            content:
                                'Aku lagi bingung milih salah satu dari pilihan ini:\n' +
                                listText +
                                '\n\nPilih satu yang paling cocok buat Aku sekarang, terus jelasin singkat kenapa.'
                        }
                    ],
                    temperature: 0.4,
                    max_completion_tokens: 300
                });
            });

            const replyText = completion.choices?.[0]?.message?.content?.trim();

            if (!replyText) {
                return message.reply('Ai-nya lagi bengong, coba ulangi lagi pilihan kamu barusan.');
            }

            // Tampilkan juga list pilihannya biar jelas
            return replyAndSave(message,
                `**🎲 Pilihan Tia:**\n${replyText}\n\n` +
                '```' + listText + '```'
            );
        } catch (err) {
            console.error('Groq choice error full:', err);
            return message.reply('Ai-nya lagi error pas milih pilihan, coba lagi bentar lagi ya.');
        }
    },
};
