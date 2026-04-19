require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://startask-ten.vercel.app';

// Обработка любого текстового сообщения, начинающегося с /start
bot.command('start', async (ctx) => {
    // Получаем текст команды
    const text = ctx.message.text;
    console.log('📥 Получено сообщение:', text);
    
    // Извлекаем параметр после /start
    let param = null;
    if (text.includes(' ')) {
        param = text.split(' ')[1];
    }
    console.log('📥 Параметр:', param);
    
    // Если есть параметр pay_
    if (param && param.startsWith('pay_')) {
        const parts = param.split('_');
        const userId = parts[1];
        const amount = parseInt(parts[2]);
        
        console.log(`💰 Обработка платежа: userId=${userId}, amount=${amount}`);
        
        try {
            await ctx.telegram.sendInvoice(ctx.chat.id, {
                title: 'Пополнение баланса StarTask',
                description: `Пополнение баланса на ${amount} Telegram Stars`,
                payload: JSON.stringify({ userId, amount, type: 'topup' }),
                currency: 'XTR',
                prices: [{ label: `${amount} Stars`, amount: amount }],
                start_parameter: 'topup'
            });
            console.log('✅ Инвойс отправлен');
        } catch (error) {
            console.error('❌ Ошибка отправки инвойса:', error);
            await ctx.reply('❌ Ошибка при создании счёта. Пожалуйста, попробуйте позже.');
        }
        return;
    }
    
    // Обработка реферальной ссылки
    if (param && param.startsWith('ref_')) {
        const referrerId = param.split('_')[1];
        console.log(`👥 Реферал: ${referrerId} пригласил ${ctx.from.id}`);
    }
    
    // Обычное приветствие
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

// Обработка предварительного запроса платежа
bot.on('pre_checkout_query', async (ctx) => {
    console.log('💳 pre_checkout_query получен');
    try {
        await ctx.answerPreCheckoutQuery(true);
        console.log('✅ pre_checkout_query подтверждён');
    } catch (error) {
        console.error('❌ Ошибка pre_checkout_query:', error);
        await ctx.answerPreCheckoutQuery(false, 'Ошибка при обработке платежа');
    }
});

// Обработка успешного платежа
bot.on('successful_payment', async (ctx) => {
    const payment = ctx.message.successful_payment;
    console.log('💰 Успешный платёж:', payment);
    
    const payload = JSON.parse(payment.invoice_payload);
    const { userId, amount } = payload;
    
    await ctx.reply(`✅ Оплата прошла успешно!\nБаланс пополнен на ${amount} Stars`);
    
    // Отправляем запрос на backend для обновления баланса
    try {
        const axios = require('axios');
        const API_URL = process.env.API_URL || 'https://star-task.up.railway.app';
        await axios.post(`${API_URL}/api/webhook/payment`, {
            message: { successful_payment: payment }
        });
        console.log('✅ Webhook отправлен на backend');
    } catch (error) {
        console.error('❌ Ошибка отправки webhook:', error);
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

bot.launch();
console.log('🤖 Bot @StarTaskBot started');