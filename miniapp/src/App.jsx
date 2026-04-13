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
        tg.setHeaderColor('#0a0a1a');
        tg.setBackgroundColor('#0a0a1a');

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
            const uniqueTasks = response.data.filter((task, index, self) => 
                index === self.findIndex(t => t.target_url === task.target_url)
            );
            setTasks(uniqueTasks);
            
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

    // НОВАЯ ФУНКЦИЯ: АВТОМАТИЧЕСКАЯ ПРОВЕРКА ПОДПИСКИ
const completeTask = async (taskId, taskUrl, channelUsername) => {
    const tg = window.Telegram.WebApp;
    
    // Открываем канал
    tg.openLink(taskUrl);
    
    // Показываем небольшой индикатор загрузки (не всплывающее окно)
    tg.MainButton.show();
    tg.MainButton.setText('⏳ Проверка подписки...');
    tg.MainButton.disable();
    
    // Ждём 5 секунд, затем проверяем
    setTimeout(async () => {
        try {
            const response = await axios.post(`${API_URL}/api/check-subscription`, {
                userId: user.id,
                channelUsername: channelUsername,
                questId: taskId
            });
            
            tg.MainButton.hide();
            
            if (response.data.success) {
                tg.showPopup({
                    title: '🎉 Задание выполнено!',
                    message: response.data.message,
                    buttons: [{ type: 'ok' }]
                });
                fetchBalance(user.id);
            } else {
                tg.showPopup({
                    title: '❌ Подписка не найдена',
                    message: 'Вы не подписались на канал. Попробуйте ещё раз.',
                    buttons: [{ type: 'ok' }]
                });
            }
        } catch (error) {
            tg.MainButton.hide();
            console.error('Check subscription error:', error);
            tg.showPopup({
                title: '⚠️ Ошибка',
                message: error.response?.data?.error || 'Не удалось проверить подписку',
                buttons: [{ type: 'ok' }]
            });
        }
    }, 5000);
};

    const getChannelInitial = (taskTitle, targetUrl) => {
        if (taskTitle.includes('StarTask')) return '⭐';
        if (taskTitle.includes('канал')) return '📢';
        const match = targetUrl.match(/t\.me\/([^\/]+)/);
        if (match) return match[1].charAt(0).toUpperCase();
        return taskTitle.charAt(0).toUpperCase();
    };

    const getChannelColor = (taskTitle) => {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#FF9F4A', '#6B5B95'];
        let hash = 0;
        for (let i = 0; i < taskTitle.length; i++) {
            hash = ((hash << 5) - hash) + taskTitle.charCodeAt(i);
            hash |= 0;
        }
        return colors[Math.abs(hash) % colors.length];
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
            <div style={styles.backgroundGradient}></div>
            <div style={styles.content}>
                <div style={styles.header}>
                    <div style={styles.logoContainer}>
                        <div style={styles.logoIcon}>
                            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M16 2L19.5 10.5L28 12L21.5 18L23.5 26.5L16 22L8.5 26.5L10.5 18L4 12L12.5 10.5L16 2Z" fill="url(#grad)" stroke="#FFD700" strokeWidth="1.2"/>
                                <defs>
                                    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#FFD700"/>
                                        <stop offset="100%" stopColor="#FFA500"/>
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <h1 style={styles.logo}>StarTask</h1>
                    </div>
                    <div style={styles.balanceCard}>
                        <div style={styles.balanceGlow}></div>
                        <span style={styles.balanceLabel}>Баланс</span>
                        <span style={styles.balanceValue}>{balance} ★</span>
                    </div>
                </div>

                <div style={styles.tabs}>
                    <button onClick={() => setActiveTab('tasks')} style={activeTab === 'tasks' ? styles.tabActive : styles.tab}>
                        <span>📋</span> Задания
                    </button>
                    <button onClick={() => setActiveTab('referral')} style={activeTab === 'referral' ? styles.tabActive : styles.tab}>
                        <span>👥</span> Партнёры
                    </button>
                    <button onClick={() => setActiveTab('info')} style={activeTab === 'info' ? styles.tabActive : styles.tab}>
                        <span>ℹ️</span> О проекте
                    </button>
                </div>

                {activeTab === 'tasks' && (
                    <div style={styles.tasksContainer}>
                        {tasks.length === 0 ? (
                            <div style={styles.emptyState}>
                                <div style={styles.emptyIcon}>📭</div>
                                <h3 style={styles.emptyTitle}>Пока нет заданий</h3>
                                <p style={styles.emptyText}>Новые задания появляются каждый день!</p>
                            </div>
                        ) : (
                            tasks.map(task => (
                                <div key={task.id} style={styles.taskCard}>
                                    <div style={styles.taskGlow}></div>
                                    <div style={styles.taskAvatar}>
                                        {channelAvatars[task.id] ? (
                                            <img src={channelAvatars[task.id]} alt="" style={styles.avatarImg} />
                                        ) : (
                                            <div style={{
                                                ...styles.avatarPlaceholder,
                                                background: getChannelColor(task.title)
                                            }}>
                                                {getChannelInitial(task.title, task.target_url)}
                                            </div>
                                        )}
                                    </div>
                                    <div style={styles.taskContent}>
                                        <h3 style={styles.taskTitle}>{task.title}</h3>
                                        <p style={styles.taskDesc}>{task.description}</p>
                                        <div style={styles.taskFooter}>
                                            <span style={styles.taskReward}>+{task.reward} ⭐</span>
                                            <button 
                                                onClick={() => completeTask(task.id, task.target_url, task.target_url.split('t.me/')[1])} 
                                                style={styles.taskButton}
                                            >
                                                Выполнить →
                                            </button>
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
                            <div style={styles.glassCardGlow}></div>
                            <div style={styles.infoIcon}>👥</div>
                            <h3 style={styles.glassTitle}>Партнёрская программа</h3>
                            <p style={styles.glassText}>Приглашайте друзей и получайте <strong style={{color: '#ffd700'}}>10%</strong> от их заработка!</p>
                            <div style={styles.referralLinkBox}>
                                <code style={styles.referralLink}>{getReferralLink()}</code>
                            </div>
                            <button onClick={copyReferralLink} style={styles.copyButton}>
                                📋 Скопировать ссылку
                            </button>
                        </div>

                        <div style={styles.glassCard}>
                            <h4 style={styles.statsTitle}>Ваша статистика</h4>
                            <div style={styles.statsRow}>
                                <span>👥 Приглашено друзей:</span>
                                <strong>0</strong>
                            </div>
                            <div style={styles.statsRow}>
                                <span>💰 Заработано комиссии:</span>
                                <strong>0 ⭐</strong>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'info' && (
                    <div>
                        <div style={styles.glassCard}>
                            <div style={styles.infoIcon}>⭐</div>
                            <h3 style={styles.glassTitle}>Что такое StarTask?</h3>
                            <p style={styles.glassText}>StarTask — платформа для заработка Telegram Stars на выполнении простых заданий.</p>
                        </div>
                        <div style={styles.glassCard}>
                            <div style={styles.infoIcon}>💡</div>
                            <h3 style={styles.glassTitle}>Как заработать?</h3>
                            <ol style={styles.infoList}>
                                <li>Выберите задание из списка</li>
                                <li>Перейдите по ссылке и выполните действие</li>
                                <li>Нажмите "Проверить"</li>
                                <li>Получите Stars мгновенно!</li>
                            </ol>
                        </div>
                        <div style={styles.glassCard}>
                            <div style={styles.infoIcon}>🤝</div>
                            <h3 style={styles.glassTitle}>Партнёрская программа</h3>
                            <p style={styles.glassText}>Приглашайте друзей и получайте 10% от их заработка.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    container: {
        minHeight: '100vh',
        position: 'relative',
        overflowX: 'hidden',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    },
    backgroundGradient: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(ellipse at 20% 0%, #1a1a3e 0%, #0a0a1a 100%)',
        zIndex: -2
    },
    content: {
        padding: '20px',
        position: 'relative',
        zIndex: 1
    },
    loadingContainer: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#0a0a1a',
        color: 'white'
    },
    spinner: {
        width: '48px',
        height: '48px',
        border: '3px solid rgba(255,215,0,0.1)',
        borderTop: '3px solid #ffd700',
        borderRadius: '50%',
        animation: 'spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite',
        marginBottom: '20px'
    },
    loadingText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: '14px',
        letterSpacing: '1px'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px',
        paddingTop: '10px'
    },
    logoContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
    },
    logoIcon: {
        width: '44px',
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,215,0,0.08)',
        borderRadius: '16px',
        border: '1px solid rgba(255,215,0,0.15)'
    },
    logo: {
        margin: 0,
        fontSize: '26px',
        fontWeight: '700',
        background: 'linear-gradient(135deg, #FFFFFF 0%, #E8E8E8 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        letterSpacing: '-0.5px'
    },
    balanceCard: {
        position: 'relative',
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)',
        borderRadius: '28px',
        padding: '10px 18px',
        textAlign: 'center',
        border: '1px solid rgba(255,215,0,0.15)',
        overflow: 'hidden',
        minWidth: '90px'
    },
    balanceGlow: {
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle, rgba(255,215,0,0.1) 0%, transparent 70%)',
        animation: 'glow 3s ease-in-out infinite'
    },
    balanceLabel: {
        fontSize: '10px',
        color: 'rgba(255,215,0,0.7)',
        display: 'block',
        letterSpacing: '1px',
        textTransform: 'uppercase'
    },
    balanceValue: {
        fontSize: '22px',
        fontWeight: 'bold',
        color: '#ffd700',
        textShadow: '0 0 10px rgba(255,215,0,0.3)'
    },
    tabs: {
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '60px',
        padding: '6px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.05)'
    },
    tab: {
        flex: 1,
        padding: '12px 8px',
        background: 'transparent',
        border: 'none',
        borderRadius: '50px',
        color: 'rgba(255,255,255,0.5)',
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px'
    },
    tabActive: {
        flex: 1,
        padding: '12px 8px',
        background: 'linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(255,215,0,0.05) 100%)',
        border: 'none',
        borderRadius: '50px',
        color: '#ffd700',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        backdropFilter: 'blur(10px)'
    },
    tasksContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
    },
    taskCard: {
        position: 'relative',
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)',
        borderRadius: '28px',
        padding: '16px',
        display: 'flex',
        gap: '14px',
        border: '1px solid rgba(255,255,255,0.05)',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        overflow: 'hidden'
    },
    taskGlow: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 100% 0%, rgba(255,215,0,0.05) 0%, transparent 70%)',
        pointerEvents: 'none'
    },
    taskAvatar: {
        width: '52px',
        height: '52px',
        borderRadius: '26px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
    },
    avatarImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
    },
    avatarPlaceholder: {
        width: '52px',
        height: '52px',
        borderRadius: '26px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        fontWeight: 'bold',
        color: 'white'
    },
    taskContent: {
        flex: 1
    },
    taskTitle: {
        margin: '0 0 6px 0',
        fontSize: '16px',
        fontWeight: '600',
        color: 'white',
        letterSpacing: '-0.3px'
    },
    taskDesc: {
        margin: '0 0 12px 0',
        fontSize: '12px',
        color: 'rgba(255,255,255,0.5)',
        lineHeight: 1.4
    },
    taskFooter: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    taskReward: {
        fontWeight: 'bold',
        color: '#ffd700',
        background: 'rgba(255,215,0,0.1)',
        padding: '5px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        border: '1px solid rgba(255,215,0,0.2)'
    },
    taskButton: {
        background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '40px',
        padding: '7px 18px',
        color: 'white',
        fontWeight: '500',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'all 0.2s ease'
    },
    emptyState: {
        textAlign: 'center',
        padding: '50px 20px',
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(10px)',
        borderRadius: '28px',
        border: '1px solid rgba(255,255,255,0.05)'
    },
    emptyIcon: {
        fontSize: '48px',
        marginBottom: '16px',
        opacity: 0.5
    },
    emptyTitle: {
        color: 'white',
        marginBottom: '8px',
        fontSize: '18px'
    },
    emptyText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: '14px'
    },
    glassCard: {
        position: 'relative',
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)',
        borderRadius: '28px',
        padding: '24px',
        marginBottom: '16px',
        border: '1px solid rgba(255,255,255,0.05)',
        overflow: 'hidden'
    },
    glassCardGlow: {
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle, rgba(255,215,0,0.05) 0%, transparent 70%)',
        pointerEvents: 'none'
    },
    glassTitle: {
        textAlign: 'center',
        margin: '0 0 12px 0',
        color: 'white',
        fontSize: '18px',
        fontWeight: '600'
    },
    glassText: {
        color: 'rgba(255,255,255,0.6)',
        lineHeight: 1.5,
        textAlign: 'center',
        margin: 0,
        fontSize: '14px'
    },
    infoIcon: {
        fontSize: '48px',
        textAlign: 'center',
        marginBottom: '16px'
    },
    infoList: {
        color: 'rgba(255,255,255,0.6)',
        lineHeight: 1.8,
        paddingLeft: '20px',
        margin: 0
    },
    referralLinkBox: {
        background: 'rgba(0,0,0,0.4)',
        borderRadius: '16px',
        padding: '12px',
        margin: '16px 0',
        overflowX: 'auto',
        border: '1px solid rgba(255,215,0,0.1)'
    },
    referralLink: {
        fontSize: '11px',
        wordBreak: 'break-all',
        color: '#ffd700'
    },
    copyButton: {
        width: '100%',
        padding: '12px',
        background: 'linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,215,0,0.05) 100%)',
        border: '1px solid rgba(255,215,0,0.2)',
        borderRadius: '40px',
        color: '#ffd700',
        fontWeight: '600',
        cursor: 'pointer',
        fontSize: '14px',
        transition: 'all 0.2s ease'
    },
    statsTitle: {
        margin: '0 0 16px 0',
        color: 'white',
        fontSize: '18px',
        fontWeight: '600'
    },
    statsRow: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        color: 'rgba(255,255,255,0.6)',
        fontSize: '14px'
    }
};

const styleSheet = document.createElement("style");
styleSheet.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    @keyframes glow {
        0% { transform: translate(-50%, -50%) rotate(0deg); opacity: 0.5; }
        50% { opacity: 1; }
        100% { transform: translate(-50%, -50%) rotate(360deg); opacity: 0.5; }
    }
    button:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0,0,0,0.3);
    }
    button:active {
        transform: translateY(0px);
    }
`;
document.head.appendChild(styleSheet);

export default App;