>>> import discord
... from discord.ext import commands
... import asyncio
... 
... TOKEN = 'MTE1OTExOTg3OTA3MzQ0Nzk0Nw.GzCjUq.ezYBcIafigWH3YzE0xW7KfOXVc_NEnt-crZSFk'
... bot_prefix = '!'
... 
... bot = commands.Bot(command_prefix=bot_prefix)
... 
... @bot.command()
... async def join(ctx):
...     if ctx.author.voice:
...         channel = ctx.author.voice.channel
...         vc = await channel.connect()
...         await asyncio.sleep(10)
...         await vc.disconnect()
... 
... bot.run(TOKEN)
