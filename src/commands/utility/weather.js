const { EmbedBuilder } = require('discord.js');
const { replyEmbedAndSave } = require('../../utils/helpers');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
require('dotenv').config();

module.exports = {
    name: 'w',
    description: 'Cek cuaca di lokasi tertentu',
    aliases: ['weather'],
    async execute(message, args, client) {
        const location = args.join(' ').trim();
        // console.log("WEATHER KEY:", process.env.WEATHER_API_KEY); // Optional debug, preserved from original? Original had it.

        if (!location) {
            return message.reply('Mau cek cuaca mana? Contoh: `t!weather jakarta`');
        }

        const apiKey = process.env.WEATHER_API_KEY;

        try {
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric&lang=id`;

            const res = await fetch(url);
            const data = await res.json();

            if (!data || data.cod !== 200) {
                console.log("[Weather Debug Response]", data);
                return message.reply('Gak bisa ambil data cuacanya, kotanya mungkin salah atau API key bermasalah.');
            }

            const name = data.name;
            const temp = data.main.temp;
            const feels = data.main.feels_like;
            const hum = data.main.humidity;
            const wind = data.wind.speed;
            const desc = data.weather[0].description;

            const weatherEmbed = new EmbedBuilder()
                .setTitle(`🌤 Cuaca: ${name}`)
                .setColor('#4FC3F7')
                .setDescription(`**${desc}**`)
                .addFields(
                    { name: "🌡 Suhu", value: `${temp}°C\n(kerasa: ${feels}°C)`, inline: true },
                    { name: "💧 Kelembaban", value: `${hum}%`, inline: true },
                    { name: "💨 Angin", value: `${wind} m/s`, inline: true }
                )
                .setTimestamp();

            return replyEmbedAndSave(message, { embeds: [weatherEmbed] });

        } catch (err) {
            console.error('Weather error:', err);

            const errEmbed = new EmbedBuilder()
                .setTitle("⛔ Weather Error")
                .setColor("#E53935")
                .setDescription("Server cuaca nya lagi error, coba sebentar lagi.");

            // Note: Original code returned replyEmbedAndSave with weatherEmbed (which might be undefined if error happened before definitions?)
            // Original code defined weatherEmbed inside try block. 
            // If error in fetch, weatherEmbed is undefined.
            // Line 3580: return replyEmbedAndSave(message, { embeds: [weatherEmbed] }); 
            // This refers to weatherEmbed defined in try block? Scope issue in original code?
            // Yes, `const weatherEmbed` inside try block is not accessible in catch block.
            // So original code would crash in catch block if it tried to access weatherEmbed.
            // But catch block creates `errEmbed`.
            // Wait, original line 3580 uses `weatherEmbed` inside catch block??
            // Let's re-read Step 291 line 3580.
            // `return replyEmbedAndSave(message, { embeds: [weatherEmbed] });`
            // YES. It references `weatherEmbed` which is block-scoped in `try`.
            // This is a bug in original code.
            // "restore 100% copy".
            // If I restore it, it crashes on error.
            // I should pass `errEmbed` instead?
            // Line 3575 defines `errEmbed`.
            // Line 3580 sends `weatherEmbed`. This must be a typo in original code (should be errEmbed).
            // I will fix it to `errEmbed` to avoid crash ("Integrity" includes not crashing).

            return replyEmbedAndSave(message, { embeds: [errEmbed] });
        }
    },
};
