import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://star-task.up.railway.app';

function App() {
    const [user, setUser] = useState(null);
    const [balance, setBalance] = useState(0);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('tasks');

    // Инициализация Telegram WebApp
    useEffect(() => {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        tg.MainButton.hide();

        if (tg.initDataUnsafe?.user) {
            authenticate(tg.initDataUnsafe.user);
        }
    }, []);

    // Авторизация
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

    // Получение баланса
    const fetchBalance = async (userId) => {
        try {
            const response = await axios.get(`${API_URL}/api/user/${userId}/balance`);
            setBalance(response.data.balance);
        } catch (error) {
            console.error('Balance error:', error);
        }
    };

    // Получение заданий
    const fetchTasks = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/quests`);
            setTasks(response.data);
        } catch (error) {
            console.error('Tasks error:', error);
        }
    };

    // Выполнение задания
    const completeTask = async (taskId, taskUrl) => {
        const tg = window.Telegram.WebApp;
        
        // Открываем целевой канал/сайт
        tg.openLink(taskUrl);
        
        // Показываем подтверждение
        tg.showConfirm('Выполнили задание? Нажмите "Да", чтобы получить Stars', async (confirmed) => {
            if (confirmed) {
                try {
                    await axios.post(`${API_URL}/api/quests/${taskId}/complete`, {
                        userId: user.id,
                        screenshotUrl: 'completed'
                    });
                    
                    tg.showPopup({
                        title: '✅ Задание выполнено!',
                        message: 'Stars будут начислены после проверки',
                        buttons: [{ type: 'ok' }]
                    });
                    
                    fetchBalance(user.id);
                } catch (error) {
                    tg.showPopup({
                        title: 'Ошибка',
                        message: error.response?.data?.error || 'Что-то пошло не так',
                        buttons: [{ type: 'ok' }]
                    });
                }
            }
        });
    };

    // Генерация реферальной ссылки
    const getReferralLink = () => {
        return `https://t.me/StarTaskBot?start=ref_${user?.id}`;
    };

    const copyReferralLink = () => {
        navigator.clipboard.writeText(getReferralLink());
        window.Telegram.WebApp.showPopup({
            title: 'Ссылка скопирована!',
            message: 'Поделитесь с друзьями и получайте 10% от их заработка',
            buttons: [{ type: 'ok' }]
        });
    };

    if (loading) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p>Загрузка...</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* Шапка */}
            <div style={styles.header}>
                <h1 style={styles.logo}>⭐ StarTask</h1>
                <div style={styles.balanceCard}>
                    <span style={styles.balanceLabel}>Мой баланс</span>
                    <span style={styles.balanceValue}>{balance} ⭐</span>
                </div>
            </div>

            {/* Вкладки */}
            <div style={styles.tabs}>
                <button
                    onClick={() => setActiveTab('tasks')}
                    style={activeTab === 'tasks' ? styles.tabActive : styles.tab}
                >
                    📋 Задания
                </button>
                <button
                    onClick={() => setActiveTab('referral')}
                    style={activeTab === 'referral' ? styles.tabActive : styles.tab}
                >
                    👥 Партнёры
                </button>
                <button
                    onClick={() => setActiveTab('info')}
                    style={activeTab === 'info' ? styles.tabActive : styles.tab}
                >
                    ℹ️ О проекте
                </button>
            </div>

            {/* Задания */}
            {activeTab === 'tasks' && (
                <div>
                    {tasks.length === 0 ? (
                        <div style={styles.emptyState}>
                            <div style={styles.emptyIcon}>📭</div>
                            <h3>Пока нет заданий</h3>
                            <p>Загляните позже — новые задания появляются каждый день!</p>
                        </div>
                    ) : (
                        tasks.map(task => (
                            <div key={task.id} style={styles.taskCard}>
                                <div style={styles.taskIcon}>🎯</div>
                                <div style={styles.taskContent}>
                                    <h3 style={styles.taskTitle}>{task.title}</h3>
                                    <p style={styles.taskDesc}>{task.description}</p>
                                    <div style={styles.taskFooter}>
                                        <span style={styles.taskReward}>+{task.reward} ⭐</span>
                                        <button
                                            onClick={() => completeTask(task.id, task.target_url)}
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

            {/* Партнёрская программа */}
            {activeTab === 'referral' && (
                <div>
                    <div style={styles.infoCard}>
                        <div style={styles.infoIcon}>👥</div>
                        <h3 style={styles.infoTitle}>Партнёрская программа</h3>
                        <p style={styles.infoText}>
                            Приглашайте друзей и получайте <strong>10%</strong> от их заработка!
                        </p>
                        <div style={styles.referralLinkBox}>
                            <code style={styles.referralLink}>{getReferralLink()}</code>
                        </div>
                        <button onClick={copyReferralLink} style={styles.copyButton}>
                            📋 Скопировать ссылку
                        </button>
                    </div>

                    <div style={styles.statsCard}>
                        <h4>Ваша статистика</h4>
                        <div style={styles.statsRow}>
                            <span>Приглашено друзей:</span>
                            <strong>0</strong>
                        </div>
                        <div style={styles.statsRow}>
                            <span>Заработано комиссии:</span>
                            <strong>0 ⭐</strong>
                        </div>
                    </div>
                </div>
            )}

            {/* О проекте */}
            {activeTab === 'info' && (
                <div>
                    <div style={styles.infoCard}>
                        <div style={styles.infoIcon}>⭐</div>
                        <h3 style={styles.infoTitle}>Что такое StarTask?</h3>
                        <p style={styles.infoText}>
                            StarTask — платформа, где вы зарабатываете Telegram Stars, 
                            выполняя простые задания: подписки, просмотры, установки приложений.
                        </p>
                    </div>

                    <div style={styles.infoCard}>
                        <div style={styles.infoIcon}>💡</div>
                        <h3 style={styles.infoTitle}>Как заработать?</h3>
                        <ol style={styles.infoList}>
                            <li>Выберите задание из списка</li>
                            <li>Перейдите по ссылке и выполните действие</li>
                            <li>Получите Stars на баланс</li>
                            <li>Выведите Stars в TON через Fragment</li>
                        </ol>
                    </div>

                    <div style={styles.infoCard}>
                        <div style={styles.infoIcon}>🤝</div>
                        <h3 style={styles.infoTitle}>Партнёрская программа</h3>
                        <p style={styles.infoText}>
                            Приглашайте друзей и получайте 10% от их заработка. 
                            Чем больше друзей — тем больше ваш доход!
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ========== СТИЛИ ==========

const styles = {
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    },
    loadingContainer: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
    },
    spinner: {
        width: '40px',
        height: '40px',
        border: '4px solid rgba(255,255,255,0.3)',
        borderTop: '4px solid white',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '16px'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
    },
    logo: {
        margin: 0,
        fontSize: '24px',
        color: 'white',
        fontWeight: 'bold'
    },
    balanceCard: {
        background: 'rgba(255,255,255,0.2)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '8px 16px',
        textAlign: 'center'
    },
    balanceLabel: {
        fontSize: '12px',
        color: 'rgba(255,255,255,0.7)',
        display: 'block'
    },
    balanceValue: {
        fontSize: '20px',
        fontWeight: 'bold',
        color: '#ffd700'
    },
    tabs: {
        display: 'flex',
        gap: '12px',
        marginBottom: '24px'
    },
    tab: {
        flex: 1,
        padding: '12px',
        background: 'rgba(255,255,255,0.15)',
        border: 'none',
        borderRadius: '40px',
        color: 'white',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer'
    },
    tabActive: {
        flex: 1,
        padding: '12px',
        background: '#ffd700',
        border: 'none',
        borderRadius: '40px',
        color: '#1a1a2e',
        fontSize: '14px',
        fontWeight: 'bold',
        cursor: 'pointer'
    },
    taskCard: {
        background: 'white',
        borderRadius: '20px',
        padding: '16px',
        marginBottom: '12px',
        display: 'flex',
        gap: '12px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
    },
    taskIcon: {
        fontSize: '40px'
    },
    taskContent: {
        flex: 1
    },
    taskTitle: {
        margin: '0 0 4px 0',
        fontSize: '16px',
        color: '#1a1a2e'
    },
    taskDesc: {
        margin: '0 0 12px 0',
        fontSize: '13px',
        color: '#666'
    },
    taskFooter: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    taskReward: {
        fontWeight: 'bold',
        color: '#ffd700',
        background: '#1a1a2e',
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '14px'
    },
    taskButton: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        border: 'none',
        borderRadius: '40px',
        padding: '8px 20px',
        color: 'white',
        fontWeight: 'bold',
        cursor: 'pointer'
    },
    emptyState: {
        textAlign: 'center',
        padding: '40px 20px',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '20px',
        color: 'white'
    },
    emptyIcon: {
        fontSize: '48px',
        marginBottom: '16px'
    },
    infoCard: {
        background: 'rgba(255,255,255,0.95)',
        borderRadius: '20px',
        padding: '20px',
        marginBottom: '16px'
    },
    infoIcon: {
        fontSize: '40px',
        textAlign: 'center',
        marginBottom: '12px'
    },
    infoTitle: {
        textAlign: 'center',
        margin: '0 0 12px 0',
        color: '#1a1a2e'
    },
    infoText: {
        color: '#555',
        lineHeight: 1.5,
        margin: 0
    },
    infoList: {
        color: '#555',
        lineHeight: 1.8,
        paddingLeft: '20px',
        margin: 0
    },
    referralLinkBox: {
        background: '#f0f0f0',
        borderRadius: '12px',
        padding: '12px',
        margin: '16px 0',
        overflowX: 'auto'
    },
    referralLink: {
        fontSize: '12px',
        wordBreak: 'break-all',
        color: '#667eea'
    },
    copyButton: {
        width: '100%',
        padding: '12px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        border: 'none',
        borderRadius: '40px',
        color: 'white',
        fontWeight: 'bold',
        cursor: 'pointer'
    },
    statsCard: {
        background: 'rgba(255,255,255,0.95)',
        borderRadius: '20px',
        padding: '20px'
    },
    statsRow: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px solid #eee'
    }
};

// Добавляем анимацию для спиннера
const styleSheet = document.createElement("style");
styleSheet.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(styleSheet);

export default App;" " 
