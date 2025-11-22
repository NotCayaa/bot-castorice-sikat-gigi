import Discord
from Discord.ext import commands
import asyncio

TOKEN = 'MTE1OTEyOTEzMjUzODUzNTk0Ng.G1eHIl.dzDmu58W0rUuy5VbVOy1JQSr1s8Gu_Hvvl91Mg'
bot_prefix = '!'

bot = commands.Bot(command_prefix=bot_prefix)

@bot.command()
async def join(ctx):
    if ctx.author.voice:
        channel = ctx.author.voice.channel
        vc = await channel.connect()
        await asyncio.sleep(10)
        await vc.disconnect()

bot.run(TOKEN)
