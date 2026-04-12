import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://star-task.up.railway.app';

function App() {
    const [user, setUser] = useState(null);
    const [balance, setBalance] = useState(0);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('tasks');
    const [channelAvatars, setChannelAvatars] = useState({});

    useEffect(() => {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        tg.MainButton.hide();

        if (tg.initDataUnsafe?.user) {
            authenticate(tg.initDataUnsafe.user);
        }
    }, []);

    const authenticate = async (telegramUser) => {
        try {
            const response = await axios.post(`${API_URL}/api/auth`, {
                telegramId: telegramUser.id,
                username: telegramUser.username
            });
            
            setUser(response.data.user);
            localStorage.setItem('token', response.data.token);
            
            fetchBalance(response.data.user.id);
            fetchTasks();
        } catch (error) {
            console.error('Auth error:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBalance = async (userId) => {
        try {
            const response = await axios.get(`${API_URL}/api/user/${userId}/balance`);
            setBalance(response.data.balance);
        } catch (error) {
            console.error('Balance error:', error);
        }
    };

    const fetchTasks = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/quests`);
            // Убираем дубликаты
            const uniqueTasks = response.data.filter((task, index, self) => 
                index === self.findIndex(t => t.target_url === task.target_url)
            );
            setTasks(uniqueTasks);
            
            // Загружаем аватарки для каналов
            for (const task of uniqueTasks) {
                if (task.type === 'subscription' && task.target_url.includes('t.me/')) {
                    let username = task.target_url.split('t.me/')[1];
                    username = username.replace('/', '');
                    await fetchChannelAvatar(username, task.id);
                }
            }
        } catch (error) {
            console.error('Tasks error:', error);
        }
    };

    const fetchChannelAvatar = async (username, taskId) => {
        try {
            const response = await axios.get(`${API_URL}/api/channel/avatar/${username}`);
            if (response.data.success && response.data.avatar) {
                setChannelAvatars(prev => ({ ...prev, [taskId]: response.data.avatar }));
            } else {
                setChannelAvatars(prev => ({ ...prev, [taskId]: null }));
            }
        } catch (error) {
            console.error('Avatar fetch error:', error);
            setChannelAvatars(prev => ({ ...prev, [taskId]: null }));
        }
    };

    const completeTask = async (taskId, taskUrl) => {
        const tg = window.Telegram.WebApp;
        tg.openLink(taskUrl);
        
        tg.showConfirm('✅ Вы подписались на канал? Нажмите "Да", чтобы получить Stars', async (confirmed) => {
            if (confirmed) {
                try {
                    await axios.post(`${API_URL}/api/quests/${taskId}/complete`, {
                        userId: user.id,
                        screenshotUrl: 'completed'
                    });
                    
                    tg.showPopup({
                        title: '🎉 Задание выполнено!',
                        message: 'Stars будут начислены после проверки',
                        buttons: [{ type: 'ok' }]
                    });
                    
                    fetchBalance(user.id);
                } catch (error) {
                    tg.showPopup({
                        title: '❌ Ошибка',
                        message: error.response?.data?.error || 'Что-то пошло не так',
                        buttons: [{ type: 'ok' }]
                    });
                }
            }
        });
    };

    const getReferralLink = () => `https://t.me/StarTaskBot?start=ref_${user?.id}`;

    const copyReferralLink = () => {
        navigator.clipboard.writeText(getReferralLink());
        window.Telegram.WebApp.showPopup({
            title: '🔗 Ссылка скопирована!',
            message: 'Поделитесь с друзьями и получайте 10% от их заработка',
            buttons: [{ type: 'ok' }]
        });
    };

    if (loading) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p style={styles.loadingText}>Загрузка...</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.logo}>⭐ StarTask</h1>
                    <p style={styles.subtitle}>Зарабатывай Stars на заданиях</p>
                </div>
                <div style={styles.balanceCard}>
                    <span style={styles.balanceLabel}>Баланс</span>
                    <span style={styles.balanceValue}>{balance} ⭐</span>
                </div>
            </div>

            <div style={styles.tabs}>
                <button onClick={() => setActiveTab('tasks')} style={activeTab === 'tasks' ? styles.tabActive : styles.tab}>📋 Задания</button>
                <button onClick={() => setActiveTab('referral')} style={activeTab === 'referral' ? styles.tabActive : styles.tab}>👥 Партнёры</button>
                <button onClick={() => setActiveTab('info')} style={activeTab === 'info' ? styles.tabActive : styles.tab}>ℹ️ О проекте</button>
            </div>

            {activeTab === 'tasks' && (
                <div>
                    {tasks.length === 0 ? (
                        <div style={styles.emptyState}>
                            <div style={styles.emptyIcon}>📭</div>
                            <h3 style={styles.emptyTitle}>Пока нет заданий</h3>
                            <p style={styles.emptyText}>Загляните позже — новые задания появляются каждый день!</p>
                        </div>
                    ) : (
                        tasks.map(task => (
                            <div key={task.id} style={styles.taskCard}>
                                <div style={styles.taskAvatar}>
                                    {channelAvatars[task.id] ? (
                                        <img src={channelAvatars[task.id]} alt="" style={styles.avatarImg} />
                                    ) : (
                                        <div style={styles.avatarPlaceholder}>📢</div>
                                    )}
                                </div>
                                <div style={styles.taskContent}>
                                    <h3 style={styles.taskTitle}>{task.title}</h3>
                                    <p style={styles.taskDesc}>{task.description}</p>
                                    <div style={styles.taskFooter}>
                                        <span style={styles.taskReward}>+{task.reward} ⭐</span>
                                        <button onClick={() => completeTask(task.id, task.target_url)} style={styles.taskButton}>Выполнить →</button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'referral' && (
                <div>
                    <div style={styles.glassCard}>
                        <div style={styles.infoIcon}>👥</div>
                        <h3 style={styles.glassTitle}>Партнёрская программа</h3>
                        <p style={styles.glassText}>Приглашайте друзей и получайте <strong>10%</strong> от их заработка!</p>
                        <div style={styles.referralLinkBox}><code style={styles.referralLink}>{getReferralLink()}</code></div>
                        <button onClick={copyReferralLink} style={styles.copyButton}>📋 Скопировать ссылку</button>
                    </div>
                    <div style={styles.glassCard}>
                        <h4 style={styles.statsTitle}>Ваша статистика</h4>
                        <div style={styles.statsRow}><span>👥 Приглашено друзей:</span><strong>0</strong></div>
                        <div style={styles.statsRow}><span>💰 Заработано комиссии:</span><strong>0 ⭐</strong></div>
                    </div>
                </div>
            )}

            {activeTab === 'info' && (
                <div>
                    <div style={styles.glassCard}>
                        <div style={styles.infoIcon}>⭐</div>
                        <h3 style={styles.glassTitle}>Что такое StarTask?</h3>
                        <p style={styles.glassText}>StarTask — платформа, где вы зарабатываете Telegram Stars, выполняя простые задания.</p>
                    </div>
                    <div style={styles.glassCard}>
                        <div style={styles.infoIcon}>💡</div>
                        <h3 style={styles.glassTitle}>Как заработать?</h3>
                        <ol style={styles.infoList}><li>Выберите задание</li><li>Перейдите по ссылке</li><li>Подтвердите выполнение</li><li>Получите Stars</li></ol>
                    </div>
                    <div style={styles.glassCard}>
                        <div style={styles.infoIcon}>🤝</div>
                        <h3 style={styles.glassTitle}>Партнёрская программа</h3>
                        <p style={styles.glassText}>Приглашайте друзей и получайте 10% от их заработка.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    container: { minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', padding: '20px', fontFamily: "'Inter', -apple-system, sans-serif" },
    loadingContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', color: 'white' },
    spinner: { width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.2)', borderTop: '4px solid #ffd700', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' },
    loadingText: { color: 'rgba(255,255,255,0.7)', fontSize: '14px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    logo: { margin: 0, fontSize: '28px', fontWeight: 'bold', color: 'white' },
    subtitle: { margin: '4px 0 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.6)' },
    balanceCard: { background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', borderRadius: '20px', padding: '10px 18px', textAlign: 'center' },
    balanceLabel: { fontSize: '11px', color: 'rgba(255,255,255,0.6)', display: 'block' },
    balanceValue: { fontSize: '20px', fontWeight: 'bold', color: '#ffd700' },
    tabs: { display: 'flex', gap: '10px', marginBottom: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '50px', padding: '6px' },
    tab: { flex: 1, padding: '12px', background: 'transparent', border: 'none', borderRadius: '40px', color: 'rgba(255,255,255,0.7)', fontSize: '14px', cursor: 'pointer' },
    tabActive: { flex: 1, padding: '12px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: 'none', borderRadius: '40px', color: '#ffd700', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
    taskCard: { background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', borderRadius: '24px', padding: '16px', marginBottom: '12px', display: 'flex', gap: '14px', border: '1px solid rgba(255,255,255,0.1)' },
    taskAvatar: { width: '52px', height: '52px', borderRadius: '26px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
    avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    avatarPlaceholder: { fontSize: '28px' },
    taskContent: { flex: 1 },
    taskTitle: { margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600', color: 'white' },
    taskDesc: { margin: '0 0 12px 0', fontSize: '13px', color: 'rgba(255,255,255,0.6)' },
    taskFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    taskReward: { fontWeight: 'bold', color: '#ffd700', background: 'rgba(0,0,0,0.3)', padding: '5px 14px', borderRadius: '20px', fontSize: '13px' },
    taskButton: { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '40px', padding: '8px 20px', color: 'white', cursor: 'pointer' },
    emptyState: { textAlign: 'center', padding: '50px 20px', background: 'rgba(255,255,255,0.05)', borderRadius: '24px' },
    emptyIcon: { fontSize: '48px', marginBottom: '16px' },
    emptyTitle: { color: 'white' },
    emptyText: { color: 'rgba(255,255,255,0.5)' },
    glassCard: { background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', borderRadius: '24px', padding: '24px', marginBottom: '16px' },
    glassTitle: { textAlign: 'center', margin: '0 0 12px 0', color: 'white' },
    glassText: { color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
    infoIcon: { fontSize: '48px', textAlign: 'center', marginBottom: '12px' },
    infoList: { color: 'rgba(255,255,255,0.7)', paddingLeft: '20px' },
    referralLinkBox: { background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '12px', margin: '16px 0' },
    referralLink: { fontSize: '12px', wordBreak: 'break-all', color: '#ffd700' },
    copyButton: { width: '100%', padding: '12px', background: 'rgba(255,255,255,0.15)', borderRadius: '40px', color: 'white', cursor: 'pointer' },
    statsTitle: { margin: '0 0 16px 0', color: 'white' },
    statsRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }
};

const styleSheet = document.createElement("style");
styleSheet.textContent = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
document.head.appendChild(styleSheet);

export default App;