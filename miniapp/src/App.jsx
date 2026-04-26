import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { Address } from '@ton/core';

const API_URL = import.meta.env.VITE_API_URL || 'https://star-task.up.railway.app';

// ============ ADMIN PANEL ============
const AdminPanel = ({ onClose, userId }) => {
    const API_URL = import.meta.env.VITE_API_URL || 'https://star-task.up.railway.app';
    const [pendingQuests, setPendingQuests] = useState([]);
    const [activeQuests, setActiveQuests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adminTab, setAdminTab] = useState('pending');
    const [currentQuestId, setCurrentQuestId] = useState(null);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedRejectReason, setSelectedRejectReason] = useState('');
    const [customRejectReason, setCustomRejectReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const rejectReasons = [
        'Не соответствует правилам платформы',
        'Ссылка на канал недействительна',
        'Неправильный тип задания',
        'Описание не соответствует действительности',
        'Слишком высокая/низкая награда',
        'Дубликат существующего задания',
        'Другая причина'
    ];

    useEffect(() => {
        fetchPendingQuests();
        fetchActiveQuests();
    }, []);

    const fetchPendingQuests = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/admin/pending-quests`);
            setPendingQuests(response.data);
        } catch (error) { console.error(error); }
    };

    const fetchActiveQuests = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/admin/active-quests?adminId=${userId}`);
            setActiveQuests(response.data);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    const approveQuest = async (questId) => {
        if (actionLoading) return;
        setActionLoading(true);
        try {
            const response = await axios.post(`${API_URL}/api/admin/approve-quest/${questId}`, { adminId: Number(userId) });
            if (response.data.success) {
                await fetchPendingQuests();
                await fetchActiveQuests();
                window.Telegram.WebApp.showPopup({ title: '✅ Одобрено', message: response.data.message || 'Задание опубликовано', buttons: [{ type: 'ok' }] });
            }
        } catch (error) {
            window.Telegram.WebApp.showPopup({ title: 'Ошибка', message: error.response?.data?.error || 'Не удалось одобрить', buttons: [{ type: 'ok' }] });
        } finally { setActionLoading(false); }
    };

    const openRejectModal = (questId) => {
        setCurrentQuestId(questId);
        setSelectedRejectReason('');
        setCustomRejectReason('');
        setShowRejectModal(true);
    };

    const handleRejectSubmit = async () => {
        const finalReason = selectedRejectReason === 'Другая причина' ? customRejectReason : selectedRejectReason;
        if (!finalReason) {
            window.Telegram.WebApp.showPopup({ title: 'Ошибка', message: 'Выберите причину', buttons: [{ type: 'ok' }] });
            return;
        }
        if (actionLoading) return;
        setActionLoading(true);
        try {
            const response = await axios.post(`${API_URL}/api/admin/reject-quest/${currentQuestId}`, {
                adminId: Number(userId),
                reason: finalReason
            });
            if (response.data.success) {
                await fetchPendingQuests();
                setShowRejectModal(false);
                window.Telegram.WebApp.showPopup({ title: '❌ Отклонено', message: 'Задание отклонено', buttons: [{ type: 'ok' }] });
            }
        } catch (error) {
            window.Telegram.WebApp.showPopup({ title: 'Ошибка', message: error.response?.data?.error || 'Ошибка', buttons: [{ type: 'ok' }] });
        } finally { setActionLoading(false); }
    };

    const deactivateQuest = async (questId) => {
        if (actionLoading) return;
        
        window.Telegram.WebApp.showPopup({
            title: '⚠️ Снять с публикации',
            message: 'Задание будет скрыто из ленты пользователей. Продолжить?',
            buttons: [
                { id: 'ok', type: 'ok', text: 'Да, снять' },
                { id: 'cancel', type: 'cancel', text: 'Отмена' }
            ]
        }, async (buttonId) => {
            if (buttonId === 'ok') {
                setActionLoading(true);
                try {
                    const response = await axios.post(`${API_URL}/api/admin/deactivate-quest/${questId}`, {
                        adminId: Number(userId)
                    });
                    if (response.data.success) {
                        await fetchActiveQuests();
                        window.Telegram.WebApp.showPopup({ title: '✅ Снято', message: 'Задание скрыто из ленты', buttons: [{ type: 'ok' }] });
                    } else {
                        window.Telegram.WebApp.showPopup({ title: 'Ошибка', message: response.data.error || 'Не удалось снять задание', buttons: [{ type: 'ok' }] });
                    }
                } catch (error) {
                    window.Telegram.WebApp.showPopup({ title: 'Ошибка', message: error.response?.data?.error || 'Не удалось снять задание', buttons: [{ type: 'ok' }] });
                } finally { setActionLoading(false); }
            }
        });
    };

    if (loading) return (
        <div style={st.modalOverlay}>
            <div style={st.adminPanel}>
                <div style={{textAlign:'center', padding:'60px 20px'}}>
                    <div style={st.spinnerPremium}></div>
                    <p style={st.loadingTextPremium}>Загрузка панели управления</p>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <div style={st.modalOverlay}>
                <div style={st.adminPanel}>
                    <div style={st.adminHeader}>
                        <div style={st.adminHeaderLeft}>
                            <span style={st.adminHeaderIcon}>🛡️</span>
                            <span style={st.adminHeaderTitle}>Администратор</span>
                        </div>
                        <button onClick={onClose} style={st.closePremium}>✕</button>
                    </div>
                    
                    <div style={st.adminTabsPremium}>
                        <button onClick={() => setAdminTab('pending')} style={adminTab === 'pending' ? st.adminTabActive : st.adminTab}>
                            <span>На модерации</span>
                            <span style={st.adminTabCount}>{pendingQuests.length}</span>
                        </button>
                        <button onClick={() => setAdminTab('active')} style={adminTab === 'active' ? st.adminTabActive : st.adminTab}>
                            <span>Активные</span>
                            <span style={st.adminTabCount}>{activeQuests.length}</span>
                        </button>
                    </div>
                    
                    <div style={st.adminListArea}>
                        {adminTab === 'pending' && (
                            pendingQuests.length === 0 ? (
                                <div style={st.emptyPremium}>
                                    <span style={st.emptyPremiumIcon}>📭</span>
                                    <span style={st.emptyPremiumText}>Нет заданий на модерацию</span>
                                </div>
                            ) : (
                                pendingQuests.map((quest, i) => (
                                    <div key={quest.id} style={{...st.adminCardPremium, animationDelay: `${i * 0.05}s`}} className="fadeInUp">
                                        <div style={st.adminCardTop}>
                                            <div style={st.adminCardBadge}>Ожидает</div>
                                            <span style={st.adminCardReward}>+{quest.reward} ⭐</span>
                                        </div>
                                        <h4 style={st.adminCardTitlePremium}>{quest.title}</h4>
                                        <p style={st.adminCardDescPremium}>{quest.description}</p>
                                        <p style={st.adminCardAuthor}>от @{quest.creator_name || 'автора'}</p>
                                        <p style={st.adminCardLink}>{quest.target_url}</p>
                                        <div style={st.adminCardActionsPremium}>
                                            <button onClick={() => approveQuest(quest.id)} disabled={actionLoading} style={st.btnApprovePremium}>
                                                <span>✓</span> Одобрить
                                            </button>
                                            <button onClick={() => openRejectModal(quest.id)} disabled={actionLoading} style={st.btnRejectPremium}>
                                                <span>✕</span> Отклонить
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )
                        )}
                        
                        {adminTab === 'active' && (
                            activeQuests.length === 0 ? (
                                <div style={st.emptyPremium}>
                                    <span style={st.emptyPremiumIcon}>🎯</span>
                                    <span style={st.emptyPremiumText}>Нет активных заданий</span>
                                </div>
                            ) : (
                                activeQuests.map((quest, i) => (
                                    <div key={quest.id} style={{...st.adminCardPremium, animationDelay: `${i * 0.05}s`}} className="fadeInUp">
                                        <div style={st.adminCardTop}>
                                            <div style={{...st.adminCardBadge, background: 'rgba(76,175,80,0.12)', color: '#4CAF50'}}>Активно</div>
                                            <span style={st.adminCardReward}>+{quest.reward} ⭐</span>
                                        </div>
                                        <h4 style={st.adminCardTitlePremium}>{quest.title}</h4>
                                        <p style={st.adminCardDescPremium}>{quest.description}</p>
                                        <p style={st.adminCardAuthor}>от @{quest.creator_name || 'автора'}</p>
                                        <div style={st.adminCardStats}>
                                            <div style={st.progressBar}>
                                                <div style={{...st.progressFill, width: `${quest.budget > 0 ? ((quest.budget - quest.remaining) / quest.budget) * 100 : 0}%`}}></div>
                                            </div>
                                            <span style={st.progressLabel}>{quest.budget - quest.remaining} / {quest.budget} выполнений</span>
                                        </div>
                                        <button onClick={() => deactivateQuest(quest.id)} disabled={actionLoading} style={st.btnDeactivatePremium}>
                                            Снять с публикации
                                        </button>
                                    </div>
                                ))
                            )
                        )}
                    </div>
                </div>
            </div>
            
            {showRejectModal && (
                <div style={st.modalOverlay}>
                    <div style={st.sheetPremium}>
                        <div style={st.adminHeader}>
                            <div style={st.adminHeaderLeft}>
                                <span style={st.adminHeaderIcon}>❌</span>
                                <span style={st.adminHeaderTitle}>Причина отклонения</span>
                            </div>
                            <button onClick={() => setShowRejectModal(false)} style={st.closePremium}>✕</button>
                        </div>
                        
                        <p style={st.textSecondary}>Выберите причину из списка или укажите свою:</p>
                        
                        <select 
                            value={selectedRejectReason} 
                            onChange={(e) => setSelectedRejectReason(e.target.value)} 
                            style={st.selectPremium}
                        >
                            <option value="">— Выберите причину —</option>
                            {rejectReasons.map((reason, i) => (
                                <option key={i} value={reason}>{reason}</option>
                            ))}
                        </select>
                        
                        {selectedRejectReason === 'Другая причина' && (
                            <textarea
                                placeholder="Опишите причину..."
                                value={customRejectReason}
                                onChange={(e) => setCustomRejectReason(e.target.value)}
                                style={st.textareaPremium}
                                rows={3}
                            />
                        )}
                        
                        <div style={st.doubleButton}>
                            <button onClick={() => setShowRejectModal(false)} style={st.btnSecondaryPremium}>Отмена</button>
                            <button onClick={handleRejectSubmit} disabled={actionLoading} style={st.btnDangerPremium}>
                                {actionLoading ? 'Отклонение...' : 'Отклонить'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// ============ MAIN APP ============
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
    const [showTopUpModal, setShowTopUpModal] = useState(false);
    const [topUpAmount, setTopUpAmount] = useState(50);
    const [showTonTopUpModal, setShowTonTopUpModal] = useState(false);
    const [tonTopUpAmount, setTonTopUpAmount] = useState(1);
    const [tonPaymentStep, setTonPaymentStep] = useState('select');

    const [tonConnectUI] = useTonConnectUI();
    const wallet = useTonWallet();

    const titleInput = useRef(null);
    const descInput = useRef(null);
    const rewardInput = useRef(null);
    const channelInput = useRef(null);

    useEffect(() => {
        if (wallet && user) {
            try {
                const friendlyAddress = Address.parse(wallet.account.address).toString({ bounceable: false, testOnly: false });
                axios.post(`${API_URL}/api/user/connect-wallet`, { userId: user.id, walletAddress: friendlyAddress });
            } catch (e) { console.error(e); }
        }
    }, [wallet, user]);

    useEffect(() => {
        const tg = window.Telegram.WebApp;
        tg.ready(); tg.expand(); tg.MainButton.hide();
        tg.setHeaderColor('#000000'); tg.setBackgroundColor('#000000');
        if (tg.initDataUnsafe?.user) authenticate(tg.initDataUnsafe.user);
    }, []);

    const authenticate = async (telegramUser) => {
        try {
            const userPhotoUrl = window.Telegram.WebApp.initDataUnsafe?.user?.photo_url;
            const response = await axios.post(`${API_URL}/api/auth`, { telegramId: telegramUser.id, username: telegramUser.username });
            setUser({ ...response.data.user, photo_url: userPhotoUrl, first_name: telegramUser.first_name, last_name: telegramUser.last_name });
            localStorage.setItem('token', response.data.token);
            fetchBalance(response.data.user.id);
            fetchTonBalance(response.data.user.id);
            fetchTasks(response.data.user.id);
            fetchMyQuests(response.data.user.id);
        } catch (error) { console.error('Auth error:', error); } finally { setLoading(false); }
    };

    const fetchBalance = async (userId) => {
        try { const r = await axios.get(`${API_URL}/api/user/${userId}/balance`); setBalance(r.data.balance); } catch (e) { console.error(e); }
    };
    const fetchTonBalance = async (userId) => {
        try { const r = await axios.get(`${API_URL}/api/user/${userId}/ton-balance`); setTonBalance(r.data.balance); } catch (e) { console.error(e); }
    };
    const fetchTasks = async (userId) => {
        try {
            const response = await axios.get(`${API_URL}/api/quests`);
            const allTasks = response.data;
            const completionsResponse = await axios.get(`${API_URL}/api/user/${userId}/completions`);
            const completedIds = completionsResponse.data.map(c => c.quest_id);
            setActiveTasks(allTasks.filter(t => !completedIds.includes(t.id) && t.advertiser_id !== userId));
            setCompletedTasks(allTasks.filter(t => completedIds.includes(t.id)));
            for (const task of allTasks) {
                if (task.type === 'subscription' && task.target_url.includes('t.me/')) {
                    let username = task.target_url.split('t.me/')[1].replace('/', '');
                    await fetchChannelAvatar(username, task.id);
                }
            }
        } catch (e) { console.error(e); }
    };
    const fetchMyQuests = async (userId) => {
        try { const r = await axios.get(`${API_URL}/api/user/${userId}/quests`); setMyQuests(r.data); } catch (e) { console.error(e); }
    };
    const fetchChannelAvatar = async (username, taskId) => {
        try {
            const r = await axios.get(`${API_URL}/api/channel/avatar/${username}`);
            setChannelAvatars(prev => ({ ...prev, [taskId]: r.data.success ? r.data.avatar : null }));
        } catch (e) { setChannelAvatars(prev => ({ ...prev, [taskId]: null })); }
    };

    const completeTask = async (taskId, taskUrl, channelUsername) => {
        const tg = window.Telegram.WebApp;
        tg.openLink(taskUrl);
        tg.MainButton.show(); tg.MainButton.setText('⏳ Проверка...'); tg.MainButton.disable();
        setTimeout(async () => {
            try {
                const response = await axios.post(`${API_URL}/api/check-subscription`, { userId: user.id, channelUsername, questId: taskId });
                tg.MainButton.hide();
                if (response.data.success) { tg.showPopup({ title: '🎉 Выполнено!', message: response.data.message, buttons: [{ type: 'ok' }] }); fetchBalance(user.id); fetchTasks(user.id); }
                else tg.showPopup({ title: '❌ Подписка не найдена', message: 'Вы не подписались на канал.', buttons: [{ type: 'ok' }] });
            } catch (error) { tg.MainButton.hide(); tg.showPopup({ title: '⚠️ Ошибка', message: error.response?.data?.error || 'Ошибка проверки', buttons: [{ type: 'ok' }] }); }
        }, 5000);
    };

    const createQuest = async () => {
        const tg = window.Telegram.WebApp;
        const title = titleInput.current?.value, description = descInput.current?.value, reward = parseInt(rewardInput.current?.value), targetUrl = channelInput.current?.value;
        if (!title || !description || !reward || !targetUrl) { tg.showPopup({ title: 'Ошибка', message: 'Заполните все поля', buttons: [{ type: 'ok' }] }); return; }
        try {
            const response = await axios.post(`${API_URL}/api/create-quest`, { userId: user.id, title, description, reward, targetUrl });
            if (response.data.success) {
                tg.showPopup({ title: '✅ Задание создано!', message: response.data.message, buttons: [{ type: 'ok' }] });
                setShowCreateForm(false); fetchMyQuests(user.id); fetchTasks(user.id);
                [titleInput, descInput, rewardInput, channelInput].forEach(ref => { if (ref.current) ref.current.value = ''; });
            }
        } catch (error) { tg.showPopup({ title: 'Ошибка', message: error.response?.data?.error || 'Ошибка', buttons: [{ type: 'ok' }] }); }
    };

    const sendTonPayment = async () => {
        if (!wallet) { window.Telegram.WebApp.showPopup({ title: 'Ошибка', message: 'Подключите TON кошелёк', buttons: [{ type: 'ok' }] }); return; }
        try {
            setTonPaymentStep('waiting');
            const tx = await tonConnectUI.sendTransaction({ validUntil: Math.floor(Date.now() / 1000) + 600, messages: [{ address: import.meta.env.VITE_PLATFORM_TON_WALLET, amount: (tonTopUpAmount * 1e9).toString() }] });
            const response = await axios.post(`${API_URL}/api/ton-payment/credit`, { userId: user.id, amount: tonTopUpAmount, boc: tx.boc });
            if (response.data.success) { setTonPaymentStep('success'); fetchTonBalance(user.id); }
        } catch (error) {
            setTonPaymentStep('select');
            window.Telegram.WebApp.showPopup({ title: 'Ошибка', message: error?.message || 'Платёж не прошёл', buttons: [{ type: 'ok' }] });
        }
    };

    const createInvoice = async () => {
        const tg = window.Telegram.WebApp;
        if (!user?.id) { tg.showPopup({ title: 'Ошибка', message: 'Не авторизован', buttons: [{ type: 'ok' }] }); return; }
        try {
            const response = await axios.post(`${API_URL}/api/create-invoice`, { userId: user.id, amount: topUpAmount });
            if (response.data.success && response.data.invoiceLink) {
                setShowTopUpModal(false);
                tg.openInvoice(response.data.invoiceLink, (status) => {
                    if (status === 'paid') { fetchBalance(user.id); tg.showPopup({ title: '✅ Успешно!', message: `Баланс пополнен на ${topUpAmount} Stars!`, buttons: [{ type: 'ok' }] }); }
                    else if (status === 'cancelled') tg.showPopup({ title: '❌ Отменено', message: 'Платёж отменён', buttons: [{ type: 'ok' }] });
                });
            }
        } catch (error) { tg.showPopup({ title: 'Ошибка', message: error.response?.data?.error || 'Ошибка', buttons: [{ type: 'ok' }] }); }
    };

    const getChannelInitial = (taskTitle, targetUrl) => {
        if (taskTitle.includes('StarTask')) return '⭐';
        const match = targetUrl.match(/t\.me\/([^\/]+)/);
        return match ? match[1].charAt(0).toUpperCase() : taskTitle.charAt(0).toUpperCase();
    };

    const getChannelColor = (taskTitle) => {
        const colors = ['#FF3366', '#00C2FF', '#A855F7', '#F97316', '#06D6A0', '#8B5CF6'];
        let hash = 0;
        for (let i = 0; i < taskTitle.length; i++) { hash = ((hash << 5) - hash) + taskTitle.charCodeAt(i); hash |= 0; }
        return colors[Math.abs(hash) % colors.length];
    };

    const getReferralLink = () => `https://t.me/StarTaskBot?start=ref_${user?.id}`;
    const copyReferralLink = () => {
        navigator.clipboard.writeText(getReferralLink());
        window.Telegram.WebApp.showPopup({ title: '🔗 Скопировано!', message: 'Поделитесь с друзьями и получайте 10%', buttons: [{ type: 'ok' }] });
    };

    const getFriendlyAddress = () => {
        if (!wallet) return '';
        try {
            const friendly = Address.parse(wallet.account.address).toString({ bounceable: false, testOnly: false });
            return `${friendly.slice(0, 6)}...${friendly.slice(-4)}`;
        } catch { return `${wallet.account.address.slice(0, 6)}...${wallet.account.address.slice(-4)}`; }
    };

    // ---- LOADING ----
    if (loading) return (
        <div style={st.loadingScreen}>
            <div style={st.loadingContent}>
                <div style={st.loadingLogoBox}>
                    <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
                        <path d="M16 2L19.5 10.5L28 12L21.5 18L23.5 26.5L16 22L8.5 26.5L10.5 18L4 12L12.5 10.5L16 2Z" fill="url(#lg)" stroke="#00C2FF" strokeWidth="1"/>
                        <defs><linearGradient id="lg" x1="0" y1="0" x2="32" y2="32"><stop stopColor="#00C2FF"/><stop offset="1" stopColor="#FF3366"/></linearGradient></defs>
                    </svg>
                </div>
                <p style={st.loadingTitle}>StarTask</p>
                <p style={st.loadingSubtitle}>Платформа микрозаданий</p>
                <div style={st.loadingLine}><div style={st.loadingLineFill}></div></div>
            </div>
        </div>
    );

    // ---- MAIN ----
    return (
        <div style={st.screen}>
            {/* Premium background */}
            <div style={st.bgGrid}></div>
            <div style={st.bgOrb1}></div>
            <div style={st.bgOrb2}></div>
            <div style={st.bgOrb3}></div>

            {/* Header */}
            <div style={st.header}>
                <button style={st.logoBtn} onClick={() => window.Telegram.WebApp.openLink('https://t.me/startask_official')}>
                    <div style={st.logoMark}>
                        <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                            <path d="M16 2L19.5 10.5L28 12L21.5 18L23.5 26.5L16 22L8.5 26.5L10.5 18L4 12L12.5 10.5L16 2Z" fill="url(#hg)" stroke="#00C2FF" strokeWidth="1.2"/>
                            <defs><linearGradient id="hg" x1="0" y1="0" x2="32" y2="32"><stop stopColor="#00C2FF"/><stop offset="1" stopColor="#FF3366"/></linearGradient></defs>
                        </svg>
                    </div>
                    <span style={st.logoText}>StarTask</span>
                </button>

                <button style={st.userChip} onClick={() => setShowProfile(true)}>
                    <div style={st.userChipBalances}>
                        <span style={st.chipBalance}>⭐ {balance}</span>
                        <span style={st.chipTonBalance}>💎 {parseFloat(tonBalance||0).toFixed(2)}</span>
                    </div>
                    <div style={st.chipAvatar}>
                        {user?.photo_url
                            ? <img src={user.photo_url} alt="av" style={st.chipAvatarImg} />
                            : <span style={st.chipAvatarLetter}>{user?.username?.charAt(0).toUpperCase() || '?'}</span>
                        }
                    </div>
                </button>
            </div>

            {/* Content */}
            <div style={st.mainScroll}>
                {mainTab === 'tasks' && (
                    <>
                        <div style={st.segmentControlPremium}>
                            <button onClick={() => setActiveTab('active')} style={activeTab === 'active' ? st.segmentActive : st.segmentInactive}>
                                Активные
                                <span style={st.segmentBadge}>{activeTasks.length}</span>
                            </button>
                            <button onClick={() => setActiveTab('completed')} style={activeTab === 'completed' ? st.segmentActive : st.segmentInactive}>
                                Выполненные
                                <span style={st.segmentBadge}>{completedTasks.length}</span>
                            </button>
                        </div>

                        {activeTab === 'active' && (
                            activeTasks.length === 0
                                ? <div style={st.emptyStatePremium}>
                                    <div style={st.emptyStateIcon}>✨</div>
                                    <h3 style={st.emptyStateTitle}>Всё выполнено</h3>
                                    <p style={st.emptyStateText}>Новые задания появятся в ближайшее время</p>
                                </div>
                                : activeTasks.map((task, i) => (
                                    <div key={task.id} style={{...st.questCard, animationDelay: `${i * 0.06}s`}} className="cardEntrance">
                                        <div style={st.questCardShine}></div>
                                        <div style={{...st.questAvatar, background: channelAvatars[task.id] ? 'transparent' : getChannelColor(task.title)}}>
                                            {channelAvatars[task.id]
                                                ? <img src={channelAvatars[task.id]} alt="" style={st.questAvatarImg} />
                                                : <span style={st.questAvatarLetter}>{getChannelInitial(task.title, task.target_url)}</span>
                                            }
                                        </div>
                                        <div style={st.questBody}>
                                            <h4 style={st.questTitle}>{task.title}</h4>
                                            <p style={st.questDesc}>{task.description}</p>
                                            <div style={st.questFooter}>
                                                <div style={st.rewardTag}>+{task.reward} ⭐</div>
                                                <button onClick={() => completeTask(task.id, task.target_url, task.target_url.split('t.me/')[1])} style={st.actionBtnPremium}>
                                                    Выполнить
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                        )}

                        {activeTab === 'completed' && (
                            completedTasks.length === 0
                                ? <div style={st.emptyStatePremium}>
                                    <div style={st.emptyStateIcon}>📋</div>
                                    <h3 style={st.emptyStateTitle}>Пока пусто</h3>
                                    <p style={st.emptyStateText}>Выполняйте задания и получайте награды</p>
                                </div>
                                : completedTasks.map(task => (
                                    <div key={task.id} style={{...st.questCard, opacity: 0.5}}>
                                        <div style={{...st.questAvatar, background: channelAvatars[task.id] ? 'transparent' : getChannelColor(task.title)}}>
                                            {channelAvatars[task.id]
                                                ? <img src={channelAvatars[task.id]} alt="" style={st.questAvatarImg} />
                                                : <span style={st.questAvatarLetter}>{getChannelInitial(task.title, task.target_url)}</span>
                                            }
                                        </div>
                                        <div style={st.questBody}>
                                            <h4 style={st.questTitle}>{task.title}</h4>
                                            <p style={st.questDesc}>{task.description}</p>
                                            <div style={st.questFooter}>
                                                <div style={{...st.rewardTag, background: 'rgba(168,85,247,0.1)', color: '#A855F7', borderColor: 'rgba(168,85,247,0.2)'}}>✓ +{task.reward} ⭐</div>
                                                <span style={st.completedMark}>Выполнено</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                        )}
                    </>
                )}

                {mainTab === 'referral' && (
                    <>
                        <div style={st.cardPremium}>
                            <div style={st.cardIconBox}>👥</div>
                            <h3 style={st.cardTitle}>Партнёрская программа</h3>
                            <p style={st.cardDescription}>
                                Приглашайте друзей и получайте <strong style={{color: '#FF3366'}}>10%</strong> от их заработка навсегда
                            </p>
                            <div style={st.referralCodeBox}>
                                <code style={st.referralCode}>{getReferralLink()}</code>
                            </div>
                            <button onClick={copyReferralLink} style={st.copyBtnPremium}>
                                <span>📋</span> Скопировать ссылку
                            </button>
                        </div>
                        <div style={st.cardPremium}>
                            <h4 style={st.statsHeading}>Статистика</h4>
                            <div style={st.statRowPremium}>
                                <span style={st.statLabelPremium}>Приглашено друзей</span>
                                <span style={st.statValuePremium}>0</span>
                            </div>
                            <div style={st.statRowPremium}>
                                <span style={st.statLabelPremium}>Заработано комиссии</span>
                                <span style={st.statValuePremium}>0 ⭐</span>
                            </div>
                        </div>
                    </>
                )}

                {mainTab === 'info' && (
                    <>
                        {[
                            { icon: '⭐', title: 'StarTask', desc: 'Первая B2B-платформа для продвижения Telegram-каналов через вознаграждения в Stars и TON. С нами зарабатывают тысячи пользователей.' },
                            { icon: '🚀', title: 'Как начать', desc: 'Выберите задание → Выполните простое действие → Получите вознаграждение мгновенно на ваш баланс. Никаких задержек.' },
                            { icon: '💎', title: 'TON Foundation', desc: 'Проект поддержан TON Foundation. Мы строим Web3-экономику заданий с криптовалютными расчётами.' },
                        ].map(({ icon, title, desc }) => (
                            <div key={title} style={st.cardPremium}>
                                <div style={st.cardIconBox}>{icon}</div>
                                <h3 style={st.cardTitle}>{title}</h3>
                                <p style={st.cardDescription}>{desc}</p>
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Bottom navigation */}
            <div style={st.bottomNav}>
                {[
                    { id: 'tasks', icon: '📋', label: 'Задания' },
                    { id: 'referral', icon: '👥', label: 'Партнёры' },
                    { id: 'info', icon: 'ℹ️', label: 'О проекте' },
                ].map(({ id, icon, label }) => (
                    <button key={id} onClick={() => setMainTab(id)} style={mainTab === id ? st.navItemActive : st.navItem}>
                        <span style={st.navItemIcon}>{icon}</span>
                        <span style={st.navItemLabel}>{label}</span>
                    </button>
                ))}
            </div>

            {/* Profile Panel */}
            {showProfile && (
                <div style={st.profileOverlay}>
                    <div style={st.profilePanel}>
                        <div style={st.profileHeader}>
                            <button onClick={() => setShowProfile(false)} style={st.backBtnPremium}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                            </button>
                            <span style={st.profileHeaderTitle}>Профиль</span>
                            <div style={{width:36}}></div>
                        </div>

                        <div style={st.profileBody}>
                            {/* Avatar */}
                            <div style={st.profileAvatarSection}>
                                <div style={st.profileAvatarRing}>
                                    <div style={st.profileAvatarInner}>
                                        {user?.photo_url
                                            ? <img src={user.photo_url} alt="avatar" style={st.profileAvatarImg} />
                                            : <span style={st.profileAvatarLetter}>{user?.username?.charAt(0).toUpperCase() || '👤'}</span>
                                        }
                                    </div>
                                </div>
                                <h2 style={st.profileDisplayName}>{user?.first_name || user?.username}</h2>
                                <p style={st.profileDisplaySub}>@{user?.username} · ID {user?.telegram_id}</p>
                            </div>

                            {/* Balances */}
                            <div style={st.balanceDuo}>
                                <div style={st.balanceCardPremium}>
                                    <span style={st.balanceCardLabel}>⭐ Telegram Stars</span>
                                    <span style={st.balanceCardAmount}>{balance.toLocaleString()}</span>
                                </div>
                                <div style={{...st.balanceCardPremium, borderColor: 'rgba(0,136,204,0.15)'}}>
                                    <span style={st.balanceCardLabel}>💎 TON</span>
                                    <span style={{...st.balanceCardAmount, color: '#0088CC'}}>{parseFloat(tonBalance || 0).toFixed(3)}</span>
                                </div>
                            </div>

                            {/* Wallet */}
                            <div style={st.profileSection}>
                                {wallet ? (
                                    <div style={st.walletCard}>
                                        <div style={st.walletCardLeft}>
                                            <div style={st.walletDot}></div>
                                            <div>
                                                <p style={st.walletLabel}>TON кошелёк подключён</p>
                                                <p style={st.walletAddress}>{getFriendlyAddress()}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => tonConnectUI.disconnect()} style={st.walletDisconnectBtn}>Отключить</button>
                                    </div>
                                ) : (
                                    <button onClick={() => tonConnectUI.openModal()} style={st.connectWalletPremium}>
                                        💎 Подключить TON кошелёк
                                    </button>
                                )}
                            </div>

                            {/* Actions */}
                            <div style={st.profileSection}>
                                <button onClick={() => setShowCreateForm(true)} style={st.profileActionBtn}>
                                    <span>✨</span> Создать задание
                                </button>
                                <button onClick={() => setShowTopUpModal(true)} style={{...st.profileActionBtn, background: 'rgba(255,210,0,0.05)', borderColor: 'rgba(255,210,0,0.15)', color: '#FFD200'}}>
                                    <span>⭐</span> Пополнить Stars
                                </button>
                                <button onClick={() => setShowTonTopUpModal(true)} style={{...st.profileActionBtn, background: 'rgba(0,136,204,0.05)', borderColor: 'rgba(0,136,204,0.15)', color: '#0088CC'}}>
                                    <span>💎</span> Пополнить TON
                                </button>
                                {user?.telegram_id && String(user.telegram_id) === "850997324" && (
                                    <button onClick={() => setShowAdminPanel(true)} style={{...st.profileActionBtn, background: 'rgba(255,51,102,0.05)', borderColor: 'rgba(255,51,102,0.15)', color: '#FF3366'}}>
                                        <span>🛡️</span> Панель администратора
                                    </button>
                                )}
                            </div>

                            {/* My Quests */}
                            {myQuests.length > 0 && (
                                <div style={st.profileSection}>
                                    <h3 style={st.sectionLabel}>Мои задания</h3>
                                    <div style={st.filterRowPremium}>
                                        {[
                                            ['pending', 'На модерации'],
                                            ['active', 'Принято'],
                                            ['rejected', 'Отклонено']
                                        ].map(([val, label]) => (
                                            <button key={val} onClick={() => setQuestStatusFilter(val)} style={questStatusFilter === val ? st.filterBtnActivePremium : st.filterBtnPremium}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    {myQuests.filter(q => q.status === questStatusFilter).length === 0
                                        ? <div style={st.emptySmallPremium}>Нет заданий</div>
                                        : myQuests.filter(q => q.status === questStatusFilter).map(quest => (
                                            <div key={quest.id} style={st.myQuestCardPremium}>
                                                <div style={{...st.myQuestAvatarBox, background: channelAvatars[quest.id] ? 'transparent' : getChannelColor(quest.title)}}>
                                                    {channelAvatars[quest.id]
                                                        ? <img src={channelAvatars[quest.id]} alt="" style={st.myQuestAvatarImg} />
                                                        : <span>{getChannelInitial(quest.title, quest.target_url)}</span>
                                                    }
                                                </div>
                                                <div style={st.myQuestContent}>
                                                    <p style={st.myQuestTitlePremium}>{quest.title}</p>
                                                    <p style={st.myQuestDescPremium}>{quest.description}</p>
                                                    <div style={st.myQuestFooterPremium}>
                                                        <span style={st.myQuestReward}>+{quest.reward} ⭐</span>
                                                        <span style={{
                                                            ...st.statusTag,
                                                            ...(quest.status === 'pending' && {background:'rgba(255,193,7,0.12)', color:'#FFC107'}),
                                                            ...(quest.status === 'active' && {background:'rgba(76,175,80,0.12)', color:'#4CAF50'}),
                                                            ...(quest.status === 'rejected' && {background:'rgba(255,51,102,0.12)', color:'#FF3366'}),
                                                        }}>
                                                            {quest.status === 'pending' && 'На модерации'}
                                                            {quest.status === 'active' && 'Опубликовано'}
                                                            {quest.status === 'rejected' && 'Отклонено'}
                                                            {quest.status === 'inactive' && 'Снято'}
                                                        </span>
                                                    </div>
                                                    {quest.status === 'rejected' && quest.rejection_reason && (
                                                        <p style={st.rejectionReasonText}>📝 {quest.rejection_reason}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            {showCreateForm && (
                <div style={st.modalOverlay}>
                    <div style={st.sheetPremium}>
                        <div style={st.sheetHeaderPremium}>
                            <span>✨</span>
                            <h3>Создать задание</h3>
                            <button onClick={() => setShowCreateForm(false)} style={st.closePremium}>✕</button>
                        </div>
                        <input type="text" placeholder="Ссылка на канал (t.me/...)" style={st.inputPremium} ref={channelInput} />
                        <input type="text" placeholder="Название задания" style={st.inputPremium} ref={titleInput} />
                        <textarea placeholder="Описание задания" style={st.textareaPremium} ref={descInput} />
                        <input type="number" placeholder="Награда в Stars" style={st.inputPremium} ref={rewardInput} />
                        <button onClick={createQuest} style={st.btnPrimaryPremium}>Создать задание</button>
                    </div>
                </div>
            )}

            {showTonTopUpModal && (
                <div style={st.modalOverlay}>
                    <div style={st.sheetPremium}>
                        <div style={st.sheetHeaderPremium}>
                            <span>💎</span>
                            <h3>Пополнение TON</h3>
                            <button onClick={() => { setShowTonTopUpModal(false); setTonPaymentStep('select'); }} style={st.closePremium}>✕</button>
                        </div>
                        {tonPaymentStep === 'select' && <>
                            <p style={st.textSecondary}>Выберите сумму пополнения:</p>
                            <div style={st.amountGridPremium}>
                                {[0.5, 1, 2, 5, 10, 20].map(amt => (
                                    <button key={amt} onClick={() => setTonTopUpAmount(amt)} style={tonTopUpAmount === amt ? st.amountBtnActivePremium : st.amountBtnPremium}>{amt} 💎</button>
                                ))}
                            </div>
                            <button onClick={sendTonPayment} style={{...st.btnPrimaryPremium, marginTop:'20px', background: 'rgba(0,136,204,0.12)', borderColor: 'rgba(0,136,204,0.3)', color: '#0088CC'}}>
                                Оплатить {tonTopUpAmount} TON
                            </button>
                        </>}
                        {tonPaymentStep === 'waiting' && (
                            <div style={st.paymentWaitingPremium}>
                                <div style={st.spinnerPremium}></div>
                                <p style={st.textSecondary}>Ожидание подтверждения транзакции...</p>
                            </div>
                        )}
                        {tonPaymentStep === 'success' && (
                            <div style={st.paymentSuccessPremium}>
                                <span style={{fontSize:'64px'}}>✅</span>
                                <h3 style={{color:'white', margin:'12px 0 4px'}}>Готово</h3>
                                <p style={st.textSecondary}>+{tonTopUpAmount} TON зачислено на баланс</p>
                                <button onClick={() => { setShowTonTopUpModal(false); setTonPaymentStep('select'); }} style={st.btnPrimaryPremium}>Закрыть</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showTopUpModal && (
                <div style={st.modalOverlay}>
                    <div style={st.sheetPremium}>
                        <div style={st.sheetHeaderPremium}>
                            <span>⭐</span>
                            <h3>Пополнение Stars</h3>
                            <button onClick={() => setShowTopUpModal(false)} style={st.closePremium}>✕</button>
                        </div>
                        <p style={st.textSecondary}>Выберите сумму пополнения:</p>
                        <div style={st.amountGridPremium}>
                            {[1, 50, 100, 250, 500, 1000].map(amt => (
                                <button key={amt} onClick={() => setTopUpAmount(amt)} style={topUpAmount === amt ? st.amountBtnActivePremium : st.amountBtnPremium}>{amt} ⭐</button>
                            ))}
                        </div>
                        <div style={st.doubleButton}>
                            <button onClick={() => setShowTopUpModal(false)} style={st.btnSecondaryPremium}>Отмена</button>
                            <button onClick={createInvoice} style={st.btnPrimaryPremium}>Оплатить</button>
                        </div>
                    </div>
                </div>
            )}

            {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} userId={user?.telegram_id} />}
        </div>
    );
}

// ============ STYLES ============
const st = {
    // Layout
    screen: { minHeight: '100vh', position: 'relative', overflowX: 'hidden', fontFamily: "'Inter', -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif", background: '#000000', color: '#FFFFFF' },
    bgGrid: { position: 'fixed', inset: 0, zIndex: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' },
    bgOrb1: { position: 'fixed', top: '-40%', left: '-20%', width: '80%', height: '80%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,194,255,0.04) 0%, transparent 60%)', zIndex: 0, pointerEvents: 'none', filter: 'blur(100px)' },
    bgOrb2: { position: 'fixed', bottom: '-30%', right: '-10%', width: '70%', height: '70%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,51,102,0.04) 0%, transparent 60%)', zIndex: 0, pointerEvents: 'none', filter: 'blur(100px)' },
    bgOrb3: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '60%', height: '60%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.02) 0%, transparent 60%)', zIndex: 0, pointerEvents: 'none', filter: 'blur(120px)' },

    // Loading
    loadingScreen: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000000' },
    loadingContent: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' },
    loadingLogoBox: { width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,194,255,0.06)', borderRadius: '50%', border: '1px solid rgba(0,194,255,0.15)', boxShadow: '0 0 80px rgba(0,194,255,0.1)', animation: 'pulse 3s ease-in-out infinite' },
    loadingTitle: { color: 'white', fontSize: '24px', fontWeight: '800', letterSpacing: '-1px', margin: 0, background: 'linear-gradient(135deg, #FFFFFF 0%, #00C2FF 50%, #FF3366 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
    loadingSubtitle: { color: 'rgba(255,255,255,0.3)', fontSize: '12px', margin: 0, letterSpacing: '2px', textTransform: 'uppercase' },
    loadingLine: { width: '120px', height: '1px', background: 'rgba(255,255,255,0.05)', borderRadius: '1px', overflow: 'hidden' },
    loadingLineFill: { height: '100%', width: '30%', background: 'linear-gradient(90deg, #00C2FF, #FF3366)', borderRadius: '1px', animation: 'loadbar 2s ease infinite' },

    // Header
    header: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(40px)', borderBottom: '1px solid rgba(255,255,255,0.04)' },
    logoBtn: { display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
    logoMark: { width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,194,255,0.06)', borderRadius: '50%', border: '1px solid rgba(0,194,255,0.15)' },
    logoText: { fontSize: '18px', fontWeight: '800', background: 'linear-gradient(135deg, #FFFFFF 0%, #00C2FF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' },
    userChip: { display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '40px', padding: '6px 8px 6px 14px', cursor: 'pointer', transition: 'all 0.2s ease' },
    userChipBalances: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' },
    chipBalance: { fontSize: '10px', fontWeight: '600', color: '#00C2FF', letterSpacing: '0.2px' },
    chipTonBalance: { fontSize: '10px', fontWeight: '600', color: '#0088CC', letterSpacing: '0.2px' },
    chipAvatar: { width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,194,255,0.1)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(0,194,255,0.2)' },
    chipAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    chipAvatarLetter: { color: '#00C2FF', fontWeight: '700', fontSize: '14px' },

    // Main scroll
    mainScroll: { position: 'relative', zIndex: 1, padding: '76px 16px 90px', minHeight: '100vh', boxSizing: 'border-box' },

    // Segment control
    segmentControlPremium: { display: 'flex', marginBottom: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '3px', border: '1px solid rgba(255,255,255,0.04)' },
    segmentInactive: { flex: 1, padding: '10px', background: 'transparent', border: 'none', borderRadius: '10px', color: 'rgba(255,255,255,0.35)', fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    segmentActive: { flex: 1, padding: '10px', background: 'rgba(0,194,255,0.08)', border: 'none', borderRadius: '10px', color: '#00C2FF', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 0 20px rgba(0,194,255,0.1)' },
    segmentBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', fontSize: '10px', padding: '1px 6px', minWidth: '18px' },

    // Quest card
    questCard: { position: 'relative', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px', display: 'flex', gap: '14px', marginBottom: '10px', overflow: 'hidden', transition: 'all 0.3s ease' },
    questCardShine: { position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' },
    questAvatar: { width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
    questAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    questAvatarLetter: { fontSize: '20px', fontWeight: '700', color: 'white' },
    questBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' },
    questTitle: { margin: 0, fontSize: '15px', fontWeight: '700', color: 'white', letterSpacing: '-0.2px', lineHeight: 1.3 },
    questDesc: { margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 },
    questFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' },
    rewardTag: { fontSize: '11px', fontWeight: '700', color: '#FF3366', background: 'rgba(255,51,102,0.08)', border: '1px solid rgba(255,51,102,0.15)', borderRadius: '20px', padding: '4px 10px' },
    actionBtnPremium: { fontSize: '12px', fontWeight: '600', color: '#00C2FF', background: 'rgba(0,194,255,0.06)', border: '1px solid rgba(0,194,255,0.15)', borderRadius: '20px', padding: '7px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s ease' },
    completedMark: { fontSize: '12px', color: 'rgba(255,255,255,0.2)' },

    // Empty state
    emptyStatePremium: { textAlign: 'center', padding: '60px 20px' },
    emptyStateIcon: { fontSize: '48px', marginBottom: '16px', display: 'block', opacity: 0.4 },
    emptyStateTitle: { color: 'white', fontSize: '18px', fontWeight: '700', marginBottom: '8px', letterSpacing: '-0.3px' },
    emptyStateText: { color: 'rgba(255,255,255,0.3)', fontSize: '13px', margin: 0 },

    // Card premium
    cardPremium: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', padding: '24px', marginBottom: '12px', textAlign: 'center' },
    cardIconBox: { fontSize: '40px', marginBottom: '14px', display: 'block' },
    cardTitle: { color: 'white', fontSize: '18px', fontWeight: '700', margin: '0 0 10px', letterSpacing: '-0.3px' },
    cardDescription: { color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: 1.6, margin: 0 },

    // Referral
    referralCodeBox: { background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '12px 16px', margin: '16px 0', border: '1px solid rgba(0,194,255,0.1)', textAlign: 'left', overflowX: 'auto' },
    referralCode: { fontSize: '11px', color: '#00C2FF', wordBreak: 'break-all', fontFamily: 'monospace' },
    copyBtnPremium: { width: '100%', padding: '12px', background: 'rgba(0,194,255,0.06)', border: '1px solid rgba(0,194,255,0.15)', borderRadius: '14px', color: '#00C2FF', fontWeight: '600', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s ease' },

    // Stats
    statsHeading: { color: 'white', fontSize: '16px', fontWeight: '700', margin: '0 0 16px', textAlign: 'left' },
    statRowPremium: { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' },
    statLabelPremium: { color: 'rgba(255,255,255,0.5)', fontSize: '13px' },
    statValuePremium: { color: 'white', fontSize: '13px', fontWeight: '700' },

    // Bottom nav
    bottomNav: { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, display: 'flex', padding: '6px 12px', paddingBottom: 'calc(6px + env(safe-area-inset-bottom))', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(40px)', borderTop: '1px solid rgba(255,255,255,0.04)', gap: '4px' },
    navItem: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '12px', transition: 'all 0.3s ease' },
    navItemActive: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'rgba(0,194,255,0.05)', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '12px' },
    navItemIcon: { fontSize: '16px' },
    navItemLabel: { fontSize: '10px', fontWeight: '500', color: 'rgba(255,255,255,0.4)' },

    // Profile
    profileOverlay: { position: 'fixed', inset: 0, zIndex: 200, background: '#000000', display: 'flex', flexDirection: 'column' },
    profilePanel: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    profileHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(40px)', borderBottom: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 },
    profileHeaderTitle: { color: 'white', fontSize: '17px', fontWeight: '700' },
    backBtnPremium: { width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '50%', color: 'white', cursor: 'pointer' },
    profileBody: { flex: 1, overflowY: 'auto', paddingBottom: '20px' },
    profileAvatarSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px 10px' },
    profileAvatarRing: { padding: '3px', borderRadius: '50%', background: 'linear-gradient(135deg, #00C2FF, #FF3366)', marginBottom: '16px' },
    profileAvatarInner: { width: '84px', height: '84px', borderRadius: '50%', overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    profileAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    profileAvatarLetter: { fontSize: '36px', fontWeight: '700', color: 'white' },
    profileDisplayName: { fontSize: '22px', fontWeight: '800', color: 'white', margin: '0 0 6px', letterSpacing: '-0.5px' },
    profileDisplaySub: { fontSize: '13px', color: 'rgba(255,255,255,0.35)', margin: 0 },

    // Balance duo
    balanceDuo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '10px 20px 6px' },
    balanceCardPremium: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,51,102,0.1)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
    balanceCardLabel: { fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '1px' },
    balanceCardAmount: { fontSize: '28px', fontWeight: '800', color: '#FF3366', letterSpacing: '-1px' },

    // Profile section
    profileSection: { padding: '8px 20px' },
    sectionLabel: { color: 'white', fontSize: '16px', fontWeight: '700', margin: '0 0 14px' },
    profileActionBtn: { width: '100%', padding: '14px 20px', marginBottom: '8px', background: 'rgba(0,194,255,0.04)', border: '1px solid rgba(0,194,255,0.1)', borderRadius: '14px', color: '#00C2FF', fontWeight: '700', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s ease' },

    // Wallet
    walletCard: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,136,204,0.04)', border: '1px solid rgba(0,136,204,0.12)', borderRadius: '14px', padding: '12px 16px' },
    walletCardLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
    walletDot: { width: '8px', height: '8px', borderRadius: '50%', background: '#0088CC', boxShadow: '0 0 10px rgba(0,136,204,0.5)' },
    walletLabel: { margin: 0, fontSize: '12px', color: '#0088CC', fontWeight: '600' },
    walletAddress: { margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' },
    walletDisconnectBtn: { background: 'rgba(255,51,102,0.08)', border: '1px solid rgba(255,51,102,0.15)', borderRadius: '10px', padding: '6px 14px', color: '#FF3366', fontSize: '11px', fontWeight: '600', cursor: 'pointer' },
    connectWalletPremium: { width: '100%', padding: '14px', background: 'rgba(0,136,204,0.04)', border: '1px solid rgba(0,136,204,0.12)', borderRadius: '14px', color: '#0088CC', fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease' },

    // My quests
    filterRowPremium: { display: 'flex', gap: '6px', marginBottom: '14px' },
    filterBtnPremium: { padding: '7px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', color: 'rgba(255,255,255,0.35)', fontSize: '11px', cursor: 'pointer', fontWeight: '500' },
    filterBtnActivePremium: { padding: '7px 14px', background: 'rgba(0,194,255,0.08)', border: '1px solid rgba(0,194,255,0.2)', borderRadius: '20px', color: '#00C2FF', fontSize: '11px', fontWeight: '700', cursor: 'pointer' },
    myQuestCardPremium: { display: 'flex', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', marginBottom: '8px' },
    myQuestAvatarBox: { width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
    myQuestAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    myQuestContent: { flex: 1 },
    myQuestTitlePremium: { margin: '0 0 4px', fontSize: '13px', fontWeight: '700', color: 'white' },
    myQuestDescPremium: { margin: '0 0 8px', fontSize: '11px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.3 },
    myQuestFooterPremium: { display: 'flex', alignItems: 'center', gap: '8px' },
    myQuestReward: { fontSize: '11px', fontWeight: '700', color: '#FF3366' },
    statusTag: { fontSize: '10px', padding: '2px 8px', borderRadius: '20px', fontWeight: '600' },
    rejectionReasonText: { margin: '6px 0 0', fontSize: '10px', color: '#FF3366', background: 'rgba(255,51,102,0.05)', padding: '4px 8px', borderRadius: '8px', display: 'inline-block' },
    emptySmallPremium: { textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.2)', fontSize: '13px', background: 'rgba(255,255,255,0.015)', borderRadius: '14px' },

    // Modal
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300 },
    sheetPremium: { background: 'rgba(10,10,20,0.98)', backdropFilter: 'blur(60px)', borderRadius: '24px 24px 0 0', padding: '24px', width: '100%', maxWidth: '480px', border: '1px solid rgba(255,255,255,0.06)', borderBottom: 'none', boxSizing: 'border-box' },
    sheetHeaderPremium: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: 'white', fontSize: '18px', fontWeight: '800' },
    closePremium: { marginLeft: 'auto', background: 'rgba(255,255,255,0.04)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '14px', cursor: 'pointer' },
    textSecondary: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 16px' },
    inputPremium: { width: '100%', padding: '13px 16px', marginBottom: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', color: 'white', fontSize: '13px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' },
    textareaPremium: { width: '100%', padding: '13px 16px', marginBottom: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', color: 'white', fontSize: '13px', boxSizing: 'border-box', minHeight: '80px', fontFamily: 'inherit', resize: 'vertical', outline: 'none' },
    selectPremium: { width: '100%', padding: '13px 16px', marginBottom: '16px', background: 'rgba(10,10,20,0.98)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', color: 'white', fontSize: '13px', boxSizing: 'border-box', cursor: 'pointer', outline: 'none' },
    amountGridPremium: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' },
    amountBtnPremium: { padding: '12px 6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s ease' },
    amountBtnActivePremium: { padding: '12px 6px', background: 'rgba(0,194,255,0.08)', border: '1px solid rgba(0,194,255,0.25)', borderRadius: '12px', color: '#00C2FF', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 0 20px rgba(0,194,255,0.1)' },
    doubleButton: { display: 'flex', gap: '8px', marginTop: '16px' },
    btnPrimaryPremium: { flex: 1, padding: '14px', background: 'rgba(0,194,255,0.08)', border: '1px solid rgba(0,194,255,0.2)', borderRadius: '14px', color: '#00C2FF', fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease' },
    btnSecondaryPremium: { flex: 1, padding: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: '14px', cursor: 'pointer' },
    btnDangerPremium: { flex: 1, padding: '14px', background: 'rgba(255,51,102,0.1)', border: '1px solid rgba(255,51,102,0.2)', borderRadius: '14px', color: '#FF3366', fontWeight: '700', fontSize: '14px', cursor: 'pointer' },

    // Payment
    paymentWaitingPremium: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px', gap: '20px' },
    spinnerPremium: { width: '56px', height: '56px', borderRadius: '50%', border: '2px solid rgba(0,194,255,0.08)', borderTop: '2px solid #00C2FF', animation: 'spin 1s linear infinite' },
    paymentSuccessPremium: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', gap: '8px', textAlign: 'center' },
    loadingTextPremium: { color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '12px' },

    // Admin
    adminPanel: { background: 'rgba(10,10,20,0.99)', backdropFilter: 'blur(60px)', borderRadius: '24px 24px 0 0', padding: '24px', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderBottom: 'none', boxSizing: 'border-box' },
    adminHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' },
    adminHeaderLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
    adminHeaderIcon: { fontSize: '20px' },
    adminHeaderTitle: { color: 'white', fontSize: '18px', fontWeight: '800' },
    adminTabsPremium: { display: 'flex', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '3px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.04)' },
    adminTab: { flex: 1, padding: '10px', background: 'transparent', border: 'none', borderRadius: '10px', color: 'rgba(255,255,255,0.35)', fontSize: '12px', cursor: 'pointer', fontWeight: '500', display: 'flex', justifyContent: 'center', gap: '8px', transition: 'all 0.3s ease' },
    adminTabActive: { flex: 1, padding: '10px', background: 'rgba(0,194,255,0.08)', border: 'none', borderRadius: '10px', color: '#00C2FF', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px', boxShadow: '0 0 20px rgba(0,194,255,0.1)' },
    adminTabCount: { background: 'rgba(255,255,255,0.06)', borderRadius: '6px', padding: '0 6px', fontSize: '10px' },
    adminListArea: { display: 'flex', flexDirection: 'column', gap: '10px' },
    adminCardPremium: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px' },
    adminCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
    adminCardBadge: { fontSize: '10px', padding: '3px 8px', borderRadius: '20px', background: 'rgba(255,193,7,0.12)', color: '#FFC107', fontWeight: '600' },
    adminCardReward: { fontSize: '11px', fontWeight: '700', color: '#FF3366' },
    adminCardTitlePremium: { color: '#00C2FF', fontSize: '15px', fontWeight: '700', margin: '0 0 6px' },
    adminCardDescPremium: { color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '0 0 6px', lineHeight: 1.4 },
    adminCardAuthor: { color: 'rgba(255,255,255,0.25)', fontSize: '10px', margin: '0 0 4px' },
    adminCardLink: { color: 'rgba(0,194,255,0.3)', fontSize: '9px', margin: '0 0 10px', fontFamily: 'monospace', wordBreak: 'break-all' },
    adminCardActionsPremium: { display: 'flex', gap: '8px' },
    btnApprovePremium: { flex: 1, padding: '9px 14px', background: 'rgba(0,194,255,0.06)', border: '1px solid rgba(0,194,255,0.15)', borderRadius: '12px', color: '#00C2FF', fontWeight: '600', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', transition: 'all 0.2s ease' },
    btnRejectPremium: { flex: 1, padding: '9px 14px', background: 'rgba(255,51,102,0.06)', border: '1px solid rgba(255,51,102,0.15)', borderRadius: '12px', color: '#FF3366', fontWeight: '600', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', transition: 'all 0.2s ease' },
    btnDeactivatePremium: { width: '100%', padding: '9px 14px', background: 'rgba(255,51,102,0.04)', border: '1px solid rgba(255,51,102,0.1)', borderRadius: '12px', color: '#FF3366', fontWeight: '600', fontSize: '12px', cursor: 'pointer', marginTop: '10px', transition: 'all 0.2s ease' },
    adminCardStats: { marginBottom: '6px' },
    progressBar: { height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', marginBottom: '4px' },
    progressFill: { height: '100%', background: 'linear-gradient(90deg, #00C2FF, #FF3366)', borderRadius: '2px', transition: 'width 0.5s ease' },
    progressLabel: { fontSize: '10px', color: 'rgba(255,255,255,0.3)' },
    emptyPremium: { textAlign: 'center', padding: '40px 20px' },
    emptyPremiumIcon: { fontSize: '36px', display: 'block', marginBottom: '12px', opacity: 0.3 },
    emptyPremiumText: { color: 'rgba(255,255,255,0.25)', fontSize: '13px' },
};

// Global styles
const styleSheet = document.createElement("style");
styleSheet.textContent = `
    *, *::before, *::after { box-sizing: border-box; }
    html, body, #root { margin: 0; padding: 0; height: 100%; background: #000000; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
    input:focus, textarea:focus, select:focus { border-color: rgba(0,194,255,0.3) !important; }
    select, select option { background: rgba(10,10,20,0.99); color: white; }
    button { -webkit-tap-highlight-color: transparent; outline: none; font-family: inherit; cursor: pointer; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    button:not(:disabled):hover { filter: brightness(1.1); }
    button:not(:disabled):active { transform: scale(0.97); }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
    @keyframes loadbar { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes cardEntrance { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
    .fadeInUp { animation: fadeInUp 0.5s ease both; }
    .cardEntrance { animation: cardEntrance 0.4s ease both; }
    ::-webkit-scrollbar { width: 0; }
`;
document.head.appendChild(styleSheet);

export default App;