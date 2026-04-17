require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
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

// ========== БАЛАНСЫ ==========
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
        res.json({ balance: user.rows[0]?.ton_balance || 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== ЗАДАНИЯ ==========
app.get('/api/quests', async (req, res) => {
    try {
        const quests = await db.query(
            `SELECT q.*, u.username as advertiser_name 
             FROM quests q 
             JOIN users u ON q.advertiser_id = u.id 
             WHERE q.status = 'active' AND q.remaining > 0
             ORDER BY q.created_at DESC`
        );
        res.json(quests.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ЗАДАНИЯ, СОЗДАННЫЕ ПОЛЬЗОВАТЕЛЕМ
app.get('/api/user/:userId/quests', async (req, res) => {
    try {
        const quests = await db.query(
            'SELECT * FROM quests WHERE advertiser_id = $1 ORDER BY created_at DESC',
            [req.params.userId]
        );
        res.json(quests.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ВЫПОЛНЕННЫЕ ЗАДАНИЯ ПОЛЬЗОВАТЕЛЯ
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

// СОЗДАНИЕ ЗАДАНИЯ
// СОЗДАНИЕ ЗАДАНИЯ (статус pending, ждёт модерации)
app.post('/api/create-quest', async (req, res) => {
    const { userId, title, description, reward, targetUrl } = req.body;
    
    if (!userId || !title || !description || !reward || !targetUrl) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }
    
    try {
        const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        // Создаём задание со статусом 'pending'
        const newQuest = await db.query(
            `INSERT INTO quests (advertiser_id, title, description, reward, reward_type, type, target_url, budget, remaining, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [userId, title, description, reward, 'stars', 'subscription', targetUrl, 10000, 10000, 'pending']
        );
        
        res.json({ success: true, message: 'Задание отправлено на модерацию', quest: newQuest.rows[0] });
    } catch (error) {
        console.error('Create quest error:', error);
        res.status(500).json({ error: 'Ошибка создания задания: ' + error.message });
    }
});

// ПРОВЕРКА ПОДПИСКИ И НАЧИСЛЕНИЕ НАГРАДЫ
app.post('/api/check-subscription', async (req, res) => {
    const { userId, channelUsername, questId } = req.body;
    const BOT_TOKEN = process.env.BOT_TOKEN;
    
    if (!BOT_TOKEN) {
        return res.status(500).json({ error: 'BOT_TOKEN not configured' });
    }
    
    try {
        const user = await db.query('SELECT telegram_id FROM users WHERE id = $1', [userId]);
        if (!user.rows[0]) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const telegramId = user.rows[0].telegram_id;
        const quest = await db.query('SELECT * FROM quests WHERE id = $1', [questId]);
        
        if (quest.rows.length === 0) {
            return res.status(404).json({ error: 'Quest not found' });
        }
        
        const existingCompletion = await db.query(
            'SELECT * FROM completions WHERE user_id = $1 AND quest_id = $2 AND status = $3',
            [userId, questId, 'completed']
        );
        
        if (existingCompletion.rows.length > 0) {
            return res.json({ success: false, message: 'Вы уже выполнили это задание' });
        }
        
        const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember`, {
            params: {
                chat_id: `@${channelUsername}`,
                user_id: telegramId
            }
        });
        
        const status = response.data.result.status;
        const isMember = ['creator', 'administrator', 'member'].includes(status);
        
        if (isMember) {
            const reward = quest.rows[0].reward;
            const rewardType = quest.rows[0].reward_type || 'stars';
            
            if (rewardType === 'ton') {
                await db.query('UPDATE users SET ton_balance = ton_balance + $1 WHERE id = $2', [reward, userId]);
            } else {
                await db.query('UPDATE users SET stars_balance = stars_balance + $1 WHERE id = $2', [reward, userId]);
            }
            
            await db.query('UPDATE quests SET remaining = remaining - $1 WHERE id = $2', [reward, questId]);
            await db.query(
                'INSERT INTO completions (user_id, quest_id, screenshot_url, status) VALUES ($1, $2, $3, $4)',
                [userId, questId, 'auto_verified', 'completed']
            );
            
            const currencySymbol = rewardType === 'ton' ? 'TON' : '⭐';
            return res.json({ success: true, message: `✅ Вы получили ${reward} ${currencySymbol}!` });
        } else {
            return res.json({ success: false, message: '❌ Вы не подписались на канал' });
        }
    } catch (error) {
        console.error('Subscription check error:', error);
        if (error.response?.data?.description?.includes('bot is not a member')) {
            return res.status(500).json({ error: 'Бот не добавлен в администраторы канала' });
        }
        res.status(500).json({ error: 'Failed to check subscription' });
    }
});

// ========== РЕФЕРАЛЫ ==========
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

// ========== АВАТАРКИ КАНАЛОВ (УЛУЧШЕННАЯ ВЕРСИЯ) ==========
app.get('/api/channel/avatar/:username', async (req, res) => {
    const { username } = req.params;
    
    try {
        // Пробуем получить через официальный API Telegram (публичные данные)
        const response = await axios.get(`https://t.me/s/${username}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });
        
        const html = response.data;
        let avatarUrl = null;
        
        // Способ 1: ищем в теге meta og:image
        const ogMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/);
        if (ogMatch && ogMatch[1]) {
            avatarUrl = ogMatch[1];
        }
        
        // Способ 2: ищем в теге img с классом tgme_page_photo_image
        if (!avatarUrl) {
            const imgMatch = html.match(/<img[^>]*class="tgme_page_photo_image"[^>]*src="([^"]+)"/);
            if (imgMatch && imgMatch[1]) {
                avatarUrl = imgMatch[1];
            }
        }
        
        // Способ 3: ищем в стилях background-image
        if (!avatarUrl) {
            const bgMatch = html.match(/background-image:url\(['"]?([^'"()]+)['"]?\)/);
            if (bgMatch && bgMatch[1]) {
                avatarUrl = bgMatch[1];
            }
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
// ========== АДМИН-ПАНЕЛЬ ==========

// Получение всех заданий на модерацию
app.get('/api/admin/pending-quests', async (req, res) => {
    try {
        const quests = await db.query(
            `SELECT q.*, u.username as creator_name, u.telegram_id as creator_telegram_id
             FROM quests q
             JOIN users u ON q.advertiser_id = u.id
             WHERE q.status = 'pending'
             ORDER BY q.created_at ASC`
        );
        res.json(quests.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Одобрение задания
app.post('/api/admin/approve-quest/:questId', async (req, res) => {
    const { questId } = req.params;
    const { adminId } = req.body;
    
    // Проверка, что adminId — это мой Telegram ID
    const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID; 
    
    if (adminId !== parseInt(ADMIN_ID)) {
        return res.status(403).json({ error: 'Доступ запрещён' });
    }
    
    try {
        await db.query(
            'UPDATE quests SET status = $1 WHERE id = $2',
            ['active', questId]
        );
        res.json({ success: true, message: 'Задание одобрено и опубликовано' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Отклонение задания
app.post('/api/admin/reject-quest/:questId', async (req, res) => {
    const { questId } = req.params;
    const { adminId, reason } = req.body;
    
    const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;
    
    if (adminId !== parseInt(ADMIN_ID)) {
        return res.status(403).json({ error: 'Доступ запрещён' });
    }
    
    try {
        await db.query(
            'UPDATE quests SET status = $1 WHERE id = $2',
            ['rejected', questId]
        );
        res.json({ success: true, message: 'Задание отклонено' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});