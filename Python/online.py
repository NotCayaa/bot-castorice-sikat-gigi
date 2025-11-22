import discord
from discord.ext import commands

TOKEN = 'MTE1OTEyOTEzMjUzODUzNTk0Ng.G1eHIl.dzDmu58W0rUuy5VbVOy1JQSr1s8Gu_Hvvl91Mg'
bot_prefix = '!'

bot = commands.Bot(command_prefix=bot_prefix)

@bot.event
async def on_ready():
    print(f'Logged in as {bot.user.name}')

    # Mengatur status bot menjadi "online"
    await bot.change_presence(status=discord.Status.online)

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
