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
        try {
            const response = await axios.post(`${API_URL}/api/admin/approve-quest/${questId}`, { adminId: Number(userId) });
            if (response.data.success) {
                fetchPendingQuests(); fetchActiveQuests();
                window.Telegram.WebApp.showPopup({ title: '✅ Одобрено', message: response.data.message || 'Задание опубликовано', buttons: [{ type: 'ok' }] });
            }
        } catch (error) {
            window.Telegram.WebApp.showPopup({ title: 'Ошибка', message: error.response?.data?.error || 'Не удалось одобрить', buttons: [{ type: 'ok' }] });
        }
    };

    const openRejectModal = (questId) => { setCurrentQuestId(questId); setSelectedRejectReason(''); setCustomRejectReason(''); setShowRejectModal(true); };

    const handleRejectSubmit = async () => {
        const finalReason = selectedRejectReason === 'Другая причина' ? customRejectReason : selectedRejectReason;
        if (!finalReason) { window.Telegram.WebApp.showPopup({ title: 'Ошибка', message: 'Выберите причину', buttons: [{ type: 'ok' }] }); return; }
        try {
            const response = await axios.post(`${API_URL}/api/admin/reject-quest/${currentQuestId}`, { adminId: Number(userId), reason: finalReason });
            if (response.data.success) { fetchPendingQuests(); setShowRejectModal(false); window.Telegram.WebApp.showPopup({ title: '❌ Отклонено', message: 'Задание отклонено', buttons: [{ type: 'ok' }] }); }
        } catch (error) { window.Telegram.WebApp.showPopup({ title: 'Ошибка', message: error.response?.data?.error || 'Ошибка', buttons: [{ type: 'ok' }] }); }
    };

    const deactivateQuest = (questId) => {
        window.Telegram.WebApp.showPopup({ title: '⚠️ Снять с публикации', message: 'Задание будет скрыто. Продолжить?', buttons: [{ type: 'ok', text: 'Да, снять' }, { type: 'cancel', text: 'Отмена' }] }, async (buttonId) => {
            if (buttonId === 'ok') {
                try {
                    const response = await axios.post(`${API_URL}/api/admin/deactivate-quest/${questId}`, { adminId: Number(userId) });
                    if (response.data.success) { await fetchActiveQuests(); window.Telegram.WebApp.showPopup({ title: '✅ Снято', message: 'Задание скрыто', buttons: [{ type: 'ok' }] }); }
                } catch (error) { window.Telegram.WebApp.showPopup({ title: 'Ошибка', message: error.response?.data?.error || 'Ошибка', buttons: [{ type: 'ok' }] }); }
            }
        });
    };

    if (loading) return (
        <div style={st.modalOverlay}>
            <div style={st.adminPanel}>
                <div style={st.spinnerLarge}></div>
                <p style={{color:'rgba(255,255,255,0.5)', textAlign:'center', marginTop:'16px'}}>Загрузка...</p>
            </div>
        </div>
    );

    return (
        <>
            <div style={st.modalOverlay}>
                <div style={st.adminPanel}>
                    <div style={st.sheetHeader}>
                        <h3 style={st.sheetTitle}>🛡️ Админ-панель</h3>
                        <button onClick={onClose} style={st.closeCircle}>✕</button>
                    </div>
                    <div style={st.pillGroup}>
                        <button onClick={() => setAdminTab('pending')} style={adminTab === 'pending' ? st.pillActive : st.pill}>⏳ На модерации <span style={st.pillBadge}>{pendingQuests.length}</span></button>
                        <button onClick={() => setAdminTab('active')} style={adminTab === 'active' ? st.pillActive : st.pill}>✅ Активные <span style={st.pillBadge}>{activeQuests.length}</span></button>
                    </div>
                    <div style={st.adminList}>
                        {adminTab === 'pending' && (pendingQuests.length === 0 ? <div style={st.emptyBlock}><span>📭</span><p>Нет заданий на модерацию</p></div> :
                            pendingQuests.map(quest => (
                                <div key={quest.id} style={st.adminCard}>
                                    <strong style={st.adminCardTitle}>{quest.title}</strong>
                                    <p style={st.adminCardDesc}>{quest.description}</p>
                                    <p style={st.adminCardReward}>+{quest.reward} ⭐ · от @{quest.creator_name}</p>
                                    <p style={st.adminCardUrl}>{quest.target_url}</p>
                                    <div style={st.rowBtns}>
                                        <button onClick={() => approveQuest(quest.id)} style={st.btnApprove}>✅ Одобрить</button>
                                        <button onClick={() => openRejectModal(quest.id)} style={st.btnReject}>❌ Отклонить</button>
                                    </div>
                                </div>
                            ))
                        )}
                        {adminTab === 'active' && (activeQuests.length === 0 ? <div style={st.emptyBlock}><span>🎯</span><p>Нет активных заданий</p></div> :
                            activeQuests.map(quest => (
                                <div key={quest.id} style={st.adminCard}>
                                    <strong style={st.adminCardTitle}>{quest.title}</strong>
                                    <p style={st.adminCardDesc}>{quest.description}</p>
                                    <p style={st.adminCardReward}>+{quest.reward} ⭐ · от @{quest.creator_name}</p>
                                    <p style={{...st.adminCardReward, color: '#4ECDC4'}}>Выполнено: {quest.budget - quest.remaining} / {quest.budget}</p>
                                    <button onClick={() => deactivateQuest(quest.id)} style={st.btnDeactivate}>❌ Снять с публикации</button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
            {showRejectModal && (
                <div style={st.modalOverlay}>
                    <div style={st.sheet}>
                        <div style={st.sheetHeader}>
                            <h3 style={st.sheetTitle}>❌ Причина отклонения</h3>
                            <button onClick={() => setShowRejectModal(false)} style={st.closeCircle}>✕</button>
                        </div>
                        <select value={selectedRejectReason} onChange={(e) => setSelectedRejectReason(e.target.value)} style={st.select}>
                            <option value="">— Выберите причину —</option>
                            {rejectReasons.map((r, i) => <option key={i} value={r}>{r}</option>)}
                        </select>
                        {selectedRejectReason === 'Другая причина' && (
                            <textarea placeholder="Укажите причину..." value={customRejectReason} onChange={(e) => setCustomRejectReason(e.target.value)} style={st.textarea} rows={3} />
                        )}
                        <div style={st.rowBtns}>
                            <button onClick={() => setShowRejectModal(false)} style={st.btnGhost}>Отмена</button>
                            <button onClick={handleRejectSubmit} style={st.btnDanger}>Отклонить</button>
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
        tg.setHeaderColor('#0a0a14'); tg.setBackgroundColor('#0a0a14');
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
        const colors = ['#FF2D95', '#00D4FF', '#9D4EDD', '#FF6B35', '#00F5FF', '#7B2FF7'];
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
            <div style={st.loadingGlow}></div>
            <div style={st.loadingLogo}>
                <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
                    <path d="M16 2L19.5 10.5L28 12L21.5 18L23.5 26.5L16 22L8.5 26.5L10.5 18L4 12L12.5 10.5L16 2Z" fill="url(#lg)" stroke="#00D4FF" strokeWidth="1"/>
                    <defs><linearGradient id="lg" x1="0" y1="0" x2="32" y2="32"><stop stopColor="#00D4FF"/><stop offset="1" stopColor="#FF2D95"/></linearGradient></defs>
                </svg>
            </div>
            <p style={st.loadingLabel}>StarTask</p>
            <div style={st.loadingBar}><div style={st.loadingBarFill}></div></div>
        </div>
    );

    // ---- PROFILE ----
    if (showProfile) return (
        <div style={st.screen}>
            <div style={st.bgGlow1}></div>
            <div style={st.bgGlow2}></div>

            <div style={st.profileHeader}>
                <button onClick={() => setShowProfile(false)} style={st.backBtn}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                </button>
                <span style={st.profileHeaderTitle}>Профиль</span>
                <div style={{width:36}}></div>
            </div>

            <div style={st.profileScroll}>
                {/* Avatar */}
                <div style={st.profileHero}>
                    <div style={st.avatarWrapper}>
                        <div style={st.avatarGlow}></div>
                        <div style={st.avatarInner}>
                            {user?.photo_url
                                ? <img src={user.photo_url} alt="avatar" style={st.avatarImg} />
                                : <span style={st.avatarLetter}>{user?.username?.charAt(0).toUpperCase() || '👤'}</span>
                            }
                        </div>
                    </div>
                    <h2 style={st.profileName}>{user?.first_name || user?.username}</h2>
                    <p style={st.profileSub}>@{user?.username} · ID {user?.telegram_id}</p>
                </div>

                {/* Balance cards */}
                <div style={st.balanceRow}>
                    <div style={st.balanceCard}>
                        <span style={st.balanceIcon}>⭐</span>
                        <span style={st.balanceLabel}>Stars</span>
                        <strong style={st.balanceValue}>{balance}</strong>
                    </div>
                    <div style={{...st.balanceCard, borderColor: 'rgba(41,182,246,0.2)'}}>
                        <span style={st.balanceIcon}>💎</span>
                        <span style={st.balanceLabel}>TON</span>
                        <strong style={{...st.balanceValue, color: '#29B6F6'}}>{parseFloat(tonBalance || 0).toFixed(3)}</strong>
                    </div>
                </div>

                {/* Wallet */}
                <div style={st.section}>
                    {wallet ? (
                        <div style={st.walletChip}>
                            <div style={st.walletChipLeft}>
                                <span style={st.walletDot}></span>
                                <div>
                                    <p style={st.walletLabel}>TON кошелёк</p>
                                    <p style={st.walletAddr}>{getFriendlyAddress()}</p>
                                </div>
                            </div>
                            <button onClick={() => tonConnectUI.disconnect()} style={st.walletDisconnect}>Отключить</button>
                        </div>
                    ) : (
                        <button onClick={() => tonConnectUI.openModal()} style={st.connectWalletBtn}>
                            💎 Подключить TON кошелёк
                        </button>
                    )}
                </div>

                {/* Actions */}
                <div style={st.section}>
                    <button onClick={() => setShowCreateForm(true)} style={st.actionBtn}>
                        <span>✨</span> Создать задание
                    </button>
                    <button onClick={() => setShowTopUpModal(true)} style={{...st.actionBtn, color: '#FFD200', borderColor: 'rgba(255,210,0,0.25)'}}>
                        <span>⭐</span> Пополнить Stars
                    </button>
                    <button onClick={() => setShowTonTopUpModal(true)} style={{...st.actionBtn, color: '#29B6F6', borderColor: 'rgba(41,182,246,0.25)'}}>
                        <span>💎</span> Пополнить TON
                    </button>
                    {user?.telegram_id && String(user.telegram_id) === "850997324" && (
                        <button onClick={() => setShowAdminPanel(true)} style={{...st.actionBtn, color: '#FF2D95', borderColor: 'rgba(255,45,149,0.25)'}}>
                            <span>🛡️</span> Панель администратора
                        </button>
                    )}
                </div>

                {/* My quests */}
                {myQuests.length > 0 && (
                    <div style={st.section}>
                        <h3 style={st.sectionTitle}>Мои задания</h3>
                        <div style={st.pillGroup}>
                            {[['pending','⏳ Модерация'], ['active','✅ Принято'], ['rejected','❌ Отклонено']].map(([val, label]) => (
                                <button key={val} onClick={() => setQuestStatusFilter(val)} style={questStatusFilter === val ? st.pillActive : st.pill}>
                                    {label} <span style={st.pillBadge}>{myQuests.filter(q => q.status === val).length}</span>
                                </button>
                            ))}
                        </div>
                        {myQuests.filter(q => q.status === questStatusFilter).length === 0
                            ? <div style={st.emptyBlock}><p>Нет заданий в этой категории</p></div>
                            : myQuests.filter(q => q.status === questStatusFilter).map(quest => (
                                <div key={quest.id} style={st.myQuestCard}>
                                    <div style={{...st.myQuestAvatar, background: channelAvatars[quest.id] ? 'transparent' : getChannelColor(quest.title)}}>
                                        {channelAvatars[quest.id]
                                            ? <img src={channelAvatars[quest.id]} alt="" style={st.myQuestAvatarImg} />
                                            : <span style={{fontSize:'18px'}}>{getChannelInitial(quest.title, quest.target_url)}</span>
                                        }
                                    </div>
                                    <div style={st.myQuestBody}>
                                        <p style={st.myQuestTitle}>{quest.title}</p>
                                        <p style={st.myQuestDesc}>{quest.description}</p>
                                        <div style={st.myQuestMeta}>
                                            <span style={st.rewardBadge}>+{quest.reward} ⭐</span>
                                            <span style={{
                                                ...st.statusBadge,
                                                ...(quest.status === 'pending' && {background:'rgba(255,193,7,0.15)', color:'#FFC107'}),
                                                ...(quest.status === 'active' && {background:'rgba(76,175,80,0.15)', color:'#4CAF50'}),
                                                ...(quest.status === 'rejected' && {background:'rgba(244,67,54,0.15)', color:'#F44336'}),
                                            }}>
                                                {quest.status === 'pending' && '⏳ На модерации'}
                                                {quest.status === 'active' && '✅ Опубликовано'}
                                                {quest.status === 'rejected' && '❌ Отклонено'}
                                                {quest.status === 'inactive' && '📦 Снято'}
                                            </span>
                                        </div>
                                        {quest.status === 'rejected' && quest.rejection_reason && (
                                            <p style={st.rejectReason}>📝 {quest.rejection_reason}</p>
                                        )}
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                )}
            </div>

            {/* Modals */}
            {showCreateForm && (
                <div style={st.modalOverlay}>
                    <div style={st.sheet}>
                        <div style={st.sheetHeader}>
                            <h3 style={st.sheetTitle}>✨ Создать задание</h3>
                            <button onClick={() => setShowCreateForm(false)} style={st.closeCircle}>✕</button>
                        </div>
                        <input type="text" placeholder="Ссылка на канал (t.me/...)" style={st.input} ref={channelInput} />
                        <input type="text" placeholder="Название задания" style={st.input} ref={titleInput} />
                        <textarea placeholder="Описание задания" style={st.textarea} ref={descInput} />
                        <input type="number" placeholder="Награда (Stars)" style={st.input} ref={rewardInput} />
                        <button onClick={createQuest} style={st.btnPrimary}>➕ Создать задание</button>
                    </div>
                </div>
            )}

            {showTonTopUpModal && (
                <div style={st.modalOverlay}>
                    <div style={st.sheet}>
                        <div style={st.sheetHeader}>
                            <h3 style={st.sheetTitle}>💎 Пополнение TON</h3>
                            <button onClick={() => { setShowTonTopUpModal(false); setTonPaymentStep('select'); }} style={st.closeCircle}>✕</button>
                        </div>
                        {tonPaymentStep === 'select' && <>
                            <p style={st.sheetSubtitle}>Выберите сумму:</p>
                            <div style={st.amountGrid}>
                                {[0.5, 1, 2, 5, 10, 20].map(amt => (
                                    <button key={amt} onClick={() => setTonTopUpAmount(amt)} style={tonTopUpAmount === amt ? st.amountBtnActive : st.amountBtn}>{amt} 💎</button>
                                ))}
                            </div>
                            <button onClick={sendTonPayment} style={{...st.btnPrimary, marginTop:'16px', color:'#29B6F6', borderColor:'rgba(41,182,246,0.4)'}}>Оплатить {tonTopUpAmount} TON</button>
                        </>}
                        {tonPaymentStep === 'waiting' && (
                            <div style={st.paymentWaiting}>
                                <div style={st.spinnerLarge}></div>
                                <p style={st.paymentWaitingText}>Ожидание подтверждения...</p>
                            </div>
                        )}
                        {tonPaymentStep === 'success' && (
                            <div style={st.paymentSuccess}>
                                <span style={{fontSize:'56px'}}>✅</span>
                                <p style={st.paymentSuccessTitle}>Баланс пополнен!</p>
                                <p style={st.paymentSuccessSub}>+{tonTopUpAmount} TON зачислено</p>
                                <button onClick={() => { setShowTonTopUpModal(false); setTonPaymentStep('select'); }} style={st.btnPrimary}>Готово</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showTopUpModal && (
                <div style={st.modalOverlay}>
                    <div style={st.sheet}>
                        <div style={st.sheetHeader}>
                            <h3 style={st.sheetTitle}>⭐ Пополнение Stars</h3>
                            <button onClick={() => setShowTopUpModal(false)} style={st.closeCircle}>✕</button>
                        </div>
                        <p style={st.sheetSubtitle}>Выберите сумму:</p>
                        <div style={st.amountGrid}>
                            {[1, 50, 100, 250, 500, 1000].map(amt => (
                                <button key={amt} onClick={() => setTopUpAmount(amt)} style={topUpAmount === amt ? st.amountBtnActive : st.amountBtn}>{amt} ⭐</button>
                            ))}
                        </div>
                        <div style={st.rowBtns}>
                            <button onClick={() => setShowTopUpModal(false)} style={st.btnGhost}>Отмена</button>
                            <button onClick={createInvoice} style={st.btnPrimary}>Оплатить</button>
                        </div>
                    </div>
                </div>
            )}

            {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} userId={user?.telegram_id} />}
        </div>
    );

    // ---- MAIN ----
    return (
        <div style={st.screen}>
            <div style={st.bgGlow1}></div>
            <div style={st.bgGlow2}></div>

            {/* Header */}
            <div style={st.header}>
                <button style={st.logoBtn} onClick={() => window.Telegram.WebApp.openLink('https://t.me/startask_official')}>
                    <div style={st.logoMark}>
                        <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                            <path d="M16 2L19.5 10.5L28 12L21.5 18L23.5 26.5L16 22L8.5 26.5L10.5 18L4 12L12.5 10.5L16 2Z" fill="url(#hg)" stroke="#00D4FF" strokeWidth="1"/>
                            <defs><linearGradient id="hg" x1="0" y1="0" x2="32" y2="32"><stop stopColor="#00D4FF"/><stop offset="1" stopColor="#FF2D95"/></linearGradient></defs>
                        </svg>
                    </div>
                    <span style={st.logoText}>StarTask</span>
                </button>

                <button style={st.userChip} onClick={() => setShowProfile(true)}>
                    <div style={st.userChipBalances}>
                        <span style={st.chipStars}>⭐ {balance}</span>
                        <span style={st.chipTon}>💎 {parseFloat(tonBalance||0).toFixed(2)}</span>
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
            <div style={st.scrollArea}>
                {mainTab === 'tasks' && (
                    <>
                        <div style={st.pillGroup}>
                            <button onClick={() => setActiveTab('active')} style={activeTab === 'active' ? st.pillActive : st.pill}>
                                Активные <span style={st.pillBadge}>{activeTasks.length}</span>
                            </button>
                            <button onClick={() => setActiveTab('completed')} style={activeTab === 'completed' ? st.pillActive : st.pill}>
                                Выполненные <span style={st.pillBadge}>{completedTasks.length}</span>
                            </button>
                        </div>

                        {activeTab === 'active' && (
                            activeTasks.length === 0
                                ? <div style={st.emptyState}>
                                    <span style={st.emptyEmoji}>🎉</span>
                                    <h3 style={st.emptyTitle}>Все задания выполнены!</h3>
                                    <p style={st.emptyText}>Новые появятся скоро</p>
                                </div>
                                : activeTasks.map(task => (
                                    <div key={task.id} style={st.taskCard} className="taskCard">
                                        <div style={{...st.taskAvatar, background: channelAvatars[task.id] ? 'transparent' : getChannelColor(task.title)}}>
                                            {channelAvatars[task.id]
                                                ? <img src={channelAvatars[task.id]} alt="" style={st.taskAvatarImg} />
                                                : <span style={st.taskAvatarLetter}>{getChannelInitial(task.title, task.target_url)}</span>
                                            }
                                        </div>
                                        <div style={st.taskBody}>
                                            <p style={st.taskTitle}>{task.title}</p>
                                            <p style={st.taskDesc}>{task.description}</p>
                                            <div style={st.taskFooter}>
                                                <span style={st.rewardBadge}>+{task.reward} ⭐</span>
                                                <button onClick={() => completeTask(task.id, task.target_url, task.target_url.split('t.me/')[1])} style={st.doBtn}>Выполнить →</button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                        )}

                        {activeTab === 'completed' && (
                            completedTasks.length === 0
                                ? <div style={st.emptyState}><span style={st.emptyEmoji}>📭</span><h3 style={st.emptyTitle}>Нет выполненных</h3><p style={st.emptyText}>Выполните задания чтобы они появились здесь</p></div>
                                : completedTasks.map(task => (
                                    <div key={task.id} style={{...st.taskCard, opacity: 0.6}}>
                                        <div style={{...st.taskAvatar, background: channelAvatars[task.id] ? 'transparent' : getChannelColor(task.title)}}>
                                            {channelAvatars[task.id] ? <img src={channelAvatars[task.id]} alt="" style={st.taskAvatarImg} /> : <span style={st.taskAvatarLetter}>{getChannelInitial(task.title, task.target_url)}</span>}
                                        </div>
                                        <div style={st.taskBody}>
                                            <p style={st.taskTitle}>{task.title}</p>
                                            <p style={st.taskDesc}>{task.description}</p>
                                            <div style={st.taskFooter}>
                                                <span style={{...st.rewardBadge, background:'rgba(157,78,221,0.15)', color:'#9D4EDD', borderColor:'rgba(157,78,221,0.25)'}}>✅ +{task.reward} ⭐</span>
                                                <span style={st.completedLabel}>Выполнено</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                        )}
                    </>
                )}

                {mainTab === 'referral' && (
                    <>
                        <div style={st.glassCard}>
                            <span style={st.glassCardIcon}>👥</span>
                            <h3 style={st.glassCardTitle}>Партнёрская программа</h3>
                            <p style={st.glassCardText}>Приглашайте друзей и получайте <strong style={{color:'#FF2D95'}}>10%</strong> от их заработка!</p>
                            <div style={st.refLinkBox}>
                                <code style={st.refLink}>{getReferralLink()}</code>
                            </div>
                            <button onClick={copyReferralLink} style={st.copyBtn}>📋 Скопировать ссылку</button>
                        </div>
                        <div style={st.glassCard}>
                            <h4 style={st.statsTitle}>Ваша статистика</h4>
                            <div style={st.statRow}><span>👥 Приглашено друзей</span><strong>0</strong></div>
                            <div style={st.statRow}><span>💰 Заработано комиссии</span><strong>0 ⭐</strong></div>
                        </div>
                    </>
                )}

                {mainTab === 'info' && (
                    <>
                        {[
                            { icon: '⭐', title: 'Что такое StarTask?', text: 'StarTask — платформа для заработка Telegram Stars и TON на выполнении простых заданий.' },
                            { icon: '💡', title: 'Как заработать?', text: 'Выберите задание → Выполните действие → Получите вознаграждение мгновенно!' },
                            { icon: '🤝', title: 'Партнёрская программа', text: 'Приглашайте друзей и получайте 10% от каждого их заработка.' },
                        ].map(({ icon, title, text }) => (
                            <div key={title} style={st.glassCard}>
                                <span style={st.glassCardIcon}>{icon}</span>
                                <h3 style={st.glassCardTitle}>{title}</h3>
                                <p style={st.glassCardText}>{text}</p>
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Bottom nav */}
            <div style={st.bottomNav}>
                {[
                    { id: 'tasks', icon: '📋', label: 'Задания' },
                    { id: 'referral', icon: '👥', label: 'Партнёры' },
                    { id: 'info', icon: 'ℹ️', label: 'О проекте' },
                ].map(({ id, icon, label }) => (
                    <button key={id} onClick={() => setMainTab(id)} style={mainTab === id ? st.navBtnActive : st.navBtn}>
                        <span style={st.navIcon}>{icon}</span>
                        <span style={st.navLabel}>{label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ============ STYLES ============
const st = {
    // Layout
    screen: { minHeight: '100vh', position: 'relative', overflowX: 'hidden', fontFamily: "'SF Pro Display', -apple-system, 'Helvetica Neue', sans-serif", background: '#0a0a14' },
    bgGlow1: { position: 'fixed', top: '-30vh', left: '-30vw', width: '80vw', height: '80vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none', filter: 'blur(60px)' },
    bgGlow2: { position: 'fixed', bottom: '-20vh', right: '-20vw', width: '70vw', height: '70vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,45,149,0.05) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none', filter: 'blur(60px)' },

    // Loading
    loadingScreen: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a14', gap: '16px' },
    loadingGlow: { position: 'absolute', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,0.1) 0%, transparent 70%)', filter: 'blur(40px)' },
    loadingLogo: { width: '72px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,212,255,0.06)', borderRadius: '50%', border: '1px solid rgba(0,212,255,0.2)', boxShadow: '0 0 50px rgba(0,212,255,0.12)', animation: 'pulse 2.5s ease infinite' },
    loadingLabel: { color: 'white', fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px', background: 'linear-gradient(135deg, #00D4FF, #FF2D95)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 },
    loadingBar: { width: '100px', height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '10px', overflow: 'hidden' },
    loadingBarFill: { height: '100%', width: '30%', background: 'linear-gradient(90deg, #00D4FF, #FF2D95)', borderRadius: '10px', animation: 'loadbar 1.5s ease infinite' },

    // Header
    header: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(10,10,20,0.6)', backdropFilter: 'blur(30px)', borderBottom: '1px solid rgba(255,255,255,0.04)' },
    logoBtn: { display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
    logoMark: { width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,212,255,0.06)', borderRadius: '50%', border: '1px solid rgba(0,212,255,0.2)' },
    logoText: { fontSize: '19px', fontWeight: '800', background: 'linear-gradient(135deg, #00D4FF 0%, #FF2D95 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' },
    userChip: { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '50px', padding: '5px 5px 5px 12px', cursor: 'pointer' },
    userChipBalances: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' },
    chipStars: { fontSize: '10px', fontWeight: '600', color: '#00D4FF' },
    chipTon: { fontSize: '10px', fontWeight: '600', color: '#29B6F6' },
    chipAvatar: { width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(0,212,255,0.1)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(0,212,255,0.25)' },
    chipAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    chipAvatarLetter: { color: '#00D4FF', fontWeight: '700', fontSize: '13px' },

    // Scroll
    scrollArea: { position: 'relative', zIndex: 1, padding: '72px 14px 90px', minHeight: '100vh', boxSizing: 'border-box' },

    // Pill group
    pillGroup: { display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)', borderRadius: '50px', padding: '4px', border: '1px solid rgba(255,255,255,0.04)' },
    pill: { flex: 1, padding: '9px 10px', background: 'transparent', border: 'none', borderRadius: '50px', color: 'rgba(255,255,255,0.4)', fontSize: '12px', cursor: 'pointer', fontWeight: '500', whiteSpace: 'nowrap', transition: 'all 0.2s ease' },
    pillActive: { flex: 1, padding: '9px 10px', background: 'rgba(0,212,255,0.1)', border: 'none', borderRadius: '50px', color: '#00D4FF', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 12px rgba(0,212,255,0.1)' },
    pillBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.08)', borderRadius: '50px', fontSize: '10px', padding: '1px 7px', marginLeft: '5px' },

    // Task cards
    taskCard: { background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '14px', display: 'flex', gap: '12px', marginBottom: '10px', transition: 'all 0.2s ease' },
    taskAvatar: { width: '46px', height: '46px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
    taskAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    taskAvatarLetter: { fontSize: '20px', fontWeight: '700', color: 'white' },
    taskBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' },
    taskTitle: { margin: 0, fontSize: '15px', fontWeight: '700', color: 'white' },
    taskDesc: { margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 },
    taskFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' },
    rewardBadge: { fontSize: '11px', fontWeight: '700', color: '#FF2D95', background: 'rgba(255,45,149,0.08)', border: '1px solid rgba(255,45,149,0.2)', borderRadius: '50px', padding: '3px 10px' },
    doBtn: { fontSize: '12px', fontWeight: '600', color: '#00D4FF', background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '50px', padding: '6px 14px', cursor: 'pointer', transition: 'all 0.2s ease' },
    completedLabel: { fontSize: '12px', color: 'rgba(255,255,255,0.25)' },

    // Empty state
    emptyState: { textAlign: 'center', padding: '50px 20px', background: 'rgba(255,255,255,0.015)', borderRadius: '28px', border: '1px solid rgba(255,255,255,0.04)' },
    emptyEmoji: { fontSize: '48px', marginBottom: '12px', display: 'block' },
    emptyTitle: { color: 'white', fontSize: '17px', fontWeight: '700', marginBottom: '6px' },
    emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: '13px', margin: 0 },

    // Glass cards
    glassCard: { background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '22px', marginBottom: '12px', textAlign: 'center' },
    glassCardIcon: { fontSize: '40px', marginBottom: '10px', display: 'block' },
    glassCardTitle: { color: 'white', fontSize: '17px', fontWeight: '700', margin: '0 0 8px' },
    glassCardText: { color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: 1.5, margin: 0 },
    refLinkBox: { background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '10px 14px', margin: '14px 0', border: '1px solid rgba(0,212,255,0.1)', textAlign: 'left', overflowX: 'auto' },
    refLink: { fontSize: '11px', color: '#00D4FF', wordBreak: 'break-all' },
    copyBtn: { width: '100%', padding: '12px', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '50px', color: '#00D4FF', fontWeight: '600', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s ease' },
    statsTitle: { color: 'white', fontSize: '16px', fontWeight: '700', margin: '0 0 14px', textAlign: 'left' },
    statRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', fontSize: '13px' },

    // Bottom nav
    bottomNav: { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, display: 'flex', padding: '8px 12px', paddingBottom: 'calc(8px + env(safe-area-inset-bottom))', background: 'rgba(10,10,20,0.8)', backdropFilter: 'blur(30px)', borderTop: '1px solid rgba(255,255,255,0.04)', gap: '6px' },
    navBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50px', transition: 'all 0.2s ease' },
    navBtnActive: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: 'rgba(0,212,255,0.06)', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50px' },
    navIcon: { fontSize: '16px' },
    navLabel: { fontSize: '9px', fontWeight: '500', color: 'rgba(255,255,255,0.5)' },

    // Profile
    profileHeader: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(10,10,20,0.6)', backdropFilter: 'blur(30px)', borderBottom: '1px solid rgba(255,255,255,0.04)' },
    profileHeaderTitle: { color: 'white', fontSize: '16px', fontWeight: '700' },
    backBtn: { width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: 'none', borderRadius: '50%', color: 'white', cursor: 'pointer' },
    profileScroll: { position: 'relative', zIndex: 1, paddingTop: '66px', paddingBottom: '20px' },
    profileHero: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px 8px' },
    avatarWrapper: { position: 'relative', marginBottom: '14px' },
    avatarGlow: { position: 'absolute', inset: '-12px', borderRadius: '50%', background: 'conic-gradient(from 0deg, rgba(0,212,255,0.3), rgba(255,45,149,0.3), rgba(0,212,255,0.3))', filter: 'blur(20px)', opacity: 0.5 },
    avatarInner: { width: '84px', height: '84px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(0,212,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(0,212,255,0.3)', position: 'relative', zIndex: 1 },
    avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    avatarLetter: { fontSize: '36px', fontWeight: '700', color: '#00D4FF' },
    profileName: { fontSize: '21px', fontWeight: '800', color: 'white', margin: '0 0 4px' },
    profileSub: { fontSize: '12px', color: 'rgba(255,255,255,0.35)', margin: 0 },

    // Balance
    balanceRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px 16px 4px' },
    balanceCard: { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(0,212,255,0.12)', borderRadius: '50px', padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
    balanceIcon: { fontSize: '20px' },
    balanceLabel: { fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
    balanceValue: { fontSize: '24px', fontWeight: '800', color: '#00D4FF' },

    // Section
    section: { padding: '6px 16px' },
    sectionTitle: { color: 'white', fontSize: '16px', fontWeight: '700', margin: '0 0 12px' },

    // Wallet
    walletChip: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(41,182,246,0.04)', border: '1px solid rgba(41,182,246,0.15)', borderRadius: '50px', padding: '10px 14px' },
    walletChipLeft: { display: 'flex', alignItems: 'center', gap: '8px' },
    walletDot: { width: '7px', height: '7px', borderRadius: '50%', background: '#29B6F6', boxShadow: '0 0 8px rgba(41,182,246,0.5)' },
    walletLabel: { margin: 0, fontSize: '11px', color: '#29B6F6', fontWeight: '600' },
    walletAddr: { margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' },
    walletDisconnect: { background: 'rgba(255,45,149,0.1)', border: '1px solid rgba(255,45,149,0.2)', borderRadius: '50px', padding: '5px 12px', color: '#FF2D95', fontSize: '11px', fontWeight: '600', cursor: 'pointer' },
    connectWalletBtn: { width: '100%', padding: '13px', background: 'rgba(41,182,246,0.06)', border: '1px solid rgba(41,182,246,0.2)', borderRadius: '50px', color: '#29B6F6', fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease' },

    // Action buttons
    actionBtn: { width: '100%', padding: '13px 18px', marginBottom: '8px', background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: '50px', color: '#00D4FF', fontWeight: '700', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease' },

    // My quests
    myQuestCard: { display: 'flex', gap: '10px', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '20px', marginBottom: '8px' },
    myQuestAvatar: { width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
    myQuestAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    myQuestBody: { flex: 1 },
    myQuestTitle: { margin: '0 0 3px', fontSize: '13px', fontWeight: '700', color: 'white' },
    myQuestDesc: { margin: '0 0 6px', fontSize: '11px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.3 },
    myQuestMeta: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
    statusBadge: { fontSize: '10px', padding: '3px 8px', borderRadius: '50px' },
    rejectReason: { margin: '5px 0 0', fontSize: '10px', color: '#FF2D95', background: 'rgba(255,45,149,0.06)', padding: '3px 8px', borderRadius: '50px', display: 'inline-block' },
    emptyBlock: { textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.25)', fontSize: '13px', background: 'rgba(255,255,255,0.015)', borderRadius: '20px' },

    // Modal / Sheet
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300 },
    sheet: { background: 'rgba(16,16,30,0.98)', backdropFilter: 'blur(40px)', borderRadius: '28px 28px 0 0', padding: '22px', width: '100%', maxWidth: '480px', border: '1px solid rgba(255,255,255,0.05)', borderBottom: 'none', boxSizing: 'border-box' },
    sheetHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' },
    sheetTitle: { color: 'white', fontSize: '17px', fontWeight: '800', margin: 0 },
    sheetSubtitle: { color: 'rgba(255,255,255,0.35)', fontSize: '12px', marginBottom: '14px', margin: '0 0 14px' },
    closeCircle: { background: 'rgba(255,255,255,0.04)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '14px', cursor: 'pointer' },

    // Form
    input: { width: '100%', padding: '12px 14px', marginBottom: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50px', color: 'white', fontSize: '13px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' },
    textarea: { width: '100%', padding: '12px 14px', marginBottom: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', color: 'white', fontSize: '13px', boxSizing: 'border-box', minHeight: '80px', fontFamily: 'inherit', resize: 'vertical', outline: 'none' },
    select: { width: '100%', padding: '12px 14px', marginBottom: '14px', background: 'rgba(16,16,30,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50px', color: 'white', fontSize: '13px', boxSizing: 'border-box', cursor: 'pointer', outline: 'none' },

    // Buttons
    btnPrimary: { width: '100%', padding: '13px', background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(255,45,149,0.1))', border: '1px solid rgba(0,212,255,0.35)', borderRadius: '50px', color: '#00D4FF', fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease', marginTop: '4px' },
    btnGhost: { flex: 1, padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50px', color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
    btnDanger: { flex: 1, padding: '12px', background: 'rgba(255,45,149,0.1)', border: '1px solid rgba(255,45,149,0.25)', borderRadius: '50px', color: '#FF2D95', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
    btnApprove: { flex: 1, padding: '8px 14px', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)', borderRadius: '50px', color: '#00D4FF', fontWeight: '600', fontSize: '12px', cursor: 'pointer' },
    btnReject: { flex: 1, padding: '8px 14px', background: 'rgba(255,45,149,0.08)', border: '1px solid rgba(255,45,149,0.25)', borderRadius: '50px', color: '#FF2D95', fontWeight: '600', fontSize: '12px', cursor: 'pointer' },
    btnDeactivate: { width: '100%', padding: '8px 14px', background: 'rgba(255,45,149,0.08)', border: '1px solid rgba(255,45,149,0.2)', borderRadius: '50px', color: '#FF2D95', fontWeight: '600', fontSize: '12px', cursor: 'pointer', marginTop: '8px' },
    rowBtns: { display: 'flex', gap: '8px', marginTop: '14px' },

    // Amount grid
    amountGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' },
    amountBtn: { padding: '11px 6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '50px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s ease' },
    amountBtnActive: { padding: '11px 6px', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.35)', borderRadius: '50px', color: '#00D4FF', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 0 14px rgba(0,212,255,0.1)' },

    // Payment
    paymentWaiting: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px', gap: '14px' },
    spinnerLarge: { width: '48px', height: '48px', border: '2px solid rgba(0,212,255,0.1)', borderTop: '2px solid #00D4FF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
    paymentWaitingText: { color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 },
    paymentSuccess: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', gap: '6px', textAlign: 'center' },
    paymentSuccessTitle: { color: 'white', fontSize: '19px', fontWeight: '800', margin: 0 },
    paymentSuccessSub: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 14px' },

    // Admin
    adminPanel: { background: 'rgba(14,14,28,0.98)', backdropFilter: 'blur(40px)', borderRadius: '28px 28px 0 0', padding: '22px', width: '100%', maxWidth: '480px', maxHeight: '80vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderBottom: 'none', boxSizing: 'border-box' },
    adminList: { display: 'flex', flexDirection: 'column', gap: '8px' },
    adminCard: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', padding: '12px' },
    adminCardTitle: { color: '#00D4FF', fontSize: '14px', display: 'block', marginBottom: '3px', fontWeight: '700' },
    adminCardDesc: { color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '0 0 4px', lineHeight: 1.3 },
    adminCardReward: { color: '#FF2D95', fontSize: '10px', margin: '0 0 2px' },
    adminCardUrl: { color: 'rgba(255,255,255,0.2)', fontSize: '9px', margin: '0 0 8px', wordBreak: 'break-all' },
};

// Global styles
const styleSheet = document.createElement("style");
styleSheet.textContent = `
    *, *::before, *::after { box-sizing: border-box; }
    html, body, #root { margin: 0; padding: 0; height: 100%; background: #0a0a14; }
    input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
    input:focus, textarea:focus, select:focus { border-color: rgba(0,212,255,0.35) !important; }
    select, select option { background: rgba(14,14,28,0.98); color: white; }
    button { -webkit-tap-highlight-color: transparent; outline: none; font-family: inherit; }
    .taskCard:active { transform: scale(0.98); }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.05); opacity: 1; } }
    @keyframes loadbar { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
    button:not(:disabled):hover { filter: brightness(1.15); }
    button:not(:disabled):active { transform: scale(0.96); }
    ::-webkit-scrollbar { width: 0; }
`;
document.head.appendChild(styleSheet);

export default App;