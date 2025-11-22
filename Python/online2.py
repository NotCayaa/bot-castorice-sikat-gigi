import discord
from discord.ext import commands
 
TOKEN = 'MTE1OTExOTg3OTA3MzQ0Nzk0Nw.G0TNuo.eioJk-4KAytta_UHT4nrCiS05nFgWYf8DFHcUg'
bot_prefix = '!'

bot = commands.Bot(command_prefix=bot_prefix)

@bot.event
async def on_ready():
    print(f'Logged in as {Bot Ditos}')

    await 'Bot.Ditos'.change_presence(status=discord.Status.online)

@bot.command()
async def join(ctx):
    if ctx.author.voice:
        channel = ctx.author.voice.channel
        voice_client = await channel.connect()
        await asyncio.sleep(10)
        await voice_client.disconnect()
    else:
        await ctx.send("You need to be in a voice channel to use this command.")

bot.run(TOKEN)
