require('dotenv').config();
const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://startask-ten.vercel.app';
const API_URL = process.env.API_URL || 'https://star-task.up.railway.app';

// Команда /start
bot.start(async (ctx) => {
    const text = ctx.message.text;
    const param = text.substring(6).trim();
    
    // Обработка pay_ (резервный канал, если прямой не сработает)
    if (param && param.startsWith('pay_')) {
        const parts = param.split('_');
        const userId = parts[1];
        const amount = parseInt(parts[2]);
        
        try {
            await ctx.telegram.sendInvoice(ctx.chat.id, {
                title: '⭐ Пополнение StarTask',
                description: `Пополнение баланса на ${amount} Stars`,
                payload: JSON.stringify({ userId, amount, type: 'topup' }),
                currency: 'XTR',
                prices: [{ label: `${amount} Stars`, amount: amount }],
                start_parameter: 'topup'
            });
        } catch (error) {
            console.error('Error sending invoice:', error);
            await ctx.reply('❌ Ошибка при создании счёта');
        }
        return;
    }
    
    // Реферальная ссылка
    if (param && param.startsWith('ref_')) {
        const referrerId = param.split('_')[1];
        console.log(`Referral: ${referrerId} invited ${ctx.from.id}`);
    }
    
    // Установка кнопки меню
    await ctx.telegram.setChatMenuButton({
        chat_id: ctx.chat.id,
        menu_button: {
            type: 'web_app',
            text: '🚀 Открыть StarTask',
            web_app: { url: MINI_APP_URL }
        }
    });
    
    // Приветствие
    await ctx.reply(
        `⭐ Добро пожаловать в StarTask, ${ctx.from.first_name}! ⭐\n\n👇 Нажми на кнопку ниже, чтобы начать!`,
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✨ ОТКРЫТЬ STARQUEST ✨', web_app: { url: MINI_APP_URL } }]
                ]
            }
        }
    );
});

// ✅ ОБЯЗАТЕЛЬНО: отвечаем на pre_checkout_query
bot.on('pre_checkout_query', async (ctx) => {
    try {
        await ctx.answerPreCheckoutQuery(true);
        console.log('✅ Pre-checkout approved');
    } catch (error) {
        console.error('Pre-checkout error:', error);
        await ctx.answerPreCheckoutQuery(false, 'Временная ошибка, попробуйте позже.');
    }
});

// ✅ ОБРАБОТКА УСПЕШНОГО ПЛАТЕЖА
bot.on('successful_payment', async (ctx) => {
    const payment = ctx.message.successful_payment;
    const payload = JSON.parse(payment.invoice_payload);
    const { userId, amount } = payload;

    console.log(`💰 Payment received: user ${userId}, amount ${amount}`);

    try {
        await axios.post(`${API_URL}/api/stars-payment/success`, {
            userId: Number(userId),
            amount: Number(amount),
            telegram_payment_id: payment.telegram_payment_charge_id
        });
        await ctx.reply(`✅ Баланс успешно пополнен на ${amount} Stars!`);
    } catch (error) {
        console.error('Error updating balance:', error);
        await ctx.reply('✅ Платёж получен! Баланс обновится в течение минуты.');
    }
});

// Команды
bot.command('balance', async (ctx) => {
    await ctx.reply('⭐ *Ваш баланс:* 0 Stars', { parse_mode: 'Markdown' });
});

bot.command('tasks', async (ctx) => {
    await ctx.reply('📋 Откройте Mini App, чтобы увидеть задания!', { parse_mode: 'Markdown' });
});

bot.command('referral', async (ctx) => {
    const refLink = `https://t.me/StarTaskBot?start=ref_${ctx.from.id}`;
    await ctx.reply(`👥 *Партнерская ссылка:*\n${refLink}`, { parse_mode: 'Markdown' });
});

bot.command('help', async (ctx) => {
    await ctx.reply(
        `❓ *Помощь по StarTask*\n\n` +
        `/start - Открыть главное меню\n` +
        `/tasks - Список заданий\n` +
        `/balance - Мой баланс\n` +
        `/referral - Партнерская программа\n` +
        `/help - Эта справка`,
        { parse_mode: 'Markdown' }
    );
});

const express = require('express');
const app = express();
app.use(express.json());

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 3001;

app.use(bot.webhookCallback('/webhook'));

app.listen(PORT, async () => {
    if (WEBHOOK_URL) {
        await bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`);
        console.log('✅ Webhook set:', `${WEBHOOK_URL}/webhook`);
    }
    console.log(`🤖 Bot started on port ${PORT}`);
});