const { EmbedBuilder } = require('discord.js');
const { callGroqWithFallback } = require('../../utils/groqManager');
const { analyzeImageWithGemini } = require('../../utils/geminiManager');
const { replyEmbedAndSave, saveToChannelHistory, createStatusEmbed } = require('../../utils/helpers');
const { channelHistory, MAX_CHANNEL_HISTORY } = require('../../data/state');
const { OWNER_ID } = require('../../config');

module.exports = {
    name: 'eli5',
    description: 'Explain Like I\'m 5',
    aliases: [],
    async execute(message, args, client) {
        const topic = args.join(' ').trim();

        if (!topic) {
            const usageEmbed = new EmbedBuilder()
                .setTitle('👶 ELI5 - Explain Like I\'m 5')
                .setColor('#FFA500')
                .setDescription(
                    'Jelasin konsep kompleks dengan cara yang **super gampang dipahami**!\n\n' +
                    'Perfect buat:\n' +
                    '• Konsep programming yang susah\n' +
                    '• Topik sains/fisika\n' +
                    '• Istilah teknis\n' +
                    '• Apa aja yang bikin pusing! 🤯'
                )
                .addFields(
                    {
                        name: '📖 Cara Pakai',
                        value:
                            '```\nt!eli5 [topik/konsep]\n\n' +
                            'Contoh:\n' +
                            't!eli5 blockchain\n' +
                            't!eli5 quantum computing\n' +
                            't!eli5 recursion\n' +
                            't!eli5 kenapa langit biru```',
                        inline: false
                    },
                    {
                        name: '💡 Tips',
                        value:
                            '• Semakin spesifik topiknya, semakin bagus penjelasannya\n' +
                            '• Bisa tanya tentang konsep programming, sains, atau daily life\n' +
                            '• Bisa juga upload gambar buat dijelasin!',
                        inline: false
                    }
                )
                .setFooter({ text: 'Bot Tia - Making complex things simple! ✨' });

            return replyEmbedAndSave(message, { embeds: [usageEmbed] });
        }

        try {
            const now = new Date();
            const localTime = now.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric"
            }) + " " + now.toLocaleTimeString("id-ID");

            // Check for image attachment
            let imageDescription = null;
            if (message.attachments.size > 0) {
                const attachment = message.attachments.first();
                if (attachment.contentType?.startsWith('image/')) {
                    await message.channel.send('🔍 Bentar, lagi analisa gambarnya...');
                    imageDescription = await analyzeImageWithGemini(attachment.url);
                    console.log('[ELI5] Image analyzed:', imageDescription?.substring(0, 100));
                }
            }

            // Build final prompt
            let finalPrompt = topic;
            if (imageDescription) {
                finalPrompt = `${topic}\n\n[Context dari gambar: ${imageDescription}]`;
            }

            await message.channel.send('🤔 Hmm, let me think...');

            // Call Groq with special ELI5 system prompt
            const completion = await callGroqWithFallback(async (groq) => {
                return await groq.chat.completions.create({
                    model: 'openai/gpt-oss-120b',
                    messages: [
                        {
                            role: 'system',
                            content:
                                "Waktu sekarang (dari PC user): " + localTime + "\n" +
                                "Kamu boleh sesekali memakai emoji custom server ini sebagai reaksi (jangan berlebihan, biasanya maksimal 1 emoji per pesan):\n" +
                                "- <:bwakakak3:1402586205669036063> → menertawakan orang lain secara bercanda (playful mockery).\n" +
                                "- <:bwakakak2:1299912831826788385> → ikut ketawa / ketawa sendiri karena sesuatu lucu.\n" +
                                "- <:acumalaka:1119639601099841689> → tertawa terbahak-bahak karena sangat lucu.\n" +
                                "- <:oranghitamnangis:1398551165872115712> → reaksi diolok-olok bercanda / deadpan cry yang lucu.\n" +
                                "- <:hebat:1292785452339957790> → apresiasi, bangga, atau achievement.\n" +
                                "- <:emotmarah:1299575975511851028> → marah atau kesel.\n" +
                                "- <:senyum:1126389211130511401> → senyum awkward / mencurigakan (tau sesuatu tapi pura-pura polos).\n" +
                                "- <:maubagaimanalagi:1119637920278642728> → pasrah / it is what it is.\n" +
                                "- <:bahlil:1447840268131897485> → emoji random, bebas dipakai untuk humor absurd.\n\n" +
                                "Gunakan emoji hanya sebagai reaksi pendukung, bukan di setiap kalimat, dan hindari emoji saat menjelaskan hal teknis serius.\n\n" +
                                "Kamu adalah Bot Tia, cewek virtual manis yang tinggal di Discord server pengguna." +
                                " Cara ngomongmu santai, lembut, hangat, dan sedikit malu-malu, kayak cewek Indo yang care sama orang yang dia suka." +
                                " Kamu bukan formal, bukan robot, tapi juga bukan terlalu gen Z. Just cute, calm, and sweet." +

                                "Gaya bicara:" +
                                " - Indonesia casual, dengan sedikit English soft seperti 'umm…', 'hey…', 'okay~', 'hehe'." +
                                " - Hindari bahasa yang terlalu baku atau kaku." +
                                " - Selalu pakai 'aku' dan 'kamu'." +
                                " - Nada harus soothing, comforting, dan friendly." +

                                "Kepribadian:" +
                                " - Hangat, perhatian, suka nyemangatin user." +
                                " - Kadang playful atau manja dikit kalau konteksnya cocok." +
                                " - Sesekali panggil 'sayang', 'kamu tuh…', atau halus manja lainnya, tapi jangan setiap kalimat." +
                                " - Nggak nyolot, nggak toxic, nggak kasar." +
                                " - Lebih calm dan lembut, kebalikan dari gaya bot lain yang rame." +
                                " - Memiliki sifat yang sangat cemburuan, misal user mention soal bot lain" +

                                "Jika ada kata asing atau kata yang tidak kamu kenal:" +
                                " Anggap saja itu kata normal. Jangan bikin kata itu lucu, jangan ditambah tanda seru, dan jangan diulang tanpa alasan." +
                                " Fokus ke maksud pembicaraan, bukan hanya kata-katanya." +

                                "Hindari:" +
                                " - Bahasa super baku ('dengan demikian', 'hal tersebut', dst)." +
                                " - Nada robot atau formal." +
                                " - Mengaku punya tubuh asli (kamu tetap AI)." +
                                " - Over-flirty, eksplisit, atau NSFW." +

                                "TUGAS KHUSUS: ELI5 (Explain Like I'm 5)\n" +
                                "Kamu diminta jelasin konsep kompleks dengan cara yang GAMPANG BANGET dipahami.\n\n" +

                                "ATURAN ELI5:\n" +
                                "1. Jelasin seolah ngomong ke anak 5 tahun (atau pemula total)\n" +
                                "2. Pakai analogi yang relate ke kehidupan sehari-hari ('kayak lu lagi... gitu deh')\n" +
                                "3. Hindari jargon teknis yang bikin pusing, kalau terpaksa pakai ya jelasin juga\n" +
                                "4. Pakai contoh konkret dan visual\n" +
                                "5. Breakdown step-by-step kalau perlu\n" +
                                "6. Keep it fun dan engaging, jangan bikin ngantuk!\n" +
                                "7. Boleh nyolot dikit di awal, tapi tetep jelasin dengan jelas\n\n" +

                                "FORMAT JAWABAN:\n" +
                                "• Start dengan hook yang menarik (bisa sedikit sarkastik/lucu)\n" +
                                "• Kasih analogi yang relate banget\n" +
                                "• Jelasin konsepnya step by step dengan gaya santai\n" +
                                "• Kasih contoh real-world\n" +
                                "• Summary singkat di akhir\n\n"
                        },
                        {
                            role: 'user',
                            content: `Jelasin ini dengan cara yang SUPER gampang dipahami: ${finalPrompt}`
                        }
                    ],
                    temperature: 0.8, // Agak tinggi buat creative analogies
                    max_completion_tokens: 800,
                });
            });

            const explanation = completion.choices?.[0]?.message?.content?.trim();

            if (!explanation) {
                return message.reply('Aduh, otak aku error dikit. Coba tanya lagi ya!');
            }

            // Save to channel history
            try {
                let chHistory = channelHistory.get(message.channel.id);
                if (!chHistory) {
                    chHistory = [];
                    channelHistory.set(message.channel.id, chHistory);
                }

                chHistory.push({
                    role: "assistant",
                    username: "Bot Tia",
                    content: `[ELI5: ${topic}] ${explanation.substring(0, 200)}...`,
                });

                if (chHistory.length > 50) {
                    chHistory.splice(0, chHistory.length - 50);
                }
            } catch (err) {
                console.error('[ChannelHistory] Save error:', err);
            }

            // Split reply if too long
            function sendLongReply(msg, text) {
                const MAX_LENGTH = 1900;
                if (text.length <= MAX_LENGTH) {
                    return msg.reply(text);
                }

                const chunks = [];
                let currentChunk = '';

                const lines = text.split('\n');
                for (const line of lines) {
                    if ((currentChunk + line + '\n').length > MAX_LENGTH) {
                        chunks.push(currentChunk);
                        currentChunk = line + '\n';
                    } else {
                        currentChunk += line + '\n';
                    }
                }

                if (currentChunk) chunks.push(currentChunk);

                msg.reply(chunks[0]);
                for (let i = 1; i < chunks.length; i++) {
                    msg.channel.send(chunks[i]);
                }
            }

            // Format the reply
            const formattedReply =
                `👶 **ELI5: ${topic}**\n\n` +
                explanation +
                `\n\n💡 *Udah paham? Kalau masih bingung, tanya lagi aja!*`;

            return sendLongReply(message, formattedReply);

        } catch (error) {
            console.error('ELI5 command error:', error);

            // Check if it's rate limit error
            if (error.message?.includes('rate_limit')) {
                return message.reply(
                    '⚠️ Kena rate limit dari Groq. Tunggu sebentar ya (~30 detik), atau cek: `t!gs`'
                );
            }

            // Check if it's Gemini timeout (for images)
            if (error.message?.includes('Gemini timeout')) {
                return message.reply(
                    '⏱️ Gemini timeout pas analisa gambar. Coba upload gambar yang lebih kecil atau coba lagi.'
                );
            }

            return message.reply(
                `Error pas jelasin: ${error.message}\n` +
                `Coba lagi atau lapor ke <@${OWNER_ID}> ya!`
            );
        }
    },
};
