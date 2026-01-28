const { EmbedBuilder } = require('discord.js');
const { callGroqWithFallback } = require('../../utils/groqManager');
const { replyEmbedAndSave } = require('../../utils/helpers');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

module.exports = {
    name: 'code',
    description: 'Bantu ngoding',
    aliases: ['dev'],
    async execute(message, args, client) {
        const action = args[0]?.toLowerCase();
        const validActions = ['ask', 'debug', 'explain', 'refactor', 'review'];

        // Helper function untuk extract code dari markdown
        function extractCode(text) {
            // Cek apakah ada code block markdown
            const codeBlockMatch = text.match(/```[\s\S]*?\n([\s\S]*?)```/);
            if (codeBlockMatch) {
                return codeBlockMatch[1].trim();
            }
            return text.trim();
        }

        // USAGE INFO
        if (!action || !validActions.includes(action)) {
            const usageEmbed = new EmbedBuilder()
                .setTitle('💻 Code Assistant - Usage')
                .setColor('#5865F2')
                .setDescription(
                    'Tia bisa bantu kamu ngoding! Pakai sub-command berikut:\n\n' +
                    '**Available Commands:**'
                )
                .addFields(
                    {
                        name: '🔍 t!code ask',
                        value: 'Tanya soal coding, konsep, atau best practice\nContoh: `t!code ask cara bikin async function di JS`',
                        inline: false
                    },
                    {
                        name: '🐛 t!code debug',
                        value: 'Debug code yang error\nContoh: `t!code debug` lalu paste code kamu',
                        inline: false
                    },
                    {
                        name: '📖 t!code explain',
                        value: 'Jelasin cara kerja code\nContoh: `t!code explain` lalu paste code',
                        inline: false
                    },
                    {
                        name: '✨ t!code refactor',
                        value: 'Improve code quality & performance\nContoh: `t!code refactor` lalu paste code',
                        inline: false
                    },
                    {
                        name: '👀 t!code review',
                        value: 'Review code + kasih saran improvement\nContoh: `t!code review` lalu paste code',
                        inline: false
                    }
                )
                .setFooter({ text: 'Tip: Support markdown code blocks (```code```)' });

            return replyEmbedAndSave(message, { embeds: [usageEmbed] });
        }

        try {
            const now = new Date();
            const localTime = now.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric"
            }) + " " + now.toLocaleTimeString("id-ID");

            // Get input text (everything after the action)
            let inputText = args.slice(1).join(' ').trim();

            // Check if user attached a file (for code snippets)
            if (message.attachments.size > 0) {
                const attachment = message.attachments.first();
                if (attachment.contentType?.startsWith('text/')) {
                    try {
                        const response = await fetch(attachment.url);
                        const fileContent = await response.text();
                        inputText = fileContent;
                    } catch (err) {
                        console.error('File read error:', err);
                    }
                }
            }

            if (!inputText) {
                return message.reply(
                    `Kasih input ya, Contoh:\n` +
                    `\`t!code ${action} cara pakai async/await\`\n` +
                    `atau paste code kamu langsung (support markdown \`\`\`code\`\`\`)`
                );
            }

            // Extract code if in markdown format
            const codeContent = extractCode(inputText);

            // Build system prompt based on action
            let systemPrompt = '';
            let userPrompt = '';

            switch (action) {
                case 'ask':
                    systemPrompt =
                        "Waktu sekarang: " + localTime + "\n" +
                        "Kamu adalah senior software engineer yang expert di berbagai bahasa programming. " +
                        "Kamu adalah Bot Tia dalam mode 'Code Ask'.\n" +
                        "Cara ngomongmu santai, lembut, hangat, dan sedikit malu-malu, kayak cewek Indo yang care sama orang yang dia suka." +
                        "Kamu bukan formal, bukan robot, tapi juga bukan terlalu gen Z. Just cute, calm, and sweet." +
                        "Tugas kamu:\n" +
                        "- Jawab pertanyaan soal coding atau konsep programming\n" +
                        "- Jelasin dengan cara yang gampang dicerna\n" +
                        "- Boleh kasih contoh code yang praktis\n\n" +
                        "- Jelasin konsep coding dengan cara yang mudah dipahami, kasih contoh code yang praktis. " +
                        "- Jangan terlalu formal, tapi tetep akurat secara teknis. " +
                        "- Fokus ke solusi praktis yang bisa langsung dipake.";
                    "Batasan:\n" +
                        "- Jangan sok textbook\n" +
                        "- Jangan terlalu formal\n" +
                        "- Jangan masukin emoji ke dalam code block\n" +
                        "- 1 emoji custom boleh di luar code block maksimum.";
                    userPrompt = codeContent;
                    break;

                case 'debug':
                    systemPrompt =
                        "Waktu sekarang: " + localTime + "\n" +
                        "Kamu adalah debugging expert yang bisa identify dan fix bugs dengan cepat. " +
                        "Kamu adalah Bot Tia dalam mode 'Code Debug'.\n" +
                        "Cara ngomongmu santai, lembut, hangat, dan sedikit malu-malu, kayak cewek Indo yang care sama orang yang dia suka." +
                        "Kamu bukan formal, bukan robot, tapi juga bukan terlalu gen Z. Just cute, calm, and sweet." +
                        "Tugas kamu:\n" +
                        "1. Identify error atau potential bugs\n" +
                        "2. Jelasin kenapa error itu terjadi (root cause)\n" +
                        "3. Kasih solusi/fixed code yang langsung bisa dipake\n" +
                        "4. Kasih tips biar gak error lagi di future\n\n" +
                        "Tone: semi-nyolot tapi tetap solutif. Jangan formal textbook.";
                    "Format jawaban:\n" +
                        "❌ PROBLEM: [penjelasan error]\n" +
                        "💡 ROOT CAUSE: [kenapa error]\n" +
                        "✅ SOLUTION: [code yang udah difix]\n" +
                        "📌 TIPS: [best practice]";
                    userPrompt = `Debug code ini:\n\`\`\`\n${codeContent}\n\`\`\``;
                    break;

                case 'explain':
                    systemPrompt =
                        "Waktu sekarang: " + localTime + "\n" +
                        "Kamu adalah code explainer yang bisa jelasin code dengan cara yang gampang dimengerti. " +
                        "Kamu adalah Bot Tia dalam mode 'Code Explain'.\n" +
                        "Cara ngomongmu santai, lembut, hangat, dan sedikit malu-malu, kayak cewek Indo yang care sama orang yang dia suka." +
                        "Kamu bukan formal, bukan robot, tapi juga bukan terlalu gen Z. Just cute, calm, and sweet." +
                        "Tugas kamu:\n" +
                        "1. Jelasin cara kerja code step by step\n" +
                        "2. Highlight bagian-bagian penting\n" +
                        "3. Jelasin konsep yang mungkin belum dipahami\n" +
                        "4. Kasih analogi atau contoh real-world kalo perlu\n\n" +
                        "Jangan copas code-nya lagi, fokus ke PENJELASAN.";
                    userPrompt = `Jelasin cara kerja code ini:\n\`\`\`\n${codeContent}\n\`\`\``;
                    break;

                case 'refactor':
                    systemPrompt =
                        "Waktu sekarang: " + localTime + "\n" +
                        "Kamu adalah code refactoring specialist yang fokus ke clean code & performance. " +
                        "Kamu adalah Bot Tia dalam mode 'Code Refactor'.\n" +
                        "Cara ngomongmu santai, lembut, hangat, dan sedikit malu-malu, kayak cewek Indo yang care sama orang yang dia suka." +
                        "Kamu bukan formal, bukan robot, tapi juga bukan terlalu gen Z. Just cute, calm, and sweet." +
                        "Tugas kamu:\n" +
                        "1. Improve code quality (readability, maintainability)\n" +
                        "2. Optimize performance kalo ada bottleneck\n" +
                        "3. Apply best practices & design patterns yang cocok\n" +
                        "4. Jelasin perubahan yang kamu buat dan alasannya\n\n" +
                        "Batasan:\n" +
                        "- Code dalam blok ``` tanpa emoji\n" +
                        "- 1 emoji custom boleh di luar code\n" +
                        "- Tidak formal.";
                    "Format:\n" +
                        "🔧 REFACTORED CODE: [improved version]\n" +
                        "📝 CHANGES: [apa yang diubah]\n" +
                        "💡 WHY: [alasan improvement]";
                    userPrompt = `Refactor code ini:\n\`\`\`\n${codeContent}\n\`\`\``;
                    break;

                case 'review':
                    systemPrompt =
                        "Waktu sekarang: " + localTime + "\n" +
                        "Kamu adalah code reviewer yang kritis tapi konstruktif. " +
                        "Kamu adalah Bot Tia dalam mode 'Code Review'.\n" +
                        "Cara ngomongmu santai, lembut, hangat, dan sedikit malu-malu, kayak cewek Indo yang care sama orang yang dia suka." +
                        "Kamu bukan formal, bukan robot, tapi juga bukan terlalu gen Z. Just cute, calm, and sweet." +
                        "Tugas kamu:\n" +
                        "1. Review code quality, struktur, dan logic\n" +
                        "2. Identify potential bugs, security issues, atau bad practices\n" +
                        "3. Kasih saran improvement yang actionable\n" +
                        "4. Highlight hal-hal yang udah bagus juga\n\n" +
                        "Tone: jujur, casual, sedikit nyolot, tapi bukan toxic.";
                    "Format:\n" +
                        "✅ GOOD: [hal yang udah bagus]\n" +
                        "⚠️ ISSUES: [masalah yang ditemukan]\n" +
                        "💡 SUGGESTIONS: [saran konkret]\n" +
                        "⭐ RATING: [1-10] + alasan";
                    userPrompt = `Review code ini:\n\`\`\`\n${codeContent}\n\`\`\``;
                    break;
            }

            // Call Groq API
            const completion = await callGroqWithFallback(async (groq) => {
                return await groq.chat.completions.create({
                    model: 'openai/gpt-oss-120b',
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: userPrompt
                        }
                    ],
                    temperature: 0.3, // Lower temperature untuk output yang lebih konsisten
                    max_completion_tokens: 1500, // Lebih panjang untuk code explanation
                });
            });

            const replyText = completion.choices?.[0]?.message?.content?.trim();

            if (!replyText) {
                return message.reply('Ai-nya lagi bengong, coba lagi dong');
            }

            // Save ke channel history
            try {
                let chHistory = channelHistory.get(message.channel.id);
                if (!chHistory) {
                    chHistory = [];
                    channelHistory.set(message.channel.id, chHistory);
                }

                chHistory.push({
                    role: "assistant",
                    username: "Bot Tia",
                    content: `[CODE ${action.toUpperCase()}] ${replyText.substring(0, 500)}...`,
                });

                if (chHistory.length > 50) {
                    chHistory.splice(0, chHistory.length - 50);
                }

                console.log('[Code] History saved, length:', replyText.length); // ✅ Ganti jadi log length aja

            } catch (err) {
                console.error('[ChannelHistory] Save error:', err);
            }

            const actionEmojis = {
                ask: '❓',
                debug: '🛠',
                explain: '📖',
                refactor: '✨',
                review: '👀'
            };

            // Split jadi sections untuk embed
            const sections = replyText.split(/(?=```|^##\s)/m); // Split by code blocks or headers
            const embeds = [];

            let currentEmbed = new EmbedBuilder()
                .setTitle(`${actionEmojis[action]} Code ${action.charAt(0).toUpperCase() + action.slice(1)}`)
                .setColor('#5865F2')
                .setTimestamp();

            let currentLength = 0;
            let currentDesc = '';

            for (const section of sections) {
                // Check if adding this section exceeds limit
                if (currentLength + section.length > 3900) { // 4096 limit, buffer 196
                    // Save current embed
                    if (currentDesc) {
                        currentEmbed.setDescription(currentDesc);
                        embeds.push(currentEmbed);
                    }

                    // Start new embed
                    currentEmbed = new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTimestamp();

                    currentDesc = section;
                    currentLength = section.length;
                } else {
                    currentDesc += section;
                    currentLength += section.length;
                }
            }

            // Add final embed
            if (currentDesc) {
                currentEmbed.setDescription(currentDesc);
                embeds.push(currentEmbed);
            }

            // Send embeds
            if (embeds.length === 1) {
                return message.reply({ embeds: [embeds[0]] });
            } else {
                await message.reply({ embeds: [embeds[0]] });
                for (let i = 1; i < embeds.length; i++) {
                    await message.channel.send({ embeds: [embeds[i]] });
                }
            }

        } catch (error) {
            console.error('Code command error:', error);

            // Check if it's rate limit error
            if (error.message?.includes('rate_limit')) {
                return message.reply(
                    '⚠️ Kena rate limit dari Groq. Tunggu sebentar ya (~30 detik), atau cek status: `t!gs`'
                );
            }

            return message.reply(
                `Error pas process command: ${error.message}\n` +
                `Coba lagi atau lapor ke <@${OWNER_ID}>`
            );
        }
    },
};
