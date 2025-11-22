import discord
from discord.ext import commands

TOKEN = 'MTE1OTExOTg3OTA3MzQ0Nzk0Nw.G0TNuo.eioJk-4KAytta_UHT4nrCiS05nFgWYf8DFHcUg'
bot_prefix = '!'

bot = commands.Bot(command_prefix=bot_prefix)

@bot.event
async def on_ready():
    print(f'Logged in as {bot.user.name}')

@bot.command()
async def my_command(ctx):
    await ctx.send("This is a sample command!")

bot.run(TOKEN)
