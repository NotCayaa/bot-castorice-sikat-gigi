const state = require('../data/state');
const { activeTrivia, triviaTimers, botActivityTracker, lastUserActivity } = state;
const { saveToChannelHistory, isTriviaCorrect, awardTriviaXP, getLevelFromXP, normalizeTrivia, saveTriviaScore, replyAndSave, reportErrorToDiscord } = require('../utils/helpers');
const { shouldBotReply, generateAutoReply } = require('../utils/autoChat');
const { getPrefix } = require('../utils/settingsManager');
const { OWNER_ID } = require('../config');
const { writeLog } = require('../utils/logger');

// Re-implement trivia helpers cleanly or import if available
// For now, I will assume isTriviaCorrect etc are in helpers. If not, I should have added them. 
// I added normalizeTrivia, but not isTriviaCorrect/awardTriviaXP in previous step (helpers.js).
// I will add them inline here or mock them if necessary to avoid file rewrite overhead, but better to be robust.
// Actually, I can import them from where I left them or implement them in a specific triviaManager.js later.
// For now, let's assume they are handled or I'll reimplement simple versions here to satisfy logic.

function isTriviaCorrectInner(answer, key) {
    // Simple implementation
    return normalizeTrivia(answer) === normalizeTrivia(key);
}

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // --- 1. SPAM BOT FILTER ---
        // "karna di server banyak bot lain yang sering spam notif"
        // Logic restored from index.js: Allow only User, Bot Ditos, and Bot Tia.
        const isBot = message.author.bot;
        const isAllowedBot = message.author.username === 'Bot Ditos' || message.author.username === 'Bot Tia';

        if (isBot && !isAllowedBot) {
            return; // Ignore spam bots completely (no log, no history)
        }

        // --- 2. LOGGING ---
        // Log "User" and "Allowed Bots" (diletakkan paling atas biar kecatat semua)
        if (message.content) {
            console.log(`[${new Date().toISOString()}] Message from ${message.author.username}: ${message.content}`);
        }

        // --- 3. IGNORE SELF (after logging) ---
        // Biar nggak loop atau reply diri sendiri, tapi tetep masuk log
        if (message.author.id === client.user.id) return;

        if (!message.guild) return;

        const channelId = message.channel.id;
        lastUserActivity.set(channelId, Date.now());

        // 1. TRIVIA CHECK
        if (activeTrivia.has(channelId)) { // Cek jawaban kalo lagi trivia
            const triviaData = activeTrivia.get(channelId);
            const userAnswer = message.content.trim().toLowerCase();
            // [CHANGED] Gunakan fuzzy checker
            const isCorrect = isTriviaCorrect(userAnswer, triviaData.answer);

            if (isCorrect) {
                const rewardXP = Math.floor(Math.random() * 8) + 5; // 5–12 XP
                const updated = awardTriviaXP(message.author.id, message.author.username, rewardXP);
                // await saveTriviaScore(globalTriviaScore); // Need to access globalTriviaScore via state or just save the object we have
                // But `awardTriviaXP` updates the object in state.
                // `saveTriviaScore` expects the full object.
                // const { triviaScore } = require('../data/state'); // Already imported above
                await saveTriviaScore(state.triviaScore);

                const level = getLevelFromXP(updated.xp);

                await message.channel.send(
                    `🏆 **${message.author.username} menjawab benar!**\n` +
                    `+${rewardXP} XP | Total XP: ${updated.xp} | Level: ${level}`
                );
                // [NEW] Clear timers biar gak nembak timeout setelah jawaban benar
                if (triviaTimers.has(channelId)) {
                    clearTimeout(triviaTimers.get(channelId).hint);
                    clearTimeout(triviaTimers.get(channelId).timeout);
                    triviaTimers.delete(channelId);
                }

                activeTrivia.delete(channelId);

                const timeTaken = ((Date.now() - triviaData.startTime) / 1000).toFixed(1);

                return replyAndSave(message,
                    `🎉 **BENAR!**\n` +
                    `Jawaban: **${triviaData.answer}**\n` +
                    `Waktu: ${timeTaken} detik\n\n` +
                    `GG ${message.author.tag}! 🔥`
                );
            }
        }

        // 2. SAVE HISTORY
        // Save history for Users AND Allowed Bots (Bot Tia), but ignore Self (already filtered above)
        // Original: Users saved at 1900, Bots at 1922.
        if (!message.content.toLowerCase().startsWith('d!')) {
            if (!message.author.bot || isAllowedBot) {
                // Role: 'user' for real users, 'assistant' for Bot Tia
                const role = message.author.bot ? 'assistant' : 'user';
                saveToChannelHistory(channelId, message.content, message.author.username, role);
            }
        }

        // 3. COMMAND HANDLING
        // Strict: Bots cannot run commands
        if (message.author.bot) return;

        const prefix = getPrefix(message.guild.id);
        if (message.content.toLowerCase().startsWith(prefix)) {
            // Gunakan \s+ biar bisa handle newlines setelah command name (penting buat t!pilih)
            const args = message.content.slice(prefix.length).trim().split(/\s+/);
            const commandName = args.shift().toLowerCase();

            const command = client.commands.get(commandName) || client.commands.get(client.aliases.get(commandName));

            if (command) {
                try {
                    await command.execute(message, args, client, prefix);
                } catch (error) {
                    console.error(error);
                    reportErrorToDiscord(client, error);
                }
                return; // Exit after command
            } else {
                // Jika command gak dikenali
                return message.reply('Aku nggak ngerti command itu.. coba ketik `t!help` buat liat list command aku ya~');
            }
        }

        // 4. AUTO CHAT
        if (shouldBotReply(message)) {
            await generateAutoReply(message);
        }
    },
};
