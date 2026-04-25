Вот ваш обновлённый файл `App.jsx`, в котором исходный код полностью заменён на предоставленный вами новый интерфейс:

```jsx
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
        <div style={s.modalOverlay}>
            <div style={s.adminPanel}>
                <div style={s.pulseLoader}><div style={s.pulseRing}></div><div style={s.pulseDot}></div></div>
            </div>
        </div>
    );

    return (
        <>
            <div style={s.modalOverlay}>
                <div style={s.adminPanel}>
                    <div style={s.modalHeader}>
                        <div style={s.modalTitleRow}>
                            <span style={s.modalIcon}>🛡️</span>
                            <h3 style={s.modalTitle}>Админ-панель</h3>
                        </div>
                        <button onClick={onClose} style={s.closeBtn}>✕</button>
                    </div>
                    <div style={s.segmentedControl}>
                        <button onClick={() => setAdminTab('pending')} style={adminTab === 'pending' ? s.segmentActive : s.segment}>⏳ На модерации <span style={s.badge}>{pendingQuests.length}</span></button>
                        <button onClick={() => setAdminTab('active')} style={adminTab === 'active' ? s.segmentActive : s.segment}>✅ Активные <span style={s.badge}>{activeQuests.length}</span></button>
                    </div>
                    <div style={s.adminListArea}>
                        {adminTab === 'pending' && (pendingQuests.length === 0 ? <div style={s.emptyAdmin}><span style={{fontSize:'32px'}}>📭</span><p>Нет заданий на модерацию</p></div> :
                            pendingQuests.map(quest => (
                                <div key={quest.id} style={s.adminCard}>
                                    <strong style={s.adminCardTitle}>{quest.title}</strong>
                                    <p style={s.adminCardDesc}>{quest.description}</p>
                                    <p style={s.adminCardMeta}>+{quest.reward} ⭐ · от @{quest.creator_name}</p>
                                    <p style={s.adminCardUrl}>{quest.target_url}</p>
                                    <div style={s.adminCardActions}>
                                        <button onClick={() => approveQuest(quest.id)} style={s.approveBtn}>✅ Одобрить</button>
                                        <button onClick={() => openRejectModal(quest.id)} style={s.rejectBtn}>❌ Отклонить</button>
                                    </div>
                                </div>
                            ))
                        )}
                        {adminTab === 'active' && (activeQuests.length === 0 ? <div style={s.emptyAdmin}><span style={{fontSize:'32px'}}>🎯</span><p>Нет активных заданий</p></div> :
                            activeQuests.map(quest => (
                                <div key={quest.id} style={s.adminCard}>
                                    <strong style={s.adminCardTitle}>{quest.title}</strong>
                                    <p style={s.adminCardDesc}>{quest.description}</p>
                                    <p style={s.adminCardMeta}>+{quest.reward} ⭐ · от @{quest.creator_name}</p>
                                    <p style={{...s.adminCardMeta, color: '#4ECDC4'}}>Выполнено: {quest.budget - quest.remaining} / {quest.budget}</p>
                                    <button onClick={() => deactivateQuest(quest.id)} style={s.deactivateBtn}>❌ Снять с публикации</button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
            {showRejectModal && (
                <div style={s.modalOverlay}>
                    <div style={s.sheet}>
                        <div style={s.modalHeader}>
                            <div style={s.modalTitleRow}><span style={s.modalIcon}>❌</span><h3 style={s.modalTitle}>Причина отклонения</h3></div>
                            <button onClick={() => setShowRejectModal(false)} style={s.closeBtn}>✕</button>
                        </div>
                        <select value={selectedRejectReason} onChange={(e) => setSelectedRejectReason(e.target.value)} style={s.select}>
                            <option value="">— Выберите причину —</option>
                            {rejectReasons.map((r, i) => <option key={i} value={r}>{r}</option>)}
                        </select>
                        {selectedRejectReason === 'Другая причина' && (
                            <textarea placeholder="Укажите причину..." value={customRejectReason} onChange={(e) => setCustomRejectReason(e.target.value)} style={s.textarea} rows={3} />
                        )}
                        <div style={s.rowBtns}>
                            <button onClick={() => setShowRejectModal(false)} style={s.ghostBtn}>Отмена</button>
                            <button onClick={handleRejectSubmit} style={s.dangerBtn}>Отклонить</button>
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
    const [mounted, setMounted] = useState(false);

    const [tonConnectUI] = useTonConnectUI();
    const wallet = useTonWallet();

    const titleInput = useRef(null);
    const descInput = useRef(null);
    const rewardInput = useRef(null);
    const channelInput = useRef(null);

    useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);

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
        tg.setHeaderColor('#060612'); tg.setBackgroundColor('#060612');
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
        <div style={s.loadingScreen}>
            <div style={s.loadingInner}>
                <div style={s.loadingLogo}>
                    <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
                        <path d="M16 2L19.5 10.5L28 12L21.5 18L23.5 26.5L16 22L8.5 26.5L10.5 18L4 12L12.5 10.5L16 2Z" fill="url(#lg)" stroke="#00D4FF" strokeWidth="1"/>
                        <defs><linearGradient id="lg" x1="0" y1="0" x2="32" y2="32"><stop stopColor="#00D4FF"/><stop offset="1" stopColor="#FF2D95"/></linearGradient></defs>
                    </svg>
                </div>
                <p style={s.loadingLabel}>StarTask</p>
                <div style={s.loadingBar}><div style={s.loadingBarFill}></div></div>
            </div>
        </div>
    );

    // ---- PROFILE ----
    if (showProfile) return (
        <div style={s.screen}>
            <div style={s.noiseBg}></div>
            <div style={s.aura1}></div>
            <div style={s.aura2}></div>

            <div style={s.profileHeader}>
                <button onClick={() => setShowProfile(false)} style={s.backBtn}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                </button>
                <span style={s.profileHeaderTitle}>Профиль</span>
                <div style={{width:36}}></div>
            </div>

            <div style={s.profileScroll}>
                {/* Avatar hero */}
                <div style={s.profileHero}>
                    <div style={s.profileAvatarWrap}>
                        <div style={s.avatarRing}></div>
                        <div style={s.profileAvatarInner}>
                            {user?.photo_url
                                ? <img src={user.photo_url} alt="avatar" style={s.profileAvatarImg} />
                                : <div style={s.profileAvatarPlaceholder}>{user?.username?.charAt(0).toUpperCase() || '👤'}</div>
                            }
                        </div>
                    </div>
                    <h2 style={s.profileName}>{user?.first_name || user?.username}</h2>
                    <p style={s.profileSub}>@{user?.username} · ID {user?.telegram_id}</p>
                </div>

                {/* Balance cards */}
                <div style={s.balanceGrid}>
                    <div style={s.balanceCard}>
                        <div style={s.balanceCardGlow} />
                        <span style={s.balanceCardIcon}>⭐</span>
                        <span style={s.balanceCardLabel}>Stars</span>
                        <strong style={s.balanceCardValue}>{balance}</strong>
                    </div>
                    <div style={{...s.balanceCard, ...s.balanceCardTon}}>
                        <div style={{...s.balanceCardGlow, ...s.balanceCardGlowTon}} />
                        <span style={s.balanceCardIcon}>💎</span>
                        <span style={s.balanceCardLabel}>TON</span>
                        <strong style={{...s.balanceCardValue, color: '#29B6F6'}}>{parseFloat(tonBalance || 0).toFixed(3)}</strong>
                    </div>
                </div>

                {/* Wallet */}
                <div style={s.section}>
                    {wallet ? (
                        <div style={s.walletChip}>
                            <div style={s.walletChipLeft}>
                                <span style={s.walletDot}></span>
                                <div>
                                    <p style={s.walletChipLabel}>TON кошелёк</p>
                                    <p style={s.walletChipAddr}>{getFriendlyAddress()}</p>
                                </div>
                            </div>
                            <button onClick={() => tonConnectUI.disconnect()} style={s.walletDisconnectBtn}>Отключить</button>
                        </div>
                    ) : (
                        <button onClick={() => tonConnectUI.openModal()} style={s.connectWalletBtn}>
                            <span style={s.connectWalletIcon}>💎</span>
                            Подключить TON кошелёк
                        </button>
                    )}
                </div>

                {/* Action buttons */}
                <div style={s.section}>
                    <button onClick={() => setShowCreateForm(true)} style={s.actionBtn}>
                        <span>✨</span> Создать задание
                    </button>
                    <button onClick={() => setShowTopUpModal(true)} style={{...s.actionBtn, ...s.actionBtnAlt}}>
                        <span>⭐</span> Пополнить Stars
                    </button>
                    <button onClick={() => setShowTonTopUpModal(true)} style={{...s.actionBtn, ...s.actionBtnTon}}>
                        <span>💎</span> Пополнить TON
                    </button>
                    {user?.telegram_id && String(user.telegram_id) === "850997324" && (
                        <button onClick={() => setShowAdminPanel(true)} style={{...s.actionBtn, ...s.actionBtnAdmin}}>
                            <span>🛡️</span> Панель администратора
                        </button>
                    )}
                </div>

                {/* My quests */}
                {myQuests.length > 0 && (
                    <div style={s.section}>
                        <h3 style={s.sectionTitle}>Мои задания</h3>
                        <div style={s.filterRow}>
                            {[['pending','⏳ Модерация'], ['active','✅ Принято'], ['rejected','❌ Отклонено']].map(([val, label]) => (
                                <button key={val} onClick={() => setQuestStatusFilter(val)} style={questStatusFilter === val ? s.filterBtnActive : s.filterBtn}>
                                    {label} <span style={s.filterCount}>{myQuests.filter(q => q.status === val).length}</span>
                                </button>
                            ))}
                        </div>
                        {myQuests.filter(q => q.status === questStatusFilter).length === 0
                            ? <div style={s.emptySmall}>Нет заданий в этой категории</div>
                            : myQuests.filter(q => q.status === questStatusFilter).map(quest => (
                                <div key={quest.id} style={s.myQuestCard}>
                                    <div style={{...s.myQuestAvatarBox, background: getChannelColor(quest.title)}}>
                                        {channelAvatars[quest.id]
                                            ? <img src={channelAvatars[quest.id]} alt="" style={s.myQuestAvatarImg} />
                                            : <span style={{fontSize:'18px'}}>{getChannelInitial(quest.title, quest.target_url)}</span>
                                        }
                                    </div>
                                    <div style={s.myQuestBody}>
                                        <p style={s.myQuestTitle}>{quest.title}</p>
                                        <p style={s.myQuestDesc}>{quest.description}</p>
                                        <div style={s.myQuestMeta}>
                                            <span style={s.rewardPill}>+{quest.reward} ⭐</span>
                                            <span style={{
                                                ...s.statusPill,
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
                                            <p style={s.rejectReason}>📝 {quest.rejection_reason}</p>
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
                <div style={s.modalOverlay}>
                    <div style={s.sheet}>
                        <div style={s.modalHeader}>
                            <div style={s.modalTitleRow}><span style={s.modalIcon}>✨</span><h3 style={s.modalTitle}>Создать задание</h3></div>
                            <button onClick={() => setShowCreateForm(false)} style={s.closeBtn}>✕</button>
                        </div>
                        <input type="text" placeholder="Ссылка на канал (t.me/...)" style={s.input} ref={channelInput} />
                        <input type="text" placeholder="Название задания" style={s.input} ref={titleInput} />
                        <textarea placeholder="Описание задания" style={s.textarea} ref={descInput} />
                        <input type="number" placeholder="Награда (Stars)" style={s.input} ref={rewardInput} />
                        <button onClick={createQuest} style={s.primaryBtn}>➕ Создать задание</button>
                    </div>
                </div>
            )}

            {showTonTopUpModal && (
                <div style={s.modalOverlay}>
                    <div style={s.sheet}>
                        <div style={s.modalHeader}>
                            <div style={s.modalTitleRow}><span style={s.modalIcon}>💎</span><h3 style={s.modalTitle}>Пополнение TON</h3></div>
                            <button onClick={() => { setShowTonTopUpModal(false); setTonPaymentStep('select'); }} style={s.closeBtn}>✕</button>
                        </div>
                        {tonPaymentStep === 'select' && <>
                            <p style={s.modalSubtitle}>Выберите сумму пополнения:</p>
                            <div style={s.amountGrid}>
                                {[0.5, 1, 2, 5, 10, 20].map(amt => (
                                    <button key={amt} onClick={() => setTonTopUpAmount(amt)} style={tonTopUpAmount === amt ? s.amountBtnActive : s.amountBtn}>{amt} 💎</button>
                                ))}
                            </div>
                            <button onClick={sendTonPayment} style={s.primaryBtnTon}>Оплатить {tonTopUpAmount} TON</button>
                        </>}
                        {tonPaymentStep === 'waiting' && (
                            <div style={s.paymentWaiting}>
                                <div style={s.spinnerRing}></div>
                                <p style={s.paymentWaitingText}>Ожидание подтверждения...</p>
                            </div>
                        )}
                        {tonPaymentStep === 'success' && (
                            <div style={s.paymentSuccess}>
                                <div style={s.successCircle}>✅</div>
                                <p style={s.paymentSuccessTitle}>Баланс пополнен!</p>
                                <p style={s.paymentSuccessSub}>+{tonTopUpAmount} TON зачислено</p>
                                <button onClick={() => { setShowTonTopUpModal(false); setTonPaymentStep('select'); }} style={s.primaryBtn}>Готово</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showTopUpModal && (
                <div style={s.modalOverlay}>
                    <div style={s.sheet}>
                        <div style={s.modalHeader}>
                            <div style={s.modalTitleRow}><span style={s.modalIcon}>⭐</span><h3 style={s.modalTitle}>Пополнение Stars</h3></div>
                            <button onClick={() => setShowTopUpModal(false)} style={s.closeBtn}>✕</button>
                        </div>
                        <p style={s.modalSubtitle}>Выберите сумму пополнения:</p>
                        <div style={s.amountGrid}>
                            {[1, 50, 100, 250, 500, 1000].map(amt => (
                                <button key={amt} onClick={() => setTopUpAmount(amt)} style={topUpAmount === amt ? s.amountBtnActive : s.amountBtn}>{amt} ⭐</button>
                            ))}
                        </div>
                        <div style={s.rowBtns}>
                            <button onClick={() => setShowTopUpModal(false)} style={s.ghostBtn}>Отмена</button>
                            <button onClick={createInvoice} style={s.primaryBtn}>Оплатить</button>
                        </div>
                    </div>
                </div>
            )}

            {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} userId={user?.telegram_id} />}
        </div>
    );

    // ---- MAIN ----
    return (
        <div style={s.screen}>
            <div style={s.noiseBg}></div>
            <div style={s.aura1}></div>
            <div style={s.aura2}></div>

            {/* Header */}
            <div style={s.header}>
                <button style={s.logoBtn} onClick={() => window.Telegram.WebApp.openLink('https://t.me/startask_official')}>
                    <div style={s.logoMark}>
                        <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                            <path d="M16 2L19.5 10.5L28 12L21.5 18L23.5 26.5L16 22L8.5 26.5L10.5 18L4 12L12.5 10.5L16 2Z" fill="url(#hg)" stroke="#00D4FF" strokeWidth="1"/>
                            <defs><linearGradient id="hg" x1="0" y1="0" x2="32" y2="32"><stop stopColor="#00D4FF"/><stop offset="1" stopColor="#FF2D95"/></linearGradient></defs>
                        </svg>
                    </div>
                    <span style={s.logoText}>StarTask</span>
                </button>

                <button style={s.userChip} onClick={() => setShowProfile(true)}>
                    <div style={s.userChipBalances}>
                        <span style={s.chipStars}>⭐ {balance}</span>
                        <span style={s.chipTon}>💎 {parseFloat(tonBalance||0).toFixed(2)}</span>
                    </div>
                    <div style={s.chipAvatar}>
                        {user?.photo_url
                            ? <img src={user.photo_url} alt="av" style={s.chipAvatarImg} />
                            : <span style={s.chipAvatarLetter}>{user?.username?.charAt(0).toUpperCase() || '?'}</span>
                        }
                    </div>
                </button>
            </div>

            {/* Content */}
            <div style={s.scrollArea}>
                {mainTab === 'tasks' && (
                    <>
                        <div style={s.tabBar}>
                            <button onClick={() => setActiveTab('active')} style={activeTab === 'active' ? s.tabActive : s.tab}>
                                Активные <span style={s.tabCount}>{activeTasks.length}</span>
                            </button>
                            <button onClick={() => setActiveTab('completed')} style={activeTab === 'completed' ? s.tabActive : s.tab}>
                                Выполненные <span style={s.tabCount}>{completedTasks.length}</span>
                            </button>
                        </div>

                        {activeTab === 'active' && (
                            activeTasks.length === 0
                                ? <div style={s.emptyState}>
                                    <div style={s.emptyEmoji}>🎉</div>
                                    <h3 style={s.emptyTitle}>Все задания выполнены!</h3>
                                    <p style={s.emptyText}>Новые появятся скоро</p>
                                </div>
                                : activeTasks.map((task, i) => (
                                    <div key={task.id} style={{...s.taskCard, animationDelay: `${i * 60}ms`}} className="taskCard">
                                        <div style={s.taskCardShine} />
                                        <div style={{...s.taskAvatarBox, background: channelAvatars[task.id] ? 'transparent' : getChannelColor(task.title)}}>
                                            {channelAvatars[task.id]
                                                ? <img src={channelAvatars[task.id]} alt="" style={s.taskAvatarImg} />
                                                : <span style={s.taskAvatarLetter}>{getChannelInitial(task.title, task.target_url)}</span>
                                            }
                                        </div>
                                        <div style={s.taskBody}>
                                            <p style={s.taskTitle}>{task.title}</p>
                                            <p style={s.taskDesc}>{task.description}</p>
                                            <div style={s.taskFooter}>
                                                <span style={s.rewardPill}>+{task.reward} ⭐</span>
                                                <button onClick={() => completeTask(task.id, task.target_url, task.target_url.split('t.me/')[1])} style={s.doBtn}>Выполнить →</button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                        )}

                        {activeTab === 'completed' && (
                            completedTasks.length === 0
                                ? <div style={s.emptyState}><div style={s.emptyEmoji}>📭</div><h3 style={s.emptyTitle}>Нет выполненных</h3><p style={s.emptyText}>Выполните задания чтобы они появились здесь</p></div>
                                : completedTasks.map(task => (
                                    <div key={task.id} style={{...s.taskCard, opacity: 0.65}}>
                                        <div style={{...s.taskAvatarBox, background: channelAvatars[task.id] ? 'transparent' : getChannelColor(task.title)}}>
                                            {channelAvatars[task.id] ? <img src={channelAvatars[task.id]} alt="" style={s.taskAvatarImg} /> : <span style={s.taskAvatarLetter}>{getChannelInitial(task.title, task.target_url)}</span>}
                                        </div>
                                        <div style={s.taskBody}>
                                            <p style={s.taskTitle}>{task.title}</p>
                                            <p style={s.taskDesc}>{task.description}</p>
                                            <div style={s.taskFooter}>
                                                <span style={{...s.rewardPill, background:'rgba(157,78,221,0.15)', color:'#9D4EDD', borderColor:'rgba(157,78,221,0.3)'}}>✅ +{task.reward} ⭐</span>
                                                <span style={s.completedLabel}>Выполнено</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                        )}
                    </>
                )}

                {mainTab === 'referral' && (
                    <>
                        <div style={s.glassCard}>
                            <div style={s.glassCardAccent} />
                            <div style={s.glassCardIcon}>👥</div>
                            <h3 style={s.glassCardTitle}>Партнёрская программа</h3>
                            <p style={s.glassCardText}>Приглашайте друзей и получайте <strong style={{color:'#FF2D95'}}>10%</strong> от их заработка!</p>
                            <div style={s.refLinkBox}>
                                <code style={s.refLink}>{getReferralLink()}</code>
                            </div>
                            <button onClick={copyReferralLink} style={s.copyBtn}>📋 Скопировать ссылку</button>
                        </div>
                        <div style={s.glassCard}>
                            <h4 style={s.statsHeading}>Ваша статистика</h4>
                            <div style={s.statRow}><span style={s.statLabel}>👥 Приглашено друзей</span><strong style={s.statValue}>0</strong></div>
                            <div style={s.statRow}><span style={s.statLabel}>💰 Заработано комиссии</span><strong style={s.statValue}>0 ⭐</strong></div>
                        </div>
                    </>
                )}

                {mainTab === 'info' && (
                    <>
                        {[
                            { icon: '⭐', title: 'Что такое StarTask?', text: 'StarTask — B2B платформа для продвижения каналов через вознаграждения в Telegram Stars и TON.' },
                            { icon: '💡', title: 'Как заработать?', text: 'Выберите задание → Выполните действие → Получите вознаграждение мгновенно!' },
                            { icon: '🤝', title: 'Партнёрская программа', text: 'Приглашайте друзей и получайте 10% от каждого их заработка.' },
                        ].map(({ icon, title, text }) => (
                            <div key={title} style={s.glassCard}>
                                <div style={s.glassCardIcon}>{icon}</div>
                                <h3 style={s.glassCardTitle}>{title}</h3>
                                <p style={s.glassCardText}>{text}</p>
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Bottom nav */}
            <div style={s.bottomNav}>
                {[
                    { id: 'tasks', icon: '📋', label: 'Задания' },
                    { id: 'referral', icon: '👥', label: 'Партнёры' },
                    { id: 'info', icon: 'ℹ️', label: 'О проекте' },
                ].map(({ id, icon, label }) => (
                    <button key={id} onClick={() => setMainTab(id)} style={mainTab === id ? s.navBtnActive : s.navBtn}>
                        <span style={s.navIcon}>{icon}</span>
                        <span style={s.navLabel}>{label}</span>
                        {mainTab === id && <div style={s.navIndicator} />}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ============ STYLES ============
const s = {
    // Layout
    screen: { minHeight: '100vh', position: 'relative', overflowX: 'hidden', fontFamily: "'SF Pro Display', -apple-system, 'Helvetica Neue', sans-serif", background: '#060612' },
    noiseBg: { position: 'fixed', inset: 0, zIndex: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`, opacity: 0.6 },
    aura1: { position: 'fixed', top: '-20vh', left: '-20vw', width: '70vw', height: '70vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none', filter: 'blur(40px)' },
    aura2: { position: 'fixed', bottom: '-10vh', right: '-10vw', width: '60vw', height: '60vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,45,149,0.10) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none', filter: 'blur(40px)' },

    // Loading
    loadingScreen: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060612', flexDirection: 'column' },
    loadingInner: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },
    loadingLogo: { width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,212,255,0.08)', borderRadius: '24px', border: '1px solid rgba(0,212,255,0.2)', boxShadow: '0 0 40px rgba(0,212,255,0.15)', animation: 'pulse 2s ease infinite' },
    loadingLabel: { color: 'white', fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px', margin: 0, background: 'linear-gradient(135deg, #00D4FF, #FF2D95)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
    loadingBar: { width: '120px', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' },
    loadingBarFill: { height: '100%', width: '40%', background: 'linear-gradient(90deg, #00D4FF, #FF2D95)', borderRadius: '10px', animation: 'loadbar 1.4s ease infinite' },

    // Header
    header: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'rgba(6,6,18,0.7)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' },
    logoBtn: { display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
    logoMark: { width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,212,255,0.08)', borderRadius: '10px', border: '1px solid rgba(0,212,255,0.2)' },
    logoText: { fontSize: '19px', fontWeight: '800', background: 'linear-gradient(135deg, #00D4FF 0%, #FF2D95 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' },
    userChip: { display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '40px', padding: '6px 6px 6px 12px', cursor: 'pointer' },
    userChipBalances: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' },
    chipStars: { fontSize: '11px', fontWeight: '600', color: '#00D4FF' },
    chipTon: { fontSize: '11px', fontWeight: '600', color: '#29B6F6' },
    chipAvatar: { width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,212,255,0.15)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(0,212,255,0.3)' },
    chipAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    chipAvatarLetter: { color: '#00D4FF', fontWeight: '700', fontSize: '14px' },

    // Scroll area
    scrollArea: { position: 'relative', zIndex: 1, paddingTop: '76px', paddingBottom: '90px', padding: '76px 16px 90px', minHeight: '100vh', boxSizing: 'border-box' },

    // Tab bar
    tabBar: { display: 'flex', gap: '0', marginBottom: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '4px', border: '1px solid rgba(255,255,255,0.06)' },
    tab: { flex: 1, padding: '10px 8px', background: 'transparent', border: 'none', borderRadius: '12px', color: 'rgba(255,255,255,0.4)', fontSize: '13px', cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s ease' },
    tabActive: { flex: 1, padding: '10px 8px', background: 'rgba(0,212,255,0.12)', border: 'none', borderRadius: '12px', color: '#00D4FF', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,212,255,0.15)' },
    tabCount: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px', padding: '1px 6px', marginLeft: '4px' },

    // Task cards
    taskCard: { position: 'relative', background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '14px', display: 'flex', gap: '12px', marginBottom: '12px', overflow: 'hidden', transition: 'transform 0.2s ease, box-shadow 0.2s ease' },
    taskCardShine: { position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' },
    taskAvatarBox: { width: '48px', height: '48px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
    taskAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    taskAvatarLetter: { fontSize: '22px', fontWeight: '700', color: 'white' },
    taskBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' },
    taskTitle: { margin: 0, fontSize: '15px', fontWeight: '700', color: 'white', letterSpacing: '-0.2px' },
    taskDesc: { margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 },
    taskFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' },
    rewardPill: { fontSize: '12px', fontWeight: '700', color: '#FF2D95', background: 'rgba(255,45,149,0.1)', border: '1px solid rgba(255,45,149,0.25)', borderRadius: '20px', padding: '4px 10px' },
    doBtn: { fontSize: '12px', fontWeight: '600', color: '#00D4FF', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '20px', padding: '6px 14px', cursor: 'pointer', transition: 'all 0.2s ease' },
    completedLabel: { fontSize: '12px', color: 'rgba(255,255,255,0.3)' },

    // Empty state
    emptyState: { textAlign: 'center', padding: '60px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' },
    emptyEmoji: { fontSize: '52px', marginBottom: '16px', display: 'block' },
    emptyTitle: { color: 'white', fontSize: '18px', fontWeight: '700', marginBottom: '8px' },
    emptyText: { color: 'rgba(255,255,255,0.35)', fontSize: '14px', margin: 0 },

    // Glass cards (referral/info)
    glassCard: { position: 'relative', background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '24px', padding: '24px', marginBottom: '14px', overflow: 'hidden', textAlign: 'center' },
    glassCardAccent: { position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '60%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent)' },
    glassCardIcon: { fontSize: '44px', marginBottom: '14px', display: 'block' },
    glassCardTitle: { color: 'white', fontSize: '18px', fontWeight: '700', margin: '0 0 10px', letterSpacing: '-0.3px' },
    glassCardText: { color: 'rgba(255,255,255,0.55)', fontSize: '14px', lineHeight: 1.6, margin: 0 },
    refLinkBox: { background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '10px 14px', margin: '16px 0', border: '1px solid rgba(0,212,255,0.15)', textAlign: 'left', overflowX: 'auto' },
    refLink: { fontSize: '11px', color: '#00D4FF', wordBreak: 'break-all' },
    copyBtn: { width: '100%', padding: '13px', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)', borderRadius: '14px', color: '#00D4FF', fontWeight: '600', cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s ease' },
    statsHeading: { color: 'white', fontSize: '17px', fontWeight: '700', margin: '0 0 16px', textAlign: 'left' },
    statRow: { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
    statLabel: { color: 'rgba(255,255,255,0.5)', fontSize: '14px' },
    statValue: { color: 'white', fontSize: '14px', fontWeight: '700' },

    // Bottom nav
    bottomNav: { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, display: 'flex', padding: '8px 12px', paddingBottom: 'calc(8px + env(safe-area-inset-bottom))', background: 'rgba(6,6,18,0.85)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.05)', gap: '4px' },
    navBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 4px', borderRadius: '12px', position: 'relative', transition: 'all 0.2s ease' },
    navBtnActive: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'rgba(0,212,255,0.08)', border: 'none', cursor: 'pointer', padding: '8px 4px', borderRadius: '12px', position: 'relative' },
    navIcon: { fontSize: '18px' },
    navLabel: { fontSize: '10px', fontWeight: '500', color: 'rgba(255,255,255,0.5)' },
    navIndicator: { position: 'absolute', bottom: '4px', width: '16px', height: '2px', background: '#00D4FF', borderRadius: '10px' },

    // Profile
    profileHeader: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(6,6,18,0.7)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' },
    profileHeaderTitle: { color: 'white', fontSize: '17px', fontWeight: '700' },
    backBtn: { width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '10px', color: 'white', cursor: 'pointer' },
    profileScroll: { position: 'relative', zIndex: 1, paddingTop: '70px', paddingBottom: '30px' },
    profileHero: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px 10px' },
    profileAvatarWrap: { position: 'relative', marginBottom: '16px' },
    avatarRing: { position: 'absolute', inset: '-6px', borderRadius: '50%', border: '2px solid transparent', background: 'linear-gradient(135deg, rgba(0,212,255,0.5), rgba(255,45,149,0.5)) border-box', WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'destination-out', maskComposite: 'exclude' },
    profileAvatarInner: { width: '90px', height: '90px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(0,212,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    profileAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    profileAvatarPlaceholder: { fontSize: '40px', fontWeight: '700', color: '#00D4FF' },
    profileName: { fontSize: '22px', fontWeight: '800', color: 'white', margin: '0 0 4px', letterSpacing: '-0.5px' },
    profileSub: { fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0 },

    // Balance grid
    balanceGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '10px 16px 6px' },
    balanceCard: { position: 'relative', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', overflow: 'hidden' },
    balanceCardTon: { border: '1px solid rgba(41,182,246,0.15)' },
    balanceCardGlow: { position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '80%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.5), transparent)' },
    balanceCardGlowTon: { background: 'linear-gradient(90deg, transparent, rgba(41,182,246,0.5), transparent)' },
    balanceCardIcon: { fontSize: '24px' },
    balanceCardLabel: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
    balanceCardValue: { fontSize: '26px', fontWeight: '800', color: '#00D4FF', letterSpacing: '-0.5px' },

    // Section
    section: { padding: '8px 16px' },
    sectionTitle: { color: 'white', fontSize: '17px', fontWeight: '700', margin: '0 0 12px', letterSpacing: '-0.3px' },

    // Wallet chip
    walletChip: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(41,182,246,0.06)', border: '1px solid rgba(41,182,246,0.2)', borderRadius: '16px', padding: '12px 14px' },
    walletChipLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
    walletDot: { width: '8px', height: '8px', borderRadius: '50%', background: '#29B6F6', boxShadow: '0 0 8px rgba(41,182,246,0.6)', flexShrink: 0 },
    walletChipLabel: { margin: 0, fontSize: '12px', color: '#29B6F6', fontWeight: '600' },
    walletChipAddr: { margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' },
    walletDisconnectBtn: { background: 'rgba(255,45,149,0.12)', border: '1px solid rgba(255,45,149,0.25)', borderRadius: '10px', padding: '6px 12px', color: '#FF2D95', fontSize: '12px', fontWeight: '600', cursor: 'pointer' },
    connectWalletBtn: { width: '100%', padding: '14px', background: 'rgba(41,182,246,0.08)', border: '1px solid rgba(41,182,246,0.25)', borderRadius: '16px', color: '#29B6F6', fontWeight: '700', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s ease' },
    connectWalletIcon: { fontSize: '20px' },

    // Action buttons
    actionBtn: { width: '100%', padding: '14px 20px', marginBottom: '10px', background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '16px', color: '#00D4FF', fontWeight: '700', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s ease' },
    actionBtnAlt: { background: 'rgba(255,210,0,0.07)', border: '1px solid rgba(255,210,0,0.2)', color: '#FFD200' },
    actionBtnTon: { background: 'rgba(41,182,246,0.07)', border: '1px solid rgba(41,182,246,0.2)', color: '#29B6F6' },
    actionBtnAdmin: { background: 'rgba(255,45,149,0.07)', border: '1px solid rgba(255,45,149,0.2)', color: '#FF2D95' },

    // Filter row (my quests)
    filterRow: { display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' },
    filterBtn: { padding: '7px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '12px', cursor: 'pointer' },
    filterBtnActive: { padding: '7px 12px', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)', borderRadius: '20px', color: '#00D4FF', fontSize: '12px', fontWeight: '700', cursor: 'pointer' },
    filterCount: { display: 'inline-block', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', padding: '0 5px', fontSize: '10px', marginLeft: '3px' },

    // My quest cards
    myQuestCard: { display: 'flex', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', marginBottom: '10px' },
    myQuestAvatarBox: { width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
    myQuestAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    myQuestBody: { flex: 1 },
    myQuestTitle: { margin: '0 0 3px', fontSize: '14px', fontWeight: '700', color: 'white' },
    myQuestDesc: { margin: '0 0 8px', fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 },
    myQuestMeta: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
    statusPill: { fontSize: '11px', padding: '3px 8px', borderRadius: '20px' },
    rejectReason: { margin: '6px 0 0', fontSize: '11px', color: '#FF2D95', background: 'rgba(255,45,149,0.08)', padding: '4px 10px', borderRadius: '10px', display: 'inline-block' },
    emptySmall: { textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.3)', fontSize: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '14px' },

    // Modal / Sheet
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300 },
    sheet: { background: 'rgba(12,12,28,0.98)', backdropFilter: 'blur(30px)', borderRadius: '28px 28px 0 0', padding: '24px', width: '100%', maxWidth: '480px', border: '1px solid rgba(255,255,255,0.07)', borderBottom: 'none', boxSizing: 'border-box' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
    modalTitleRow: { display: 'flex', alignItems: 'center', gap: '10px' },
    modalIcon: { fontSize: '22px' },
    modalTitle: { color: 'white', fontSize: '18px', fontWeight: '800', margin: 0, letterSpacing: '-0.3px' },
    modalSubtitle: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '16px', margin: '0 0 16px' },
    closeBtn: { background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '10px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '16px', cursor: 'pointer' },

    // Form elements
    input: { width: '100%', padding: '13px 14px', marginBottom: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', color: 'white', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' },
    textarea: { width: '100%', padding: '13px 14px', marginBottom: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', color: 'white', fontSize: '14px', boxSizing: 'border-box', minHeight: '80px', fontFamily: 'inherit', resize: 'vertical', outline: 'none' },
    select: { width: '100%', padding: '13px 14px', marginBottom: '14px', background: 'rgba(12,12,28,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', color: 'white', fontSize: '14px', boxSizing: 'border-box', cursor: 'pointer', outline: 'none' },

    // Buttons
    primaryBtn: { width: '100%', padding: '14px', background: 'linear-gradient(135deg, rgba(0,212,255,0.25), rgba(255,45,149,0.15))', border: '1px solid rgba(0,212,255,0.4)', borderRadius: '14px', color: '#00D4FF', fontWeight: '700', fontSize: '15px', cursor: 'pointer', transition: 'all 0.2s ease', marginTop: '4px' },
    primaryBtnTon: { width: '100%', padding: '14px', background: 'linear-gradient(135deg, rgba(41,182,246,0.2), rgba(41,182,246,0.08))', border: '1px solid rgba(41,182,246,0.35)', borderRadius: '14px', color: '#29B6F6', fontWeight: '700', fontSize: '15px', cursor: 'pointer', marginTop: '16px' },
    ghostBtn: { flex: 1, padding: '13px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: '14px', cursor: 'pointer' },
    dangerBtn: { flex: 1, padding: '13px', background: 'rgba(255,45,149,0.12)', border: '1px solid rgba(255,45,149,0.3)', borderRadius: '14px', color: '#FF2D95', fontWeight: '600', fontSize: '14px', cursor: 'pointer' },
    approveBtn: { flex: 1, padding: '9px 14px', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: '12px', color: '#00D4FF', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
    rejectBtn: { flex: 1, padding: '9px 14px', background: 'rgba(255,45,149,0.1)', border: '1px solid rgba(255,45,149,0.3)', borderRadius: '12px', color: '#FF2D95', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
    deactivateBtn: { width: '100%', padding: '9px 14px', background: 'rgba(255,45,149,0.1)', border: '1px solid rgba(255,45,149,0.25)', borderRadius: '12px', color: '#FF2D95', fontWeight: '600', fontSize: '13px', cursor: 'pointer', marginTop: '8px' },
    rowBtns: { display: 'flex', gap: '10px', marginTop: '16px' },

    // Amount grid
    amountGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' },
    amountBtn: { padding: '12px 6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', color: 'rgba(255,255,255,0.7)', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s ease' },
    amountBtnActive: { padding: '12px 6px', background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.4)', borderRadius: '14px', color: '#00D4FF', fontSize: '14px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 0 16px rgba(0,212,255,0.12)' },

    // Payment states
    paymentWaiting: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px', gap: '16px' },
    spinnerRing: { width: '52px', height: '52px', border: '3px solid rgba(0,212,255,0.15)', borderTop: '3px solid #00D4FF', borderRadius: '50%', animation: 'spin 0.9s linear infinite' },
    paymentWaitingText: { color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: 0 },
    paymentSuccess: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', gap: '8px', textAlign: 'center' },
    successCircle: { fontSize: '52px', marginBottom: '8px' },
    paymentSuccessTitle: { color: 'white', fontSize: '20px', fontWeight: '800', margin: 0 },
    paymentSuccessSub: { color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '0 0 16px' },

    // Admin
    adminPanel: { background: 'rgba(10,10,24,0.98)', backdropFilter: 'blur(30px)', borderRadius: '28px 28px 0 0', padding: '24px', width: '100%', maxWidth: '480px', maxHeight: '82vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.07)', borderBottom: 'none', boxSizing: 'border-box' },
    adminListArea: { display: 'flex', flexDirection: 'column', gap: '10px' },
    adminCard: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '14px' },
    adminCardTitle: { color: '#00D4FF', fontSize: '15px', display: 'block', marginBottom: '4px' },
    adminCardDesc: { color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '0 0 6px', lineHeight: 1.4 },
    adminCardMeta: { color: '#FF2D95', fontSize: '11px', margin: '0 0 4px' },
    adminCardUrl: { color: 'rgba(255,255,255,0.3)', fontSize: '10px', margin: '0 0 10px', wordBreak: 'break-all' },
    adminCardActions: { display: 'flex', gap: '8px' },
    emptyAdmin: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '30px', color: 'rgba(255,255,255,0.3)', fontSize: '14px' },

    // Segmented control
    segmentedControl: { display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px', marginBottom: '16px', gap: '4px' },
    segment: { flex: 1, padding: '9px', background: 'transparent', border: 'none', borderRadius: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '13px', cursor: 'pointer', fontWeight: '500' },
    segmentActive: { flex: 1, padding: '9px', background: 'rgba(0,212,255,0.12)', border: 'none', borderRadius: '8px', color: '#00D4FF', fontSize: '13px', fontWeight: '700', cursor: 'pointer' },
    badge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '10px', padding: '0 5px', marginLeft: '4px' },

    // Pulse loader
    pulseLoader: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', position: 'relative' },
    pulseRing: { width: '48px', height: '48px', border: '2px solid rgba(0,212,255,0.3)', borderRadius: '50%', animation: 'pulse 1.5s ease-out infinite', position: 'absolute' },
    pulseDot: { width: '16px', height: '16px', background: '#00D4FF', borderRadius: '50%', boxShadow: '0 0 16px rgba(0,212,255,0.6)' },
};

// Global styles + keyframes
const styleSheet = document.createElement("style");
styleSheet.textContent = `
    *, *::before, *::after { box-sizing: border-box; }
    html, body, #root { margin: 0; padding: 0; height: 100%; background: #060612; }
    input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.25); }
    input:focus, textarea:focus, select:focus { border-color: rgba(0,212,255,0.4) !important; }
    select, select option { background: rgba(10,10,28,0.98); color: white; }
    button { -webkit-tap-highlight-color: transparent; outline: none; font-family: inherit; }
    .taskCard:active { transform: scale(0.98); }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(1.8); opacity: 0; } }
    @keyframes loadbar { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .taskCard { animation: fadeUp 0.4s ease both; }
    button:not(:disabled):hover { filter: brightness(1.1); }
    button:not(:disabled):active { transform: scale(0.97); }
    ::-webkit-scrollbar { width: 0; }
`;
document.head.appendChild(styleSheet);

export default App;
```