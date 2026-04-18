import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://star-task.up.railway.app';

const AdminPanel = ({ onClose, userId }) => {
    const [pendingQuests, setPendingQuests] = useState([]);
    const [activeQuests, setActiveQuests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adminTab, setAdminTab] = useState('pending');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [currentQuestId, setCurrentQuestId] = useState(null);

    useEffect(() => {
        fetchPendingQuests();
        fetchActiveQuests();
    }, []);
    
    const fetchPendingQuests = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/admin/pending-quests`);
            setPendingQuests(response.data);
        } catch (error) {
            console.error('Error fetching pending quests:', error);
        }
    };
    
    const fetchActiveQuests = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/admin/active-quests?adminId=${userId}`);
            setActiveQuests(response.data);
        } catch (error) {
            console.error('Error fetching active quests:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const approveQuest = async (questId) => {
        try {
            const response = await axios.post(`${API_URL}/api/admin/approve-quest/${questId}`, {
                adminId: Number(userId)
            });
            if (response.data.success) {
                fetchPendingQuests();
                fetchActiveQuests();
                window.Telegram.WebApp.showPopup({
                    title: '✅ Одобрено',
                    message: response.data.message || 'Задание опубликовано',
                    buttons: [{ type: 'ok' }]
                });
            }
        } catch (error) {
            console.error('Error approving quest:', error);
            window.Telegram.WebApp.showPopup({
                title: 'Ошибка',
                message: error.response?.data?.error || 'Не удалось одобрить задание',
                buttons: [{ type: 'ok' }]
            });
        }
    };
    
    const rejectQuest = (questId) => {
    setCurrentQuestId(questId);
    setRejectReason('');
    setShowRejectModal(true);
};

const confirmReject = async () => {
    if (!rejectReason.trim()) {
        window.Telegram.WebApp.showPopup({
            title: 'Ошибка',
            message: 'Укажите причину отклонения',
            buttons: [{ type: 'ok' }]
        });
        return;
    }
    
    try {
        const response = await axios.post(`${API_URL}/api/admin/reject-quest/${currentQuestId}`, {
            adminId: Number(userId),
            reason: rejectReason
        });
        if (response.data.success) {
            fetchPendingQuests();
            setShowRejectModal(false);
            window.Telegram.WebApp.showPopup({
                title: '❌ Отклонено',
                message: 'Задание отклонено',
                buttons: [{ type: 'ok' }]
            });
        }
    } catch (error) {
        console.error('Error rejecting quest:', error);
        window.Telegram.WebApp.showPopup({
            title: 'Ошибка',
            message: error.response?.data?.error || 'Не удалось отклонить задание',
            buttons: [{ type: 'ok' }]
        });
    }
};    
    const deactivateQuest = async (questId) => {
        window.Telegram.WebApp.showPopup({
            title: '⚠️ Снять с публикации',
            message: 'Задание будет скрыто из ленты пользователей. Продолжить?',
            buttons: [{ type: 'ok', text: 'Да, снять' }, { type: 'cancel', text: 'Отмена' }]
        }, async (buttonId) => {
            if (buttonId === 'ok') {
                try {
                    const response = await axios.post(`${API_URL}/api/admin/deactivate-quest/${questId}`, {
                        adminId: Number(userId)
                    });
                    if (response.data.success) {
                        await fetchActiveQuests();
                        window.Telegram.WebApp.showPopup({
                            title: '✅ Снято',
                            message: 'Задание скрыто из ленты пользователей',
                            buttons: [{ type: 'ok' }]
                        });
                    }
                } catch (error) {
                    console.error('Error deactivating quest:', error);
                    window.Telegram.WebApp.showPopup({
                        title: 'Ошибка',
                        message: error.response?.data?.error || 'Не удалось снять задание',
                        buttons: [{ type: 'ok' }]
                    });
                }
            }
        });
    };
    
    if (loading) {
        return (
            <div style={styles.modalOverlay}>
                <div style={styles.adminPanel}>
                    <p style={{ color: 'white', textAlign: 'center' }}>Загрузка...</p>
                    {showRejectModal && (
    <div style={styles.modalOverlay}>
        <div style={styles.rejectModal}>
            <div style={styles.formHeader}>
                <h3 style={{ color: 'white' }}>❌ Отклонить задание</h3>
                <button onClick={() => setShowRejectModal(false)} style={styles.closeBtn}>✕</button>
            </div>
            <textarea
                placeholder="Укажите причину отклонения..."
                style={styles.rejectTextarea}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
            />
            <button onClick={confirmReject} style={styles.submitBtn}>
                Отправить
            </button>
                </div>
            </div>
        );
    }
    
    return (
        <div style={styles.modalOverlay}>
            <div style={styles.adminPanel}>
                <div style={styles.formHeader}>
                    <h3 style={{ color: 'white' }}>🛡️ Админ-панель</h3>
                    <button onClick={onClose} style={styles.closeBtn}>✕</button>
                </div>
                
                <div style={styles.adminTabs}>
                    <button onClick={() => setAdminTab('pending')} style={adminTab === 'pending' ? styles.adminTabActive : styles.adminTab}>
                        ⏳ На модерации ({pendingQuests.length})
                    </button>
                    <button onClick={() => setAdminTab('active')} style={adminTab === 'active' ? styles.adminTabActive : styles.adminTab}>
                        ✅ Активные ({activeQuests.length})
                    </button>
                </div>
                
                {adminTab === 'pending' && (
                    <>
                        {pendingQuests.length === 0 ? (
                            <p style={{ color: 'white', textAlign: 'center' }}>Нет заданий на модерацию</p>
                        ) : (
                            pendingQuests.map(quest => (
                                <div key={quest.id} style={styles.adminQuestCard}>
                                    <div>
                                        <strong style={{ color: '#00D4FF' }}>{quest.title}</strong>
                                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: '4px 0' }}>
                                            {quest.description}
                                        </p>
                                        <p style={{ fontSize: '11px', color: '#FF2D95' }}>
                                            +{quest.reward} ⭐ | от @{quest.creator_name}
                                        </p>
                                        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                                            Ссылка: {quest.target_url}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                        <button onClick={() => approveQuest(quest.id)} style={styles.approveBtn}>
                                            ✅ Одобрить
                                        </button>
                                        <button onClick={() => rejectQuest(quest.id)} style={styles.rejectBtn}>
                                            ❌ Отклонить
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </>
                )}
                
                {adminTab === 'active' && (
                    <>
                        {activeQuests.length === 0 ? (
                            <p style={{ color: 'white', textAlign: 'center' }}>Нет активных заданий</p>
                        ) : (
                            activeQuests.map(quest => (
                                <div key={quest.id} style={styles.adminQuestCard}>
                                    <div>
                                        <strong style={{ color: '#00D4FF' }}>{quest.title}</strong>
                                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: '4px 0' }}>
                                            {quest.description}
                                        </p>
                                        <p style={{ fontSize: '11px', color: '#FF2D95' }}>
                                            +{quest.reward} ⭐ | от @{quest.creator_name}
                                        </p>
                                        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                                            Ссылка: {quest.target_url}
                                        </p>
                                        <p style={{ fontSize: '10px', color: '#4ECDC4' }}>
                                            Выполнено: {quest.budget - quest.remaining} / {quest.budget}
                                        </p>
                                    </div>
                                   <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
    <button onClick={() => {
        const tg = window.Telegram.WebApp;
        
        // Отправляем запрос напрямую, без лишних проверок
        fetch(`${API_URL}/api/admin/deactivate-quest/${quest.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: Number(userId) })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Обновляем список активных заданий
                fetchActiveQuests();
                tg.showPopup({
                    title: '✅ Снято',
                    message: 'Задание скрыто из ленты пользователей',
                    buttons: [{ type: 'ok' }]
                });
            } else {
                tg.showPopup({
                    title: '❌ Ошибка',
                    message: data.error || 'Не удалось снять задание',
                    buttons: [{ type: 'ok' }]
                });
            }
        })
        .catch(err => {
            tg.showPopup({
                title: '❌ Ошибка',
                message: err.message,
                buttons: [{ type: 'ok' }]
            });
        });
    }} style={styles.deactivateBtn}>
        ❌ Снять с публикации
    </button>
</div>                                </div>
                            ))
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

function App() {
    const [user, setUser] = useState(null);
    const [balance, setBalance] = useState(0);
    const [tonBalance, setTonBalance] = useState(0);
    const [activeTasks, setActiveTasks] = useState([]);
    const [completedTasks, setCompletedTasks] = useState([]);
    const [myQuests, setMyQuests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('active');
    const [mainTab, setMainTab] = useState('tasks');
    const [channelAvatars, setChannelAvatars] = useState({});
    const [showProfile, setShowProfile] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [questStatusFilter, setQuestStatusFilter] = useState('pending');
    
    const titleInput = useRef(null);
    const descInput = useRef(null);
    const rewardInput = useRef(null);
    const channelInput = useRef(null);

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
            fetchTonBalance(response.data.user.id);
            fetchTasks(response.data.user.id);
            fetchMyQuests(response.data.user.id);
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

    const fetchTonBalance = async (userId) => {
        try {
            const response = await axios.get(`${API_URL}/api/user/${userId}/ton-balance`);
            setTonBalance(response.data.balance);
        } catch (error) {
            console.error('TON Balance error:', error);
        }
    };

    const fetchTasks = async (userId) => {
        try {
            const response = await axios.get(`${API_URL}/api/quests`);
            const allTasks = response.data;
            
            const completionsResponse = await axios.get(`${API_URL}/api/user/${userId}/completions`);
            const completedIds = completionsResponse.data.map(c => c.quest_id);
            
            const active = allTasks.filter(task => !completedIds.includes(task.id) && task.advertiser_id !== userId);
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

    const fetchMyQuests = async (userId) => {
        try {
            const response = await axios.get(`${API_URL}/api/user/${userId}/quests`);
            setMyQuests(response.data);
        } catch (error) {
            console.error('My quests error:', error);
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

    const createQuest = async () => {
        const tg = window.Telegram.WebApp;
        const title = titleInput.current?.value;
        const description = descInput.current?.value;
        const reward = parseInt(rewardInput.current?.value);
        const targetUrl = channelInput.current?.value;
        
        if (!title || !description || !reward || !targetUrl) {
            tg.showPopup({
                title: 'Ошибка',
                message: 'Заполните все поля',
                buttons: [{ type: 'ok' }]
            });
            return;
        }
        
        try {
            const response = await axios.post(`${API_URL}/api/create-quest`, {
                userId: user.id,
                title,
                description,
                reward,
                targetUrl
            });
            
            if (response.data.success) {
                tg.showPopup({
                    title: '✅ Задание создано!',
                    message: response.data.message || 'Оно появится в ленте после проверки',
                    buttons: [{ type: 'ok' }]
                });
                setShowCreateForm(false);
                fetchMyQuests(user.id);
                fetchTasks(user.id);
                
                titleInput.current.value = '';
                descInput.current.value = '';
                rewardInput.current.value = '';
                channelInput.current.value = '';
            }
        } catch (error) {
            tg.showPopup({
                title: 'Ошибка',
                message: error.response?.data?.error || 'Не удалось создать задание',
                buttons: [{ type: 'ok' }]
            });
        }
    };

    const getChannelInitial = (taskTitle, targetUrl) => {
        if (taskTitle.includes('StarTask')) return '⭐';
        if (taskTitle.includes('канал')) return '📢';
        const match = targetUrl.match(/t\.me\/([^\/]+)/);
        if (match) return match[1].charAt(0).toUpperCase();
        return taskTitle.charAt(0).toUpperCase();
    };

    const getChannelColor = (taskTitle) => {
        const colors = ['#FF2D95', '#00D4FF', '#9D4EDD', '#FF6B35', '#00F5FF', '#FF007F', '#7B2FF7'];
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

    if (showProfile) {
        return (
            <div style={styles.container}>
                <div style={styles.backgroundGradient}></div>
                <div style={styles.header}>
                    <div style={styles.logoContainer} className="clickable" onClick={() => setShowProfile(false)}>
                        <div style={styles.logoIcon}>
                            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M16 2L19.5 10.5L28 12L21.5 18L23.5 26.5L16 22L8.5 26.5L10.5 18L4 12L12.5 10.5L16 2Z" fill="url(#grad)" stroke="#00D4FF" strokeWidth="1.2"/>
                                <defs>
                                    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#00D4FF"/>
                                        <stop offset="100%" stopColor="#FF2D95"/>
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <h1 style={styles.logo}>Профиль</h1>
                    </div>
                    <button className="clickable" onClick={() => setShowProfile(false)} style={styles.closeProfileBtn}>
                        ✕
                    </button>
                </div>

                <div style={styles.profileContent}>
                    <div style={styles.profileAvatar}>
                        {user?.photo_url ? (
                            <img src={user.photo_url} alt="avatar" style={styles.profileAvatarImg} />
                        ) : (
                            <div style={styles.profileAvatarPlaceholder}>
                                {user?.username ? user.username.charAt(0).toUpperCase() : '👤'}
                            </div>
                        )}
                    </div>
                    <h2 style={styles.profileName}>{user?.first_name || user?.username}</h2>
                    <p style={styles.profileUsername}>@{user?.username}</p>
                    <p style={styles.profileId}>ID: {user?.telegram_id}</p>
                    
                    <div style={styles.profileBalances}>
                        <div style={styles.profileBalanceCard}>
                            <span>⭐ Stars</span>
                            <strong>{balance}</strong>
                        </div>
                        <div style={styles.profileBalanceCard}>
                            <span>₿ TON</span>
                            <strong>{tonBalance}</strong>
                        </div>
                    </div>

                    <button onClick={() => setShowCreateForm(true)} style={styles.createQuestBtn}>
                        ✨ Создать задание
                    </button>
                    
                    {user?.telegram_id && String(user.telegram_id) === "850997324" && (
                        <button onClick={() => setShowAdminPanel(true)} style={styles.adminBtn}>
                            🛡️ Админ-панель
                        </button>
                    )}
                    
                    {myQuests.length > 0 && (
                        <div style={styles.myQuestsSection}>
                            <h3 style={styles.myQuestsTitle}>Мои задания</h3>
                            
                            <div style={styles.questStatusTabs}>
                                <button onClick={() => setQuestStatusFilter('pending')} style={questStatusFilter === 'pending' ? styles.questStatusTabActive : styles.questStatusTab}>
                                    ⏳ На модерации ({myQuests.filter(q => q.status === 'pending').length})
                                </button>
                                <button onClick={() => setQuestStatusFilter('active')} style={questStatusFilter === 'active' ? styles.questStatusTabActive : styles.questStatusTab}>
                                    ✅ Принято ({myQuests.filter(q => q.status === 'active').length})
                                </button>
                                <button onClick={() => setQuestStatusFilter('rejected')} style={questStatusFilter === 'rejected' ? styles.questStatusTabActive : styles.questStatusTab}>
                                    ❌ Отклонено ({myQuests.filter(q => q.status === 'rejected').length})
                                </button>
                            </div>
                            
                            {myQuests.filter(q => q.status === questStatusFilter).length === 0 ? (
                                <div style={styles.emptyMyQuests}>
                                    <p>Нет заданий в этой категории</p>
                                </div>
                            ) : (
                                myQuests.filter(q => q.status === questStatusFilter).map(quest => (
                                    <div key={quest.id} style={styles.myQuestCard}>
                                        <div style={styles.myQuestIcon}>📢</div>
                                        <div style={styles.myQuestContent}>
                                            <h4>{quest.title}</h4>
                                            <p>{quest.description}</p>
                                            <div style={styles.myQuestFooter}>
                                                <span style={styles.myQuestReward}>+{quest.reward} ⭐</span>
                                                <span style={styles.myQuestStatus}>
                                                    {quest.status === 'pending' && '⏳ На модерации'}
                                                    {quest.status === 'active' && '✅ Опубликовано'}
                                                    {quest.status === 'rejected' && '❌ Отклонено'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {showCreateForm && (
                    <div style={styles.modalOverlay}>
                        <div style={styles.createForm}>
                            <div style={styles.formHeader}>
                                <h3 style={{ color: 'white' }}>✨ Создать задание</h3>
                                <button onClick={() => setShowCreateForm(false)} style={styles.closeBtn}>✕</button>
                            </div>
                            <input type="text" placeholder="Ссылка на канал (t.me/...)" style={styles.formInput} ref={channelInput} />
                            <input type="text" placeholder="Название задания" style={styles.formInput} ref={titleInput} />
                            <textarea placeholder="Описание задания" style={styles.formTextarea} ref={descInput} />
                            <input type="number" placeholder="Награда (Stars)" style={styles.formInput} ref={rewardInput} />
                            <button onClick={createQuest} style={styles.submitBtn}>➕ Создать</button>
                        </div>
                    </div>
                )}

                {showAdminPanel && (
                    <AdminPanel onClose={() => setShowAdminPanel(false)} userId={user?.telegram_id} />
                )}
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.backgroundGradient}></div>
            
            <div style={styles.header}>
                <div style={styles.logoContainer} className="clickable" onClick={() => {
                    window.Telegram.WebApp.openLink('https://t.me/startask_official');
                }}>
                    <div style={styles.logoIcon}>
                        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M16 2L19.5 10.5L28 12L21.5 18L23.5 26.5L16 22L8.5 26.5L10.5 18L4 12L12.5 10.5L16 2Z" fill="url(#grad)" stroke="#00D4FF" strokeWidth="1.2"/>
                            <defs>
                                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#00D4FF"/>
                                    <stop offset="100%" stopColor="#FF2D95"/>
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <h1 style={styles.logo}>StarTask</h1>
                </div>
                <div style={styles.userInfo} className="clickable" onClick={() => setShowProfile(true)}>
                    <div style={styles.userText}>
                        <span style={styles.userName}>{user?.first_name || user?.username || 'Пользователь'}</span>
                        <div style={styles.userBalances}>
                            <span style={styles.userBalance}>⭐ {balance}</span>
                            <span style={styles.userTonBalance}>₿ {tonBalance}</span>
                        </div>
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

            <div style={styles.scrollArea} className="scrollArea">
                <div style={styles.contentWrapper}>
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
                                                        <button onClick={() => completeTask(task.id, task.target_url, task.target_url.split('t.me/')[1])} style={styles.taskButton}>
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
                                <p style={styles.glassText}>Приглашайте друзей и получайте <strong style={{color: '#FF2D95'}}>10%</strong> от их заработка!</p>
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
                                <p style={styles.glassText}>StarTask — неоновая платформа для заработка Telegram Stars на выполнении простых заданий.</p>
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
            </div>

            <div style={styles.bottomNav}>
                <button onClick={() => setMainTab('tasks')} style={mainTab === 'tasks' ? styles.navButtonActive : styles.navButton}>
                    <span style={styles.navIcon}>📋</span>
                    <span style={styles.navLabel}>Задания</span>
                </button>
                <button onClick={() => setMainTab('referral')} style={mainTab === 'referral' ? styles.navButtonActive : styles.navButton}>
                    <span style={styles.navIcon}>👥</span>
                    <span style={styles.navLabel}>Партнёры</span>
                </button>
                <button onClick={() => setMainTab('info')} style={mainTab === 'info' ? styles.navButtonActive : styles.navButton}>
                    <span style={styles.navIcon}>ℹ️</span>
                    <span style={styles.navLabel}>О проекте</span>
                </button>
            </div>
        </div>
    );
}

const styles = {
    container: {
        minHeight: '100vh',
        position: 'relative',
        overflowX: 'hidden',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: 'radial-gradient(ellipse at 20% 0%, #0a0a2a 0%, #050510 100%)'
    },
    backgroundGradient: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(ellipse at 20% 0%, #0a0a2a 0%, #050510 100%)',
        zIndex: -2
    },
    header: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        background: 'transparent',
        zIndex: 100,
        pointerEvents: 'none'
    },
    logoContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        cursor: 'pointer',
        pointerEvents: 'auto'
    },
    logoIcon: {
        width: '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 212, 255, 0.1)',
        borderRadius: '12px',
        border: '1px solid rgba(0, 212, 255, 0.3)',
        boxShadow: '0 0 10px rgba(0, 212, 255, 0.3)'
    },
    logo: {
        margin: 0,
        fontSize: '20px',
        fontWeight: '800',
        background: 'linear-gradient(135deg, #00D4FF 0%, #FF2D95 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        letterSpacing: '-0.5px'
    },
    userInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        cursor: 'pointer',
        pointerEvents: 'auto'
    },
    userText: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end'
    },
    userBalances: {
        display: 'flex',
        gap: '8px'
    },
    userName: {
        fontSize: '14px',
        fontWeight: '600',
        color: 'white'
    },
    userBalance: {
        fontSize: '11px',
        color: '#00D4FF'
    },
    userTonBalance: {
        fontSize: '11px',
        color: '#9D4EDD'
    },
    avatar: {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: 'rgba(0, 212, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        border: '2px solid rgba(0, 212, 255, 0.4)',
        boxShadow: '0 0 10px rgba(0, 212, 255, 0.3)'
    },
    avatarImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
    },
    avatarPlaceholder: {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        fontWeight: '600',
        color: '#00D4FF'
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
    scrollArea: {
        marginTop: '0px',
        marginBottom: '0px',
        padding: '0 16px',
        paddingTop: '80px',
        paddingBottom: '80px',
        overflowY: 'auto',
        height: '100vh',
        boxSizing: 'border-box'
    },
    contentWrapper: {
        paddingBottom: '20px'
    },
    loadingContainer: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#050510',
        color: 'white'
    },
    spinner: {
        width: '48px',
        height: '48px',
        border: '3px solid rgba(0, 212, 255, 0.1)',
        borderTop: '3px solid #00D4FF',
        borderRadius: '50%',
        animation: 'spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite',
        marginBottom: '20px',
        boxShadow: '0 0 15px rgba(0, 212, 255, 0.5)'
    },
    loadingText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: '14px',
        letterSpacing: '1px'
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
        background: 'rgba(0, 212, 255, 0.15)',
        border: 'none',
        borderRadius: '40px',
        color: '#00D4FF',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        boxShadow: '0 0 10px rgba(0, 212, 255, 0.3)'
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
        border: '1px solid rgba(0, 212, 255, 0.15)',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        overflow: 'hidden'
    },
    taskGlow: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 100% 0%, rgba(0, 212, 255, 0.08) 0%, transparent 70%)',
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
        color: '#FF2D95',
        background: 'rgba(255,45,149,0.1)',
        padding: '5px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        border: '1px solid rgba(255,45,149,0.3)'
    },
    taskButton: {
        background: 'linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(255,45,149,0.05) 100%)',
        border: '1px solid rgba(0,212,255,0.3)',
        borderRadius: '40px',
        padding: '7px 18px',
        color: '#00D4FF',
        fontWeight: '500',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'all 0.2s ease'
    },
    completedReward: {
        fontWeight: 'bold',
        color: '#9D4EDD',
        background: 'rgba(157,78,221,0.1)',
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
        border: '1px solid rgba(0,212,255,0.15)'
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
        border: '1px solid rgba(0,212,255,0.15)',
        overflow: 'hidden'
    },
    glassCardGlow: {
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)',
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
        border: '1px solid rgba(0,212,255,0.2)'
    },
    referralLink: {
        fontSize: '11px',
        wordBreak: 'break-all',
        color: '#00D4FF'
    },
    copyButton: {
        width: '100%',
        padding: '12px',
        background: 'linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(255,45,149,0.05) 100%)',
        border: '1px solid rgba(0,212,255,0.3)',
        borderRadius: '40px',
        color: '#00D4FF',
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
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        gap: '6px',
        background: 'transparent',
        padding: '8px 16px',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
        zIndex: 100,
        pointerEvents: 'none'
    },
    navButton: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        background: 'linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(255,45,149,0.08) 100%)',
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        border: '1px solid rgba(0, 212, 255, 0.3)',
        borderRadius: '40px',
        cursor: 'pointer',
        padding: '6px 8px',
        transition: 'all 0.2s ease',
        opacity: 0.8,
        pointerEvents: 'auto'
    },
    navButtonActive: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        background: 'linear-gradient(135deg, rgba(0,212,255,0.25) 0%, rgba(255,45,149,0.15) 100%)',
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        border: '1px solid rgba(0, 212, 255, 0.7)',
        borderRadius: '40px',
        cursor: 'pointer',
        padding: '6px 8px',
        transition: 'all 0.2s ease',
        opacity: 1,
        pointerEvents: 'auto',
        boxShadow: '0 0 12px rgba(0, 212, 255, 0.4)'
    },
    navIcon: {
        fontSize: '16px'
    },
    navLabel: {
        fontSize: '9px',
        fontWeight: '500',
        color: 'white'
    },
    closeProfileBtn: {
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(0,212,255,0.3)',
        borderRadius: '30px',
        color: 'white',
        fontSize: '18px',
        cursor: 'pointer',
        pointerEvents: 'auto',
        width: '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    profileContent: {
        marginTop: '80px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    },
    profileAvatar: {
        width: '100px',
        height: '100px',
        borderRadius: '50%',
        background: 'rgba(0,212,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        border: '3px solid rgba(0,212,255,0.5)',
        marginBottom: '16px'
    },
    profileAvatarImg: {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
    },
    profileAvatarPlaceholder: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '48px',
        fontWeight: '600',
        color: '#00D4FF'
    },
    profileName: {
        fontSize: '24px',
        fontWeight: '700',
        color: 'white',
        marginBottom: '4px'
    },
    profileUsername: {
        fontSize: '14px',
        color: 'rgba(255,255,255,0.6)',
        marginBottom: '4px'
    },
    profileId: {
        fontSize: '12px',
        color: 'rgba(255,255,255,0.4)',
        marginBottom: '20px'
    },
    profileBalances: {
        display: 'flex',
        gap: '20px',
        marginBottom: '30px'
    },
    profileBalanceCard: {
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '20px',
        padding: '12px 24px',
        textAlign: 'center',
        minWidth: '100px'
    },
    createQuestBtn: {
        background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(255,45,149,0.1) 100%)',
        border: '1px solid rgba(0,212,255,0.5)',
        borderRadius: '40px',
        padding: '14px 28px',
        color: '#00D4FF',
        fontWeight: '600',
        cursor: 'pointer',
        fontSize: '16px',
        marginBottom: '30px',
        width: '100%'
    },
    myQuestsSection: {
        width: '100%'
    },
    myQuestsTitle: {
        fontSize: '18px',
        fontWeight: '600',
        color: 'white',
        marginBottom: '16px'
    },
    myQuestCard: {
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '16px',
        padding: '12px',
        display: 'flex',
        gap: '12px',
        marginBottom: '12px'
    },
    myQuestIcon: {
        fontSize: '32px'
    },
    myQuestContent: {
        flex: 1
    },
    myQuestReward: {
        fontSize: '12px',
        color: '#FF2D95'
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200
    },
    createForm: {
        background: 'rgba(20,20,40,0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '24px',
        width: '320px',
        border: '1px solid rgba(0,212,255,0.3)'
    },
    formHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: 'white',
        fontSize: '24px',
        cursor: 'pointer'
    },
    formInput: {
        width: '100%',
        padding: '12px',
        marginBottom: '12px',
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(0,212,255,0.3)',
        borderRadius: '12px',
        color: 'white',
        fontSize: '14px',
        boxSizing: 'border-box'
    },
    formTextarea: {
        width: '100%',
        padding: '12px',
        marginBottom: '12px',
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(0,212,255,0.3)',
        borderRadius: '12px',
        color: 'white',
        fontSize: '14px',
        minHeight: '80px',
        boxSizing: 'border-box',
        fontFamily: 'inherit'
    },
    submitBtn: {
        width: '100%',
        padding: '12px',
        background: 'linear-gradient(135deg, rgba(0,212,255,0.3) 0%, rgba(255,45,149,0.2) 100%)',
        border: '1px solid rgba(0,212,255,0.5)',
        borderRadius: '40px',
        color: '#00D4FF',
        fontWeight: '600',
        cursor: 'pointer',
        fontSize: '16px'
    },
    adminPanel: {
        background: 'rgba(10,10,30,0.98)',
        backdropFilter: 'blur(20px)',
        borderRadius: '28px',
        padding: '20px',
        width: '90%',
        maxWidth: '400px',
        maxHeight: '80vh',
        overflowY: 'auto',
        border: '1px solid rgba(0,212,255,0.3)'
    },
    adminQuestCard: {
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '16px',
        padding: '12px',
        marginBottom: '12px'
    },
    approveBtn: {
        background: 'rgba(0,212,255,0.2)',
        border: '1px solid rgba(0,212,255,0.5)',
        borderRadius: '20px',
        padding: '6px 12px',
        color: '#00D4FF',
        cursor: 'pointer',
        fontSize: '12px'
    },
    rejectBtn: {
        background: 'rgba(255,45,149,0.2)',
        border: '1px solid rgba(255,45,149,0.5)',
        borderRadius: '20px',
        padding: '6px 12px',
        color: '#FF2D95',
        cursor: 'pointer',
        fontSize: '12px'
    },
    adminBtn: {
        background: 'rgba(255,45,149,0.2)',
        border: '1px solid rgba(255,45,149,0.5)',
        borderRadius: '40px',
        padding: '12px 20px',
        color: '#FF2D95',
        fontWeight: '600',
        cursor: 'pointer',
        fontSize: '14px',
        width: '100%',
        marginBottom: '16px'
    },
    adminTabs: {
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '40px',
        padding: '4px'
    },
    adminTab: {
        flex: 1,
        padding: '10px',
        background: 'transparent',
        border: 'none',
        borderRadius: '40px',
        color: 'rgba(255,255,255,0.5)',
        fontSize: '13px',
        cursor: 'pointer'
    },
    adminTabActive: {
        flex: 1,
        padding: '10px',
        background: 'rgba(0, 212, 255, 0.15)',
        border: 'none',
        borderRadius: '40px',
        color: '#00D4FF',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer'
    },
    deactivateBtn: {
        background: 'rgba(255,45,149,0.2)',
        border: '1px solid rgba(255,45,149,0.5)',
        borderRadius: '20px',
        padding: '6px 12px',
        color: '#FF2D95',
        cursor: 'pointer',
        fontSize: '12px',
        width: '100%'
    },
    questStatusTabs: {
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '40px',
        padding: '4px'
    },
    questStatusTab: {
        flex: 1,
        padding: '8px',
        background: 'transparent',
        border: 'none',
        borderRadius: '40px',
        color: 'rgba(255,255,255,0.5)',
        fontSize: '11px',
        cursor: 'pointer'
    },
        rejectModal: {
        background: 'rgba(20,20,40,0.98)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '24px',
        width: '320px',
        border: '1px solid rgba(0,212,255,0.3)'
    },
    rejectTextarea: {
        width: '100%',
        padding: '12px',
        marginBottom: '16px',
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(0,212,255,0.3)',
        borderRadius: '12px',
        color: 'white',
        fontSize: '14px',
        fontFamily: 'inherit',
        resize: 'vertical',
        boxSizing: 'border-box'
    },
    questStatusTabActive: {
        flex: 1,
        padding: '8px',
        background: 'rgba(0, 212, 255, 0.15)',
        border: 'none',
        borderRadius: '40px',
        color: '#00D4FF',
        fontSize: '11px',
        fontWeight: '600',
        cursor: 'pointer'
    },
    myQuestFooter: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '8px'
    },
    myQuestStatus: {
        fontSize: '11px',
        padding: '3px 8px',
        borderRadius: '20px',
        background: 'rgba(0,0,0,0.3)'
    },
    emptyMyQuests: {
        textAlign: 'center',
        padding: '30px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '16px',
        color: 'rgba(255,255,255,0.4)',
        fontSize: '13px'
    }
};

const styleSheet = document.createElement("style");
styleSheet.textContent = `
    html, body, #root {
        margin: 0;
        padding: 0;
        height: 100%;
        background: #050510;
    }
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
    .scrollArea {
        mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
        -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
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