require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://startask-ten.vercel.app';

// Обработка команды /start с параметром pay
bot.start(async (ctx) => {
    const args = ctx.message.text.split(' ');
    const param = args[1];
    
    // Если есть параметр pay_ - отправляем инвойс на оплату
    if (param && param.startsWith('pay_')) {
        const parts = param.split('_');
        const userId = parseInt(parts[1]);
        const amount = parseInt(parts[2]);
        
        try {
            await ctx.telegram.sendInvoice(ctx.chat.id, {
                title: 'Пополнение баланса StarTask',
                description: `Пополнение баланса на ${amount} Telegram Stars`,
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
    
    // Обработка реферальной ссылки
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
    
    // Приветственное сообщение
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

// Обработка успешного платежа (pre_checkout_query)
bot.on('pre_checkout_query', async (ctx) => {
    try {
        await ctx.answerPreCheckoutQuery(true);
    } catch (error) {
        console.error('Error answering pre_checkout_query:', error);
        await ctx.answerPreCheckoutQuery(false, 'Ошибка при обработке платежа');
    }
});

// Обработка успешного платежа (successful_payment)
bot.on('successful_payment', async (ctx) => {
    const payment = ctx.message.successful_payment;
    const payload = JSON.parse(payment.invoice_payload);
    const { userId, amount } = payload;
    
    console.log(`💰 Payment received: user ${userId}, amount ${amount} Stars`);
    
    // Отправляем уведомление пользователю
    await ctx.reply(`✅ Оплата прошла успешно!\nБаланс пополнен на ${amount} Stars`);
    
    // Здесь нужно отправить запрос на ваш backend для обновления баланса
    // Так как бот не может напрямую писать в базу, делаем запрос к API
    try {
        const axios = require('axios');
        await axios.post(`${process.env.API_URL}/api/webhook/payment`, {
            message: { successful_payment: payment }
        });
    } catch (error) {
        console.error('Error sending payment to webhook:', error);
    }
});

// Команда /balance
bot.command('balance', async (ctx) => {
    await ctx.reply('⭐ *Ваш баланс:* 0 Stars', { parse_mode: 'Markdown' });
});

// Команда /tasks
bot.command('tasks', async (ctx) => {
    await ctx.reply('📋 Откройте Mini App, чтобы увидеть задания!', { parse_mode: 'Markdown' });
});

// Команда /referral
bot.command('referral', async (ctx) => {
    const refLink = `https://t.me/StarTaskBot?start=ref_${ctx.from.id}`;
    await ctx.reply(`👥 *Партнерская ссылка:*\n${refLink}`, { parse_mode: 'Markdown' });
});

// Команда /help
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

bot.launch();
console.log('🤖 Bot @StarTaskBot started');