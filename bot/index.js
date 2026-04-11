import net from 'node:net';
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';

net.setDefaultAutoSelectFamily(false);
dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://starquest-tma.vercel.app';

bot.start(async (ctx) => {
    const args = ctx.message.text.split(' ');
    const refCode = args[1];
    
    if (refCode && refCode.startsWith('ref_')) {
        const referrerId = refCode.split('_')[1];
        console.log(`Referral: ${referrerId} invited ${ctx.from.id}`);
    }
    
    await ctx.telegram.setChatMenuButton({
        chat_id: ctx.chat.id,
        menu_button: {
            type: 'web_app',
            text: '🚀 Открыть StarTask',
            web_app: { url: MINI_APP_URL }
        }
    });
    
    await ctx.reply(
        `⭐ Добро пожаловать в StarTask, ${ctx.from.first_name}! ⭐\n\n` +
        `👇 Нажми на кнопку ниже, чтобы начать зарабатывать!`,
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✨ ОТКРЫТЬ STARQUEST ✨', web_app: { url: MINI_APP_URL } }]
                ]
            }
        }
    );
});

bot.command('balance', async (ctx) => {
    await ctx.reply('⭐ *Ваш баланс:* 0 Stars', { parse_mode: 'Markdown' });
});

bot.command('tasks', async (ctx) => {
    await ctx.reply('📋 Откройте Mini App, чтобы увидеть задания!', { parse_mode: 'Markdown' });
});

bot.command('referral', async (ctx) => {
    const refLink = `https://t.me/StarTaskBot?start=ref_${ctx.from.id}`;
    await ctx.reply(`👥 *Партнерская ссылка:*\n${refLink}`);
});

bot.launch();
console.log('🤖 Bot @StarTaskBot started');