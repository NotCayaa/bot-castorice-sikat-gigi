const { searchWeb, replyAndSave } = require('../../utils/helpers');
const { callGroqWithFallback } = require('../../utils/groqManager');

module.exports = {
    name: 'google',
    description: 'Google search, nanti bot kasih 3 hasil teratas dengan bantuan AI',
    aliases: ['g'],
    async execute(message, args, client) {
        const query = args.join(' ').trim();

        if (!query) {
            return message.reply(
                'Mau nanya apa ke Google? Contoh:\n' +
                '`t!g berita teknologi hari ini`'
            );
        }

        try {
            await message.channel.send('Bentar, Tia cek Google dulu...');

            const results = await searchWeb(query);

            if (!results.length) {
                return message.reply('Gak nemu apa-apa dari Google, coba kata kunci lain.');
            }

            const webContext = results
                .map((r, i) => `${i + 1}. ${r.title}\n${r.snippet}\n${r.link}`)
                .join('\n\n');

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
                                'Tetap konsisten pakai Aku/Kamu saja.' +
                                'Tugas kamu sekarang: jawab pertanyaan user berdasarkan hasil pencarian web yang diberikan. ' +
                                'Kalau infonya kurang, bilang aja gak yakin, jangan ngarang.'
                        },
                        {
                            role: 'user',
                            content:
                                `Pertanyaan user: ${query}\n\n` +
                                `Berikut hasil pencarian web (Google):\n` +
                                webContext
                        }
                    ],
                    temperature: 0.4,
                    max_completion_tokens: 300,
                });
            });

            const answer = completion.choices?.[0]?.message?.content?.trim();

            if (!answer) {
                return message.reply('Ai-nya lagi bengong habis baca Google, coba tanya lagi bentar.');
            }

            const sumberList = results
                .map((r, i) => `${i + 1}. ${r.title}\n   Sumber: <${r.link}>`)
                .join('\n');

            return replyAndSave(message,
                `**🔍 Jawaban (pakai Google + ai):**\n` +
                `${answer}\n\n` +
                `**Sumber singkat:**\n` +
                sumberList
            );

        } catch (err) {
            console.error('Google search error:', err);
            return message.reply('Lagi gak bisa nyambung ke Google, coba lagi nanti.');
        }
    },
};
