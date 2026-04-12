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
            total_earned INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS quests (
            id SERIAL PRIMARY KEY,
            advertiser_id INTEGER REFERENCES users(id),
            title TEXT,
            description TEXT,
            reward INTEGER,
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

app.get('/api/user/:userId/balance', async (req, res) => {
    try {
        const user = await db.query('SELECT stars_balance, total_earned FROM users WHERE id = $1', [req.params.userId]);
        res.json({ balance: user.rows[0]?.stars_balance || 0 });
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
        res.json(quests.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/quests', async (req, res) => {
    const { advertiserId, title, description, reward, type, targetUrl, budget } = req.body;
    try {
        const advertiser = await db.query('SELECT stars_balance FROM users WHERE id = $1', [advertiserId]);
        if (advertiser.rows[0].stars_balance < budget) {
            return res.status(400).json({ error: 'Insufficient Stars balance' });
        }
        const quest = await db.query(
            `INSERT INTO quests (advertiser_id, title, description, reward, type, target_url, budget, remaining) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [advertiserId, title, description, reward, type, targetUrl, budget, budget]
        );
        await db.query('UPDATE users SET stars_balance = stars_balance - $1 WHERE id = $2', [budget, advertiserId]);
        res.json(quest.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/quests/:questId/complete', async (req, res) => {
    const { questId } = req.params;
    const { userId, screenshotUrl } = req.body;
    try {
        const quest = await db.query('SELECT * FROM quests WHERE id = $1', [questId]);
        if (quest.rows[0].remaining <= 0) {
            return res.status(400).json({ error: 'Quest budget exhausted' });
        }
        const completion = await db.query(
            `INSERT INTO completions (user_id, quest_id, screenshot_url) VALUES ($1, $2, $3) RETURNING *`,
            [userId, questId, screenshotUrl]
        );
        res.json(completion.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
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

// НОВЫЙ ЭНДПОИНТ ДЛЯ АВАТАРОК (через парсинг страницы)
app.get('/api/channel/avatar/:username', async (req, res) => {
    const { username } = req.params;
    
    try {
        const response = await axios.get(`https://t.me/s/${username}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        
        const $ = cheerio.load(response.data);
        const avatarElement = $('.tgme_page_photo_image');
        let avatarUrl = null;
        
        if (avatarElement.length) {
            let src = avatarElement.attr('src');
            if (!src) {
                const style = avatarElement.attr('style');
                if (style) {
                    const match = style.match(/url\(['"]?([^'"()]+)['"]?\)/);
                    if (match) src = match[1];
                }
            }
            avatarUrl = src ? src.split('?')[0] : null;
        }
        
        if (avatarUrl) {
            res.json({ success: true, avatar: avatarUrl });
        } else {
            res.json({ success: false, avatar: null, message: 'Avatar not found' });
        }
    } catch (error) {
        console.error('Avatar fetch error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch channel data' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});