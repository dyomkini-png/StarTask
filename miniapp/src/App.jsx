import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://star-task.up.railway.app';

function App() {
    const [user, setUser] = useState(null);
    const [balance, setBalance] = useState(0);
    const [activeTasks, setActiveTasks] = useState([]);
    const [completedTasks, setCompletedTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('active');
    const [mainTab, setMainTab] = useState('tasks');
    const [channelAvatars, setChannelAvatars] = useState({});
    const [showProfile, setShowProfile] = useState(false);

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
            const userPhotoUrl = window.Telegram.WebApp.initDataUnsafe?.user?.photo_url;
            
            const response = await axios.post(`${API_URL}/api/auth`, {
                telegramId: telegramUser.id,
                username: telegramUser.username
            });
            
            setUser({
                ...response.data.user,
                photo_url: userPhotoUrl,
                first_name: telegramUser.first_name,
                last_name: telegramUser.last_name
            });
            localStorage.setItem('token', response.data.token);
            
            fetchBalance(response.data.user.id);
            fetchTasks(response.data.user.id);
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

    const fetchTasks = async (userId) => {
        try {
            const response = await axios.get(`${API_URL}/api/quests`);
            const allTasks = response.data;
            
            const completionsResponse = await axios.get(`${API_URL}/api/user/${userId}/completions`);
            const completedIds = completionsResponse.data.map(c => c.quest_id);
            
            const active = allTasks.filter(task => !completedIds.includes(task.id));
            const completed = allTasks.filter(task => completedIds.includes(task.id));
            
            setActiveTasks(active);
            setCompletedTasks(completed);
            
            for (const task of [...active, ...completed]) {
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

    const completeTask = async (taskId, taskUrl, channelUsername) => {
        const tg = window.Telegram.WebApp;
        
        tg.openLink(taskUrl);
        
        tg.MainButton.show();
        tg.MainButton.setText('⏳ Проверка подписки...');
        tg.MainButton.disable();
        
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
                    fetchTasks(user.id);
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

    const openProfile = () => {
        window.Telegram.WebApp.showPopup({
            title: '👤 Профиль',
            message: `Имя: ${user?.first_name || '—'} ${user?.last_name || ''}\nUsername: @${user?.username || '—'}\nID: ${user?.telegram_id || '—'}\nБаланс: ${balance} ⭐`,
            buttons: [{ type: 'ok', text: 'Закрыть' }]
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
                {/* ШАПКА С АВАТАРОМ СПРАВА */}
<div style={styles.header}>
    <div style={styles.logoContainer} className="clickable" onClick={() => {
        window.Telegram.WebApp.openLink('https://t.me/startask_official');
    }}>
        <div style={styles.logoIcon}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
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
    <div style={styles.userInfo} className="clickable" onClick={openProfile}>
        <div style={styles.userText}>
            <span style={styles.userName}>{user?.first_name || user?.username || 'Пользователь'}</span>
            <span style={styles.userBalance}>⭐ {balance} Stars</span>
        </div>
        <div style={styles.avatar}>
            {user?.photo_url ? (
                <img src={user.photo_url} alt="avatar" style={styles.avatarImg} />
            ) : (
                <div style={styles.avatarPlaceholder}>
                    {user?.username ? user.username.charAt(0).toUpperCase() : '👤'}
                </div>
            )}
        </div>
    </div>
</div>
                <div style={styles.scrollArea}>
                    {mainTab === 'tasks' && (
                        <>
                            <div style={styles.subTabs}>
                                <button onClick={() => setActiveTab('active')} style={activeTab === 'active' ? styles.subTabActive : styles.subTab}>
                                    Активные ({activeTasks.length})
                                </button>
                                <button onClick={() => setActiveTab('completed')} style={activeTab === 'completed' ? styles.subTabActive : styles.subTab}>
                                    Выполненные ({completedTasks.length})
                                </button>
                            </div>

                            {activeTab === 'active' && (
                                <div style={styles.tasksContainer}>
                                    {activeTasks.length === 0 ? (
                                        <div style={styles.emptyState}>
                                            <div style={styles.emptyIcon}>🎉</div>
                                            <h3 style={styles.emptyTitle}>Все задания выполнены!</h3>
                                            <p style={styles.emptyText}>Новые задания появятся скоро</p>
                                        </div>
                                    ) : (
                                        activeTasks.map(task => (
                                            <div key={task.id} style={styles.taskCard}>
                                                <div style={styles.taskGlow}></div>
                                                <div style={styles.taskAvatar}>
                                                    {channelAvatars[task.id] ? (
                                                        <img src={channelAvatars[task.id]} alt="" style={styles.avatarImgSmall} />
                                                    ) : (
                                                        <div style={{
                                                            ...styles.avatarPlaceholderSmall,
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

                            {activeTab === 'completed' && (
                                <div style={styles.tasksContainer}>
                                    {completedTasks.length === 0 ? (
                                        <div style={styles.emptyState}>
                                            <div style={styles.emptyIcon}>📭</div>
                                            <h3 style={styles.emptyTitle}>Нет выполненных заданий</h3>
                                            <p style={styles.emptyText}>Выполните задания, чтобы они появились здесь</p>
                                        </div>
                                    ) : (
                                        completedTasks.map(task => (
                                            <div key={task.id} style={{...styles.taskCard, opacity: 0.7}}>
                                                <div style={styles.taskGlow}></div>
                                                <div style={styles.taskAvatar}>
                                                    {channelAvatars[task.id] ? (
                                                        <img src={channelAvatars[task.id]} alt="" style={styles.avatarImgSmall} />
                                                    ) : (
                                                        <div style={{
                                                            ...styles.avatarPlaceholderSmall,
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
                                                        <span style={styles.completedReward}>✅ +{task.reward} ⭐</span>
                                                        <span style={styles.completedBadge}>Выполнено</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {mainTab === 'referral' && (
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

                    {mainTab === 'info' && (
                        <div>
                            <div style={styles.glassCard}>
                                <div style={styles.infoIcon}>⭐</div>
                                <h3 style={styles.glassTitle}>Что такое StarTask?</h3>
                                <p style={styles.glassText}>StarTask — премиальная платформа для заработка Telegram Stars на выполнении простых заданий.</p>
                            </div>
                            <div style={styles.glassCard}>
                                <div style={styles.infoIcon}>💡</div>
                                <h3 style={styles.glassTitle}>Как заработать?</h3>
                                <ol style={styles.infoList}>
                                    <li>Выберите задание из списка</li>
                                    <li>Перейдите по ссылке и выполните действие</li>
                                    <li>Нажмите "Выполнить"</li>
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

                <div style={styles.bottomNav}>
                    <button onClick={() => setMainTab('tasks')} style={mainTab === 'tasks' ? styles.navItemActive : styles.navItem}>
                        <span style={styles.navIcon}>📋</span>
                        <span style={styles.navLabel}>Задания</span>
                    </button>
                    <button onClick={() => setMainTab('referral')} style={mainTab === 'referral' ? styles.navItemActive : styles.navItem}>
                        <span style={styles.navIcon}>👥</span>
                        <span style={styles.navLabel}>Партнёры</span>
                    </button>
                    <button onClick={() => setMainTab('info')} style={mainTab === 'info' ? styles.navItemActive : styles.navItem}>
                        <span style={styles.navIcon}>ℹ️</span>
                        <span style={styles.navLabel}>О проекте</span>
                    </button>
                </div>
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
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        boxSizing: 'border-box'
    },
    scrollArea: {
        flex: 1,
        overflowY: 'auto',
        paddingBottom: '20px',
        marginBottom: '70px'
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
        marginBottom: '24px',
        paddingTop: '10px',
        flexShrink: 0
    },
        logoContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: 'pointer'
    },
    logoIcon: {
        width: '48px',
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,215,0,0.05) 100%)',
        borderRadius: '18px',
        border: '1px solid rgba(255,215,0,0.25)',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
    },
    logo: {
        margin: 0,
        fontSize: '28px',
        fontWeight: '800',
        background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        letterSpacing: '-0.8px',
        fontFamily: "'Poppins', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        textShadow: '0 2px 10px rgba(255,215,0,0.2)'
    },
    userInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: 'pointer'
    },
    avatar: {
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'rgba(255,215,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        border: '2px solid rgba(255,215,0,0.3)'
    },
    avatarImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
    },
    avatarPlaceholder: {
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        fontWeight: '600',
        color: '#ffd700',
        background: 'rgba(255,215,0,0.05)'
    },
    avatarImgSmall: {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
    },
    avatarPlaceholderSmall: {
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
    userText: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end'
    },
    userName: {
        fontSize: '15px',
        fontWeight: '600',
        color: 'white'
    },
    userBalance: {
        fontSize: '12px',
        color: '#ffd700'
    },
    subTabs: {
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '40px',
        padding: '4px'
    },
    subTab: {
        flex: 1,
        padding: '10px',
        background: 'transparent',
        border: 'none',
        borderRadius: '40px',
        color: 'rgba(255,255,255,0.5)',
        fontSize: '13px',
        cursor: 'pointer'
    },
    subTabActive: {
        flex: 1,
        padding: '10px',
        background: 'rgba(255,215,0,0.15)',
        border: 'none',
        borderRadius: '40px',
        color: '#ffd700',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer'
    },
    tasksContainer: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        paddingBottom: '10px'
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
    completedReward: {
        fontWeight: 'bold',
        color: '#4ECDC4',
        background: 'rgba(78,205,196,0.1)',
        padding: '5px 12px',
        borderRadius: '20px',
        fontSize: '12px'
    },
    completedBadge: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: '12px'
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
    },
    bottomNav: {
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        gap: '4px',
        background: 'rgba(20,20,40,0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '60px',
        border: '1px solid rgba(255,215,0,0.15)',
        padding: '6px',
        zIndex: 10
    },
    navItem: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        background: 'transparent',
        border: 'none',
        borderRadius: '50px',
        cursor: 'pointer',
        padding: '10px 12px',
        transition: 'all 0.2s ease',
        opacity: 0.5
    },
    navItemActive: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        background: 'linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(255,215,0,0.08) 100%)',
        border: 'none',
        borderRadius: '50px',
        cursor: 'pointer',
        padding: '10px 12px',
        transition: 'all 0.2s ease',
        opacity: 1
    },
    navIcon: {
        fontSize: '20px'
    },
    navLabel: {
        fontSize: '11px',
        fontWeight: '500',
        color: 'white'
    }
};

const styleSheet = document.createElement("style");
styleSheet.textContent = `
    button {
        -webkit-tap-highlight-color: transparent;
        outline: none;
    }
    .clickable {
        -webkit-tap-highlight-color: transparent;
        cursor: pointer;
        transition: opacity 0.1s ease;
    }
    .clickable:active {
        opacity: 0.6;
    }
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