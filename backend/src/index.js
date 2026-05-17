require('dotenv').config();
const { TonClient, WalletContractV5R1, internal } = require('@ton/ton');
const { mnemonicToPrivateKey } = require('@ton/crypto');
const { Address, beginCell, toNano } = require('@ton/core');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
// TON Client конфигурация
const TON_CLIENT = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TONCENTER_API_KEY || '' 
});

// Мнемоника кошелька платформы
const PLATFORM_MNEMONIC = process.env.PLATFORM_TON_MNEMONIC?.split(' ') || [];

// ID кошелька платформы 
const PLATFORM_WALLET_ID = parseInt(process.env.PLATFORM_WALLET_ID || '0');
const PORT = process.env.PORT || 3000;

app.use(cors());

const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);

// ========== КОМАНДЫ БОТА ==========
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://startask-ten.vercel.app';

bot.start(async (ctx) => {
    const text = ctx.message.text;
    const param = text.substring(6).trim();

    if (param && param.startsWith('ref_')) {
        const referrerId = param.split('_')[1];
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

// ========== ПЛАТЕЖИ ==========
bot.on('pre_checkout_query', async (ctx) => {
    console.log('📥 pre_checkout_query received');
    try {
        await ctx.answerPreCheckoutQuery(true);
        console.log('✅ Pre-checkout approved');
    } catch (error) {
        console.error('❌ Pre-checkout error:', error);
        await ctx.answerPreCheckoutQuery(false, 'Временная ошибка');
    }
});

bot.on('successful_payment', async (ctx) => {
    const payment = ctx.message.successful_payment;
    const payload = JSON.parse(payment.invoice_payload);
    const { userId, amount } = payload;
    console.log(`💰 Payment received: user ${userId}, amount ${amount}`);
    try {
        await db.query(
            'UPDATE users SET stars_balance = stars_balance + $1 WHERE id = $2',
            [amount, userId]
        );
        await db.query(
            `INSERT INTO transactions (user_id, amount, type, status) VALUES ($1, $2, $3, $4)`,
            [userId, amount, 'topup', 'completed']
        );
        await ctx.reply(`✅ Баланс пополнен на ${amount} Stars!`);
        console.log(`✅ Balance updated for user ${userId}`);
    } catch (error) {
        console.error('❌ Error updating balance:', error);
        await ctx.reply('✅ Платёж получен! Баланс обновится в течение минуты.');
    }
});

app.post('/webhook', (req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
        try {
            const update = JSON.parse(body);
            await bot.handleUpdate(update, res);
        } catch(e) {
            console.error('❌ Webhook parse error:', e.message);
            res.status(400).send('Bad request');
        }
    });
});

app.use(express.json());

const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const parseMaybeJson = (value) => {
    if (!value || typeof value !== 'string') return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

const normalizeScreenshots = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);

    if (typeof value === 'string') {
        const parsed = parseMaybeJson(value);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);

        const pgArrayMatch = value.match(/^\{(.*)\}$/);
        if (pgArrayMatch) {
            return pgArrayMatch[1]
                .split(',')
                .map(v => v.replace(/^"|"$/g, '').trim())
                .filter(Boolean);
        }
    }

    return [];
};

const normalizeSocialLinks = (value) => {
    if (!value) return null;
    if (typeof value === 'object') return value;
    const parsed = parseMaybeJson(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
};

const normalizeQuestRow = (quest) => ({
    ...quest,
    screenshots: normalizeScreenshots(quest.screenshots),
    social_links: normalizeSocialLinks(quest.social_links)
});

async function initDB() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            telegram_id TEXT UNIQUE,
            username TEXT,
            stars_balance INTEGER DEFAULT 0,
            ton_balance DECIMAL(20,9) DEFAULT 0,
            total_earned INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS quests (
            id SERIAL PRIMARY KEY,
            advertiser_id INTEGER REFERENCES users(id),
            title TEXT,
            description TEXT,
            reward INTEGER,
            reward_type TEXT DEFAULT 'stars',
            type TEXT,
            target_url TEXT,
            budget INTEGER,
            remaining INTEGER,
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS completions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            quest_id INTEGER REFERENCES quests(id),
            screenshot_url TEXT,
            status TEXT DEFAULT 'pending',
            completed_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS referrals (
            id SERIAL PRIMARY KEY,
            referrer_id INTEGER REFERENCES users(id),
            referred_id INTEGER REFERENCES users(id),
            commission_earned INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            amount INTEGER,
            type TEXT,
            status TEXT,
            telegram_payload JSONB,
            created_at TIMESTAMP DEFAULT NOW()
        );
    `);
    console.log('✅ Database initialized');
}
initDB();

// ========== АВТОРИЗАЦИЯ ==========
app.post('/api/auth', async (req, res) => {
    const { telegramId, username } = req.body;
    try {
        let user = await db.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
        if (user.rows.length === 0) {
            const newUser = await db.query('INSERT INTO users (telegram_id, username) VALUES ($1, $2) RETURNING *', [telegramId, username]);
            user = newUser;
        }
        const token = require('jsonwebtoken').sign(
            { userId: user.rows[0].id, telegramId },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );
        res.json({ token, user: user.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/user/connect-wallet', async (req, res) => {
    const { userId, walletAddress } = req.body;
    try {
        await db.query(
            'UPDATE users SET ton_wallet = $1 WHERE id = $2',
            [walletAddress, userId]
        );
        console.log(`✅ Wallet connected for user ${userId}: ${walletAddress}`);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Wallet connect error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/ton-payment/verify', async (req, res) => {
    const { userId, txHash, amount } = req.body;

    try {
        // Проверяем не обрабатывали ли уже эту транзакцию
        const existing = await db.query(
            'SELECT id FROM transactions WHERE tx_hash = $1',
            [txHash]
        );
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Transaction already processed' });
        }

        // Верифицируем транзакцию через TON API
        const PLATFORM_WALLET = process.env.PLATFORM_TON_WALLET;
        const response = await axios.get(
            `https://toncenter.com/api/v2/getTransactions?address=${PLATFORM_WALLET}&limit=20`,
            { headers: { 'X-API-Key': process.env.TON_API_KEY || '' } }
        );

        const transactions = response.data.result;
        const tx = transactions.find(t => t.transaction_id.hash === txHash);

        if (!tx) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Проверяем что транзакция свежая (не старше 10 минут)
        const txTime = tx.utime * 1000;
        const now = Date.now();
        if (now - txTime > 10 * 60 * 1000) {
            return res.status(400).json({ error: 'Transaction too old' });
        }

        const tonAmount = tx.in_msg.value / 1e9; // конвертируем из нанотон

        // Зачисляем TON баланс
        await db.query(
            'UPDATE users SET ton_balance = ton_balance + $1 WHERE id = $2',
            [tonAmount, userId]
        );

        // Сохраняем транзакцию
        await db.query(
            `INSERT INTO transactions (user_id, amount, type, status, tx_hash, ton_amount)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, 0, 'ton_topup', 'completed', txHash, tonAmount]
        );

        console.log(`✅ TON payment verified: user ${userId}, amount ${tonAmount} TON`);
        res.json({ success: true, amount: tonAmount });

    } catch (error) {
        console.error('❌ TON verify error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

app.post('/api/ton-payment/credit', async (req, res) => {
    const { userId, amount, boc } = req.body;

    try {
        // Проверяем что такой boc ещё не обрабатывался
        const existing = await db.query(
            'SELECT id FROM transactions WHERE tx_hash = $1',
            [boc]
        );
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Transaction already processed' });
        }

        // Зачисляем TON баланс
        await db.query(
            'UPDATE users SET ton_balance = ton_balance + $1 WHERE id = $2',
            [amount, userId]
        );

        // Сохраняем транзакцию
        await db.query(
            `INSERT INTO transactions (user_id, amount, type, status, tx_hash, ton_amount)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, 0, 'ton_topup', 'completed', boc, amount]
        );

        console.log(`✅ TON credited: user ${userId}, amount ${amount} TON`);
        res.json({ success: true, amount });

    } catch (error) {
        console.error('❌ TON credit error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ПОПОЛНЕНИЕ БАЛАНСА ==========

// ✅ ФУНКЦИЯ СОЗДАНИЯ И ОТПРАВКИ ИНВОЙСА (РАБОТАЕТ С MINI APP)
app.post('/api/create-invoice', async (req, res) => {
    const { userId, amount } = req.body;
    const BOT_TOKEN = process.env.BOT_TOKEN;

    if (!BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN not configured' });
    if (!amount || amount < 1) return res.status(400).json({ error: 'Invalid amount' });

    try {
        const user = await db.query('SELECT telegram_id FROM users WHERE id = $1', [userId]);
        if (!user.rows[0]) return res.status(404).json({ error: 'User not found' });

        // ✅ createInvoiceLink вместо sendInvoice — возвращает ссылку, не шлёт сообщение
        const invoiceResponse = await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`,
            {
                title: '⭐ Пополнение StarTask',
                description: `Пополнение баланса на ${amount} Telegram Stars`,
                payload: JSON.stringify({ userId, amount, type: 'topup' }),
                currency: 'XTR',
                prices: [{ label: `${amount} Stars`, amount: amount }]
            }
        );

        const invoiceLink = invoiceResponse.data.result; // это строка-ссылка

        console.log(`✅ Invoice link created for user ${userId}, amount ${amount}`);
        res.json({ success: true, invoiceLink });

    } catch (error) {
        console.error('🔥 Error creating invoice link:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to create invoice link' });
    }
});

// Обработка успешного платежа (вызывается вебхуком или ботом)
app.post('/api/stars-payment/success', async (req, res) => {
    const { userId, amount, telegram_payment_id } = req.body;
    
    console.log(`💰 Stars payment success: user ${userId}, amount ${amount}`);

    try {
        // Начисляем Stars
        await db.query(
            'UPDATE users SET stars_balance = stars_balance + $1 WHERE id = $2',
            [amount, userId]
        );
        
        // Сохраняем транзакцию
        await db.query(
            `INSERT INTO transactions (user_id, amount, type, status) 
             VALUES ($1, $2, $3, $4)`,
            [userId, amount, 'topup', 'completed']
        );
        
        console.log(`✅ Balance updated for user ${userId}`);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error processing payment:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ВСЕ ОСТАЛЬНЫЕ ЭНДПОИНТЫ (БАЛАНСЫ, ЗАДАНИЯ, АДМИНКА) ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ ==========
app.get('/api/user/:userId/balance', async (req, res) => {
    try {
        const user = await db.query('SELECT stars_balance FROM users WHERE id = $1', [req.params.userId]);
        res.json({ balance: user.rows[0]?.stars_balance || 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/user/:userId/ton-balance', async (req, res) => {
    try {
        const user = await db.query('SELECT ton_balance FROM users WHERE id = $1', [req.params.userId]);
        res.json({ balance: parseFloat(user.rows[0]?.ton_balance || 0) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/quests', async (req, res) => {
    try {
        const quests = await db.query(
            `SELECT q.*, u.username as advertiser_name 
             FROM quests q 
             JOIN users u ON q.advertiser_id = u.id 
             WHERE q.status = 'active' AND q.remaining > 0
             ORDER BY q.created_at DESC`
        );
        res.json(quests.rows.map(normalizeQuestRow));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/user/:userId/quests', async (req, res) => {
    try {
        const quests = await db.query(
            'SELECT * FROM quests WHERE advertiser_id = $1 ORDER BY created_at DESC',
            [req.params.userId]
        );
        res.json(quests.rows.map(normalizeQuestRow));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/user/:userId/completions', async (req, res) => {
    try {
        const completions = await db.query(
            'SELECT quest_id FROM completions WHERE user_id = $1 AND status = $2',
            [req.params.userId, 'completed']
        );
        res.json(completions.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/create-quest', async (req, res) => {
    const { 
        userId, title, description, reward, targetUrl,
        inviteLink, verificationType,
        questType, extendedDescription, screenshots,
        socialLinks, subscribersCount, totalBudget,
		nftGiftUrl, postUrl, referralUrl 
    } = req.body;

    if (!userId || !title || !description || !reward || !targetUrl || !totalBudget) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    if (totalBudget < reward) {
        return res.status(400).json({ error: 'Бюджет не может быть меньше награды' });
    }

    const maxParticipants = Math.floor(totalBudget / reward);

    try {
        const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (user.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });

        // Считаем комиссию
        let commissionAmount = 0;
        if (questType === 'extended') {
            const baseCommission = Math.max(50, Math.floor(totalBudget * 0.05));
            const socialLinksCount = socialLinks ? Object.values(socialLinks).filter(v => v).length : 0;
            commissionAmount = baseCommission + (socialLinksCount * 100);
        }

        // Проверяем баланс — должно хватить на бюджет
        if (user.rows[0].stars_balance < totalBudget) {
            return res.status(400).json({ 
                error: `Недостаточно Stars. Нужно ${totalBudget} ⭐, у вас ${user.rows[0].stars_balance} ⭐` 
            });
        }

        // Блокируем бюджет на балансе
        await db.query(
            'UPDATE users SET stars_balance = stars_balance - $1 WHERE id = $2',
            [totalBudget, userId]
        );

        // Вступаем в канал для admin-верификации
        if (verificationType === 'admin' || !verificationType) {
            let channelUsername = targetUrl;
            if (targetUrl.includes('t.me/')) {
                channelUsername = targetUrl.split('t.me/')[1].replace('/', '').split('?')[0];
            }
            try {
                await axios.get(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/joinChat`, {
                    params: { chat_id: `@${channelUsername}` }
                });
            } catch (e) {
                console.warn(`⚠️ Could not join:`, e.response?.data?.description);
            }
        }

        const newQuest = await db.query(
    `INSERT INTO quests (
        advertiser_id, title, description, reward, reward_type, type, 
        target_url, invite_link, verification_type,
        quest_type, extended_description, screenshots, social_links, 
        subscribers_count, commission_amount, commission_paid,
        budget, remaining, status, nft_gift_url, post_url, referral_url
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
    [
        userId, title, description, reward, 'stars', 'subscription',
        targetUrl, inviteLink || null, verificationType || 'admin',
        questType || 'basic', extendedDescription || null, 
        screenshots || null, socialLinks ? JSON.stringify(socialLinks) : null,
        subscribersCount || null, commissionAmount, false,
        parseInt(totalBudget) || 10000, parseInt(totalBudget) || 10000, 'pending',
        nftGiftUrl || null,  
		postUrl || null,
		referralUrl || null
    ]
);

        // Записываем блокировку
        await db.query(
            'INSERT INTO budget_locks (quest_id, user_id, amount, status) VALUES ($1, $2, $3, $4)',
            [newQuest.rows[0].id, userId, totalBudget, 'locked']
        );

        console.log(`✅ Quest created: budget ${totalBudget} Stars locked, max ${maxParticipants} participants`);
        res.json({ 
            success: true, 
            message: `Задание отправлено на модерацию. Бюджет ${totalBudget} ⭐ заблокирован.`,
            quest: normalizeQuestRow(newQuest.rows[0]),
            maxParticipants,
            commissionAmount
        });
    } catch (error) {
        console.error('Create quest error:', error);
        res.status(500).json({ error: 'Ошибка: ' + error.message });
    }
});

app.post('/api/check-subscription', async (req, res) => {
    const { userId, channelUsername, questId } = req.body;
    const BOT_TOKEN = process.env.BOT_TOKEN;

    if (!BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN not configured' });

    try {
        const user = await db.query('SELECT telegram_id FROM users WHERE id = $1', [userId]);
        if (!user.rows[0]) return res.status(404).json({ error: 'User not found' });

        const quest = await db.query('SELECT * FROM quests WHERE id = $1', [questId]);
        if (quest.rows.length === 0) return res.status(404).json({ error: 'Quest not found' });

        const existingCompletion = await db.query(
            'SELECT * FROM completions WHERE user_id = $1 AND quest_id = $2 AND status = $3',
            [userId, questId, 'completed']
        );
        if (existingCompletion.rows.length > 0) {
            return res.json({ success: false, message: 'Вы уже выполнили это задание' });
        }

        const telegramId = user.rows[0].telegram_id;
        const verificationType = quest.rows[0].verification_type || 'admin';
        const reward = quest.rows[0].reward;
        const rewardType = quest.rows[0].reward_type || 'stars';

        let isVerified = false;

        if (verificationType === 'invite' || verificationType === 'repost' || verificationType === 'referral') {
            // Доверенная верификация — засчитываем факт возврата
            isVerified = true;
            console.log(`✅ Invite verification for user ${userId}, quest ${questId}`);
        } else {
            // Проверка через getChatMember
            try {
                const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember`, {
                    params: { chat_id: `@${channelUsername}`, user_id: telegramId }
                });
                const status = response.data.result.status;
                isVerified = ['creator', 'administrator', 'member'].includes(status);
            } catch (apiError) {
                const description = apiError.response?.data?.description || '';
                if (description.includes('member list is inaccessible')) {
                    return res.status(400).json({
                        error: 'Бот не является администратором канала. Попросите рекламодателя добавить @StarTaskBot как администратора.',
                        code: 'BOT_NOT_ADMIN'
                    });
                }
                throw apiError;
            }
        }

        if (isVerified) {
            if (rewardType === 'ton') {
                await db.query('UPDATE users SET ton_balance = ton_balance + $1 WHERE id = $2', [reward, userId]);
            } else {
                await db.query('UPDATE users SET stars_balance = stars_balance + $1 WHERE id = $2', [reward, userId]);
            }
            await db.query('UPDATE quests SET remaining = remaining - $1 WHERE id = $2', [reward, questId]);
            await db.query(
                'INSERT INTO completions (user_id, quest_id, screenshot_url, status) VALUES ($1, $2, $3, $4)',
                [userId, questId, verificationType === 'invite' ? 'invite_verified' : 'auto_verified', 'completed']
            );

            const currencySymbol = rewardType === 'ton' ? 'TON' : '⭐';
            return res.json({ success: true, message: `✅ Вы получили ${reward} ${currencySymbol}!` });
        } else {
            return res.json({ success: false, message: '❌ Вы не подписались на канал' });
        }
    } catch (error) {
        console.error('Subscription check error:', error);
        res.status(500).json({ error: 'Failed to check subscription' });
    }
});

app.post('/api/referral/create', async (req, res) => {
    const { userId } = req.body;
    const link = `https://t.me/StarTaskBot?start=ref_${userId}`;
    res.json({ link });
});

app.get('/api/referral/:userId/stats', async (req, res) => {
    try {
        const referrals = await db.query(
            `SELECT COUNT(*) as count, SUM(commission_earned) as total_commission 
             FROM referrals WHERE referrer_id = $1`,
            [req.params.userId]
        );
        res.json({
            count: parseInt(referrals.rows[0].count),
            totalCommission: parseInt(referrals.rows[0].total_commission) || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/channel/avatar/:username', async (req, res) => {
    const { username } = req.params;
    
    try {
        const response = await axios.get(`https://t.me/s/${username}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 15000
        });
        
        const html = response.data;
        let avatarUrl = null;
        
        const ogMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/);
        if (ogMatch && ogMatch[1]) avatarUrl = ogMatch[1];
        
        if (!avatarUrl) {
            const imgMatch = html.match(/<img[^>]*class="tgme_page_photo_image"[^>]*src="([^"]+)"/);
            if (imgMatch && imgMatch[1]) avatarUrl = imgMatch[1];
        }
        
        if (!avatarUrl) {
            const bgMatch = html.match(/background-image:url\(['"]?([^'"()]+)['"]?\)/);
            if (bgMatch && bgMatch[1]) avatarUrl = bgMatch[1];
        }
        
        if (avatarUrl) {
            avatarUrl = avatarUrl.split('?')[0];
            console.log(`✅ Avatar found for @${username}: ${avatarUrl}`);
            return res.json({ success: true, avatar: avatarUrl });
        } else {
            console.log(`❌ Avatar not found for @${username}`);
            return res.json({ success: false, avatar: null, message: 'Avatar not found' });
        }
    } catch (error) {
        console.error(`Error fetching avatar for @${username}:`, error.message);
        return res.status(500).json({ success: false, error: 'Failed to fetch channel data' });
    }
});

app.get('/api/admin/pending-quests', async (req, res) => {
    try {
        const quests = await db.query(
            `SELECT q.*, u.username as creator_name, u.telegram_id as creator_telegram_id
             FROM quests q
             JOIN users u ON q.advertiser_id = u.id
             WHERE q.status = 'pending'
             ORDER BY q.created_at ASC`
        );
        res.json(quests.rows.map(normalizeQuestRow));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/approve-quest/:questId', async (req, res) => {
    const { questId } = req.params;
    const { adminId } = req.body;
    const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;

    if (String(adminId) !== String(ADMIN_ID)) {
        return res.status(403).json({ error: 'Доступ запрещён' });
    }

    try {
        const quest = await db.query('SELECT * FROM quests WHERE id = $1', [questId]);
        if (!quest.rows[0]) return res.status(404).json({ error: 'Задание не найдено' });

        const { advertiser_id, commission_amount, commission_paid, quest_type, total_budget } = quest.rows[0];

        // Списываем комиссию PRO и зачисляем на аккаунт админа
        if (quest_type === 'extended' && commission_amount > 0 && !commission_paid) {
            const advertiser = await db.query('SELECT stars_balance FROM users WHERE id = $1', [advertiser_id]);

            if (advertiser.rows[0].stars_balance < commission_amount) {
                return res.status(400).json({ 
                    error: `Недостаточно Stars для комиссии. Нужно ${commission_amount} ⭐` 
                });
            }

            // Списываем комиссию с рекламодателя
            await db.query(
                'UPDATE users SET stars_balance = stars_balance - $1 WHERE id = $2',
                [commission_amount, advertiser_id]
            );

            // Зачисляем комиссию на аккаунт админа (telegram_id = ADMIN_TELEGRAM_ID)
            await db.query(
                'UPDATE users SET stars_balance = stars_balance + $1 WHERE telegram_id = $2',
                [commission_amount, ADMIN_ID]
            );

            await db.query('UPDATE quests SET commission_paid = true WHERE id = $1', [questId]);
            console.log(`💰 Commission ${commission_amount} Stars → admin account`);
        }

        await db.query('UPDATE quests SET status = $1 WHERE id = $2', ['active', questId]);

        const msg = commission_amount > 0 
            ? `Одобрено. Списано ${commission_amount} ⭐ комиссии` 
            : 'Задание опубликовано';
        res.json({ success: true, message: msg });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/reject-quest/:questId', async (req, res) => {
    const { questId } = req.params;
    const { adminId, reason } = req.body;
    const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;
    
    if (String(adminId) !== String(ADMIN_ID)) {
        return res.status(403).json({ error: 'Доступ запрещён' });
    }
    
    try {
        await db.query('UPDATE quests SET status = $1, rejection_reason = $2 WHERE id = $3', ['rejected', reason || 'Не указана', questId]);
        res.json({ success: true, message: 'Задание отклонено' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/deactivate-quest/:questId', async (req, res) => {
    const { questId } = req.params;
    const { adminId } = req.body;
    const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;

    if (String(adminId) !== String(ADMIN_ID)) {
        return res.status(403).json({ error: 'Доступ запрещён' });
    }

    try {
        const quest = await db.query('SELECT * FROM quests WHERE id = $1', [questId]);
        if (!quest.rows[0]) return res.status(404).json({ error: 'Задание не найдено' });

        const { advertiser_id, remaining, reward, total_budget } = quest.rows[0];

        // Считаем неизрасходованный остаток
        const unspentBudget = remaining * reward;

        if (unspentBudget > 0) {
            // 10% платформе (зачисляем на аккаунт админа)
            const platformFee = Math.floor(unspentBudget * 0.1);
            // 90% возвращаем рекламодателю
            const refundAmount = unspentBudget - platformFee;

            await db.query(
                'UPDATE users SET stars_balance = stars_balance + $1 WHERE id = $2',
                [refundAmount, advertiser_id]
            );

            await db.query(
                'UPDATE users SET stars_balance = stars_balance + $1 WHERE telegram_id = $2',
                [platformFee, ADMIN_ID]
            );

            console.log(`💸 Budget refund: ${refundAmount} Stars → advertiser, ${platformFee} Stars → admin`);
        }

        await db.query('UPDATE quests SET status = $1 WHERE id = $2', ['inactive', questId]);

        const msg = unspentBudget > 0
            ? `Снято. Возврат: ${Math.floor(unspentBudget * 0.9)} ⭐ рекламодателю, ${Math.floor(unspentBudget * 0.1)} ⭐ платформе`
            : 'Задание снято с публикации';

        res.json({ success: true, message: msg });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/active-quests', async (req, res) => {
    const { adminId } = req.query;
    const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;
    
    if (String(adminId) !== String(ADMIN_ID)) {
        return res.status(403).json({ error: 'Доступ запрещён' });
    }
    
    try {
        const quests = await db.query(
            `SELECT q.*, u.username as creator_name, u.telegram_id as creator_telegram_id
             FROM quests q
             JOIN users u ON q.advertiser_id = u.id
             WHERE q.status = 'active'
             ORDER BY q.created_at DESC`
        );
        res.json(quests.rows.map(normalizeQuestRow));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Получить текущий курс конвертации
app.get('/api/settings/rate', async (req, res) => {
    try {
        const result = await db.query("SELECT value FROM settings WHERE key = 'stars_to_ton_rate'");
        res.json({ rate: parseInt(result.rows[0]?.value || 100) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Изменить курс (только админ)
app.post('/api/admin/set-rate', async (req, res) => {
    const { adminId, rate } = req.body;
    const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;
    if (String(adminId) !== String(ADMIN_ID)) return res.status(403).json({ error: 'Доступ запрещён' });
    try {
        await db.query("UPDATE settings SET value = $1 WHERE key = 'stars_to_ton_rate'", [rate]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Конвертация Stars → TON
app.post('/api/convert/stars-to-ton', async (req, res) => {
    const { userId, starsAmount } = req.body;
    try {
        const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (!user.rows[0]) return res.status(404).json({ error: 'Пользователь не найден' });

        const rateResult = await db.query("SELECT value FROM settings WHERE key = 'stars_to_ton_rate'");
        const rate = parseInt(rateResult.rows[0]?.value || 100);

        if (user.rows[0].stars_balance < starsAmount) {
            return res.status(400).json({ error: 'Недостаточно Stars на балансе' });
        }
        if (starsAmount < rate) {
            return res.status(400).json({ error: `Минимум ${rate} Stars для конвертации` });
        }

        const tonAmount = starsAmount / rate;

        await db.query('UPDATE users SET stars_balance = stars_balance - $1, ton_balance = ton_balance + $2 WHERE id = $3',
            [starsAmount, tonAmount, userId]);

        await db.query(`INSERT INTO transactions (user_id, amount, type, status, ton_amount)
            VALUES ($1, $2, $3, $4, $5)`,
            [userId, starsAmount, 'convert', 'completed', tonAmount]);

        console.log(`✅ Converted: user ${userId}, ${starsAmount} Stars → ${tonAmount} TON`);
        res.json({ success: true, tonAmount, rate });
    } catch (error) {
        console.error('Convert error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Запрос на вывод TON
app.post('/api/withdraw/ton', async (req, res) => {
    const { userId, amount } = req.body;
    try {
        const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (!user.rows[0]) return res.status(404).json({ error: 'Пользователь не найден' });
        if (!user.rows[0].ton_wallet) return res.status(400).json({ error: 'Кошелёк не подключён' });
        if (user.rows[0].ton_balance < amount) return res.status(400).json({ error: 'Недостаточно TON' });
        if (amount < 0.1) return res.status(400).json({ error: 'Минимальный вывод 0.1 TON' });

        // Списываем с баланса и создаём заявку
        await db.query('UPDATE users SET ton_balance = ton_balance - $1 WHERE id = $2', [amount, userId]);
        await db.query(`INSERT INTO withdrawals (user_id, amount, wallet_address, status)
            VALUES ($1, $2, $3, $4)`,
            [userId, amount, user.rows[0].ton_wallet, 'pending']);

        console.log(`💸 Withdrawal request: user ${userId}, ${amount} TON → ${user.rows[0].ton_wallet}`);
        res.json({ success: true, message: 'Заявка на вывод создана. Обработка до 24 часов.' });
    } catch (error) {
        console.error('Withdraw error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Список заявок на вывод (для админа)
app.get('/api/admin/withdrawals', async (req, res) => {
    const { adminId } = req.query;
    const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;
    if (String(adminId) !== String(ADMIN_ID)) return res.status(403).json({ error: 'Доступ запрещён' });
    try {
        const result = await db.query(`
            SELECT w.*, u.username, u.telegram_id
            FROM withdrawals w
            JOIN users u ON w.user_id = u.id
            WHERE w.status = 'pending'
            ORDER BY w.created_at ASC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Отметить вывод как выполненный + автоматическая отправка TON
app.post('/api/admin/withdrawals/:id/complete', async (req, res) => {
    const { adminId } = req.body;
    const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;
    
    if (String(adminId) !== String(ADMIN_ID)) {
        return res.status(403).json({ error: 'Доступ запрещён' });
    }
    
    try {
        // Получаем данные заявки
        const withdrawal = await db.query(
            'SELECT w.*, u.ton_wallet FROM withdrawals w JOIN users u ON w.user_id = u.id WHERE w.id = $1 AND w.status = $2',
            [req.params.id, 'pending']
        );
        
        if (!withdrawal.rows[0]) {
            return res.status(404).json({ error: 'Заявка не найдена или уже обработана' });
        }

        const { amount, wallet_address } = withdrawal.rows[0];
        
        console.log(`🚀 Авто-вывод: ${amount} TON → ${wallet_address}`);
        
        // Отправляем TON автоматически
        const sendResult = await sendTonToWallet(wallet_address, amount);
        
        if (!sendResult.success) {
            return res.status(500).json({ 
                error: `Не удалось отправить TON: ${sendResult.error}`,
                details: 'Попробуйте отправить вручную или проверьте баланс кошелька платформы' 
            });
        }

        // Обновляем статус в БД
        await db.query(
            "UPDATE withdrawals SET status = 'completed', processed_at = NOW(), tx_hash = $2 WHERE id = $1",
            [req.params.id, sendResult.hash]
        );

        console.log(`✅ Вывод #${req.params.id} выполнен, хеш: ${sendResult.hash}`);
        
        res.json({ 
            success: true, 
            message: 'TON отправлены автоматически',
            hash: sendResult.hash 
        });
        
    } catch (error) {
        console.error('Ошибка автовывода:', error);
        res.status(500).json({ error: error.message });
    }
});

// Автоматическая отправка TON
async function sendTonToWallet(toAddress, amount) {
    try {
        if (!PLATFORM_MNEMONIC.length) {
            console.error('❌ PLATFORM_TON_MNEMONIC не настроена');
            return { success: false, error: 'Мнемоника не настроена' };
        }

        console.log(`💸 Отправка ${amount} TON на ${toAddress}...`);

        const key = await mnemonicToPrivateKey(PLATFORM_MNEMONIC);
        
        // Wallet V5 в @ton/ton v16
        const { WalletContractV5R1 } = require('@ton/ton');
        
        const wallet = WalletContractV5R1.create({
            workchain: 0,
            publicKey: key.publicKey
        });
        
        const contract = TON_CLIENT.open(wallet);
        const seqno = await contract.getSeqno();
        const balanceRaw = await TON_CLIENT.getBalance(wallet.address);
        const balance = Number(balanceRaw) / 1e9;
        
        console.log(`💰 Баланс: ${balance} TON, seqno: ${seqno}, адрес: ${wallet.address.toString()}`);

        const amountNano = toNano(amount.toString());

        if (BigInt(balanceRaw) < BigInt(amountNano) + toNano('0.05')) {
            return { success: false, error: `Недостаточно TON. Баланс: ${balance}` };
        }

        const toWalletAddress = Address.parse(toAddress);
        
        const transfer = await contract.createTransfer({
            seqno,
            secretKey: key.secretKey,
            messages: [
                internal({
                    to: toWalletAddress,
                    value: amountNano,
                    bounce: true,
                    body: beginCell().storeUint(0, 32).storeStringTail('StarTask withdrawal').endCell()
                })
            ]
        });

        await TON_CLIENT.sendExternalMessage(wallet, transfer);
        
        console.log(`✅ Отправлено ${amount} TON → ${toAddress}`);
        
        return { success: true, hash: 'sent' };
    } catch (error) {
        console.error('❌ Ошибка отправки TON:', error);
        return { success: false, error: error.message };
    }
}

app.get('/api/admin/wallet-info', async (req, res) => {
    try {
        if (!PLATFORM_MNEMONIC.length) {
            return res.json({ error: 'Мнемоника не настроена' });
        }
        
        const key = await mnemonicToPrivateKey(PLATFORM_MNEMONIC);
        const wallet = WalletContractV4.create({
            workchain: 0,
            publicKey: key.publicKey
        });
        
        const balanceRaw = await TON_CLIENT.getBalance(wallet.address);
        const balance = Number(balanceRaw) / 1e9;
        const seqno = await TON_CLIENT.open(wallet).getSeqno();
        
        res.json({
            address: wallet.address.toString({
                bounceable: false,
                testOnly: false
            }),
            balance,
            seqno,
            walletId: wallet.walletId || 'v4'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/parse-nft-background', async (req, res) => {
    const { nftUrl } = req.body;
    
    if (!nftUrl || !nftUrl.includes('t.me/nft/')) {
        return res.json({ success: false });
    }

    try {
        const giftPath = nftUrl.split('t.me/nft/')[1].split('?')[0];
        
        const response = await axios.get(`https://t.me/nft/${giftPath}`, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        const html = response.data;
        
        // Берём og:image — это главное изображение подарка
        const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/);
        const backgroundImage = ogImageMatch?.[1] || null;

        if (backgroundImage) {
            console.log(`✅ NFT background parsed: ${giftPath}`);
            res.json({ 
                success: true, 
                backgroundImage,
                giftPath
            });
        } else {
            res.json({ success: false });
        }
    } catch (error) {
        console.error(`❌ NFT parse error:`, error.message);
        res.json({ success: false });
    }
});

app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    const WEBHOOK_URL = process.env.WEBHOOK_URL;
    if (WEBHOOK_URL) {
        try {
            const result = await bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`);
            console.log(`✅ Webhook set result:`, JSON.stringify(result));
        } catch (err) {
            console.error('❌ Webhook setup error:', err.message);
        }
    }

    // Устанавливаем кнопку меню глобально для всех пользователей
    try {
        await bot.telegram.setChatMenuButton({
            menu_button: {
                type: 'web_app',
                text: '🚀 Открыть StarTask',
                web_app: { url: MINI_APP_URL }
            }
        });
        console.log('✅ Menu button set globally');
    } catch (err) {
        console.error('❌ Menu button error:', err.message);
    }
});
module.exports = bot;
