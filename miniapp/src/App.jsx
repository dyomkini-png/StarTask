import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
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
    const [withdrawals, setWithdrawals] = useState([]);
    const [rate, setRate] = useState(100);
    const [newRate, setNewRate] = useState('');

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
        fetchWithdrawals();
        fetchRate();
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

    const fetchWithdrawals = async () => {
        try {
            const r = await axios.get(`${API_URL}/api/admin/withdrawals?adminId=${userId}`);
            setWithdrawals(r.data);
        } catch (e) { console.error(e); }
    };

    const fetchRate = async () => {
        try {
            const r = await axios.get(`${API_URL}/api/settings/rate`);
            setRate(r.data.rate);
            setNewRate(String(r.data.rate));
        } catch (e) { console.error(e); }
    };

    const updateRate = async () => {
        try {
            await axios.post(`${API_URL}/api/admin/set-rate`, { adminId: userId, rate: parseInt(newRate) });
            setRate(parseInt(newRate));
            window.Telegram.WebApp.showPopup({ title: '✅ Курс обновлён', message: `Новый курс: ${newRate} Stars = 1 TON`, buttons: [{ type: 'ok' }] });
        } catch (e) { window.Telegram.WebApp.showPopup({ title: 'Ошибка', message: 'Не удалось обновить', buttons: [{ type: 'ok' }] }); }
    };

    const completeWithdrawal = async (id) => {
        try {
            await axios.post(`${API_URL}/api/admin/withdrawals/${id}/complete`, { adminId: userId });
            fetchWithdrawals();
            window.Telegram.WebApp.showPopup({ title: '✅ Готово', message: 'Вывод отмечен как выполненный', buttons: [{ type: 'ok' }] });
        } catch (e) { window.Telegram.WebApp.showPopup({ title: 'Ошибка', message: 'Ошибка', buttons: [{ type: 'ok' }] }); }
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
                        <button onClick={() => setAdminTab('withdrawals')} style={adminTab === 'withdrawals' ? st.adminTabActive : st.adminTab}>
                            <span>💸 Выводы</span>
                            <span style={st.adminTabCount}>{withdrawals.length}</span>
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
                                        {quest.quest_type === 'extended' && (
                                            <div style={{background: 'rgba(255,51,102,0.05)', border: '1px solid rgba(255,51,102,0.15)', borderRadius: '10px', padding: '10px', marginBottom: '8px'}}>
                                                <p style={{margin: '0 0 4px', color: '#FF3366', fontSize: '10px', fontWeight: '700'}}>⭐ PRO задание · Комиссия: {quest.commission_amount} ⭐</p>
                                                {quest.subscribers_count && <p style={{margin: '0 0 4px', color: 'rgba(255,255,255,0.5)', fontSize: '11px'}}>👥 Подписчиков: {quest.subscribers_count?.toLocaleString()}</p>}
                                                {quest.extended_description && <p style={{margin: '0 0 4px', color: 'rgba(255,255,255,0.5)', fontSize: '11px', lineHeight: 1.4}}>{quest.extended_description}</p>}
                                                {quest.screenshots && quest.screenshots.length > 0 && (
                                                    <div style={{display: 'flex', gap: '6px', marginTop: '8px', overflowX: 'auto'}}>
                                                        {quest.screenshots.map((url, i) => url && (
                                                            <img key={i} src={url} alt="" style={{width: '80px', height: '120px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0}} />
                                                        ))}
                                                    </div>
                                                )}
                                                {quest.social_links && Object.values(quest.social_links).some(v => v) && (
                                                    <div style={{display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap'}}>
                                                        {Object.entries(quest.social_links).map(([key, val]) => val && (
                                                            <span key={key} style={{background: 'rgba(255,255,255,0.06)', borderRadius: '20px', padding: '3px 8px', fontSize: '10px', color: 'rgba(255,255,255,0.6)'}}>
                                                                {key}: {val}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
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
                        
                        {adminTab === 'withdrawals' && (
                            <>
                                <div style={{...st.adminCardPremium, marginBottom: '12px'}}>
                                    <p style={{color: 'rgba(255,255,255,0.5)', fontSize: '11px', margin: '0 0 8px'}}>
                                        Текущий курс конвертации
                                    </p>
                                    <p style={{color: '#FFC107', fontSize: '18px', fontWeight: '700', margin: '0 0 12px'}}>
                                        {rate} ⭐ = 1 💎 TON
                                    </p>
                                    <div style={{display: 'flex', gap: '8px'}}>
                                        <input type="number" value={newRate} onChange={(e) => setNewRate(e.target.value)} placeholder="Новый курс" style={{...st.inputPremium, marginBottom: 0, flex: 1}} />
                                        <button onClick={updateRate} style={{...st.btnApprovePremium, whiteSpace: 'nowrap'}}>Сохранить</button>
                                    </div>
                                </div>
                                {withdrawals.length === 0
                                    ? <div style={st.emptyPremium}><span style={st.emptyPremiumIcon}>✅</span><span style={st.emptyPremiumText}>Нет pending заявок</span></div>
                                    : withdrawals.map(w => (
                                        <div key={w.id} style={st.adminCardPremium}>
                                            <div style={st.adminCardTop}>
                                                <span style={{...st.adminCardBadge, background: 'rgba(76,175,80,0.12)', color: '#4CAF50'}}>Pending</span>
                                                <span style={{color: '#29B6F6', fontWeight: '700'}}>{parseFloat(w.amount).toFixed(3)} TON</span>
                                            </div>
                                            <p style={st.adminCardAuthor}>@{w.username} · ID {w.telegram_id}</p>
                                            <p style={{...st.adminCardLink, color: 'rgba(0,194,255,0.6)'}}>→ {w.wallet_address}</p>
                                            <p style={st.adminCardAuthor}>{new Date(w.created_at).toLocaleString('ru')}</p>
                                            <button onClick={() => completeWithdrawal(w.id)} style={st.btnApprovePremium}>✅ Отметить как выполнено</button>
                                        </div>
                                    ))
                                }
                            </>
                        )}
                    </div>
                </div>
            </div>
            
            {showRejectModal && (
                <div style={st.modalOverlay}>
                    <div style={st.sheetPremium}>
                        <div style={st.adminHeader}>
                            <div style={st.adminHeaderLeft}><span style={st.adminHeaderIcon}>❌</span><span style={st.adminHeaderTitle}>Причина отклонения</span></div>
                            <button onClick={() => setShowRejectModal(false)} style={st.closePremium}>✕</button>
                        </div>
                        <p style={st.textSecondary}>Выберите причину из списка или укажите свою:</p>
                        <select value={selectedRejectReason} onChange={(e) => setSelectedRejectReason(e.target.value)} style={st.selectPremium}>
                            <option value="">— Выберите причину —</option>
                            {rejectReasons.map((reason, i) => (<option key={i} value={reason}>{reason}</option>))}
                        </select>
                        {selectedRejectReason === 'Другая причина' && (
                            <textarea placeholder="Опишите причину..." value={customRejectReason} onChange={(e) => setCustomRejectReason(e.target.value)} style={st.textareaPremium} rows={3} />
                        )}
                        <div style={st.doubleButton}>
                            <button onClick={() => setShowRejectModal(false)} style={st.btnSecondaryPremium}>Отмена</button>
                            <button onClick={handleRejectSubmit} disabled={actionLoading} style={st.btnDangerPremium}>{actionLoading ? 'Отклонение...' : 'Отклонить'}</button>
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
    const [nftBackgrounds, setNftBackgrounds] = useState({});
    const [showProfile, setShowProfile] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [verificationType, setVerificationType] = useState('admin');
    const [inviteLinkInput, setInviteLinkInput] = useState('');
    const [selectedTask, setSelectedTask] = useState(null);
    const [questType, setQuestType] = useState('basic');
    const [extendedDescription, setExtendedDescription] = useState('');
    const [screenshots, setScreenshots] = useState(['', '', '']);
    const [socialLinks, setSocialLinks] = useState({ telegram: '', instagram: '', youtube: '', tiktok: '' });
    const [subscribersCount, setSubscribersCount] = useState('');
    const [postUrl, setPostUrl] = useState('');
    const [referralUrl, setReferralUrl] = useState('');
    const [nftGiftUrl, setNftGiftUrl] = useState('');
    const [nftPreview, setNftPreview] = useState(null);
    const [totalBudget, setTotalBudget] = useState('');
    const [questStatusFilter, setQuestStatusFilter] = useState('pending');
    const [showTopUpModal, setShowTopUpModal] = useState(false);
    const [topUpAmount, setTopUpAmount] = useState(50);
    const [showTonTopUpModal, setShowTonTopUpModal] = useState(false);
    const [tonTopUpAmount, setTonTopUpAmount] = useState(1);
    const [tonPaymentStep, setTonPaymentStep] = useState('select');
    const [profileScrollY, setProfileScrollY] = useState(0);
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [convertAmount, setConvertAmount] = useState(100);
    const [withdrawAmount, setWithdrawAmount] = useState(0.1);
    const [conversionRate, setConversionRate] = useState(100);
    const [convertStep, setConvertStep] = useState('select');
    const [withdrawStep, setWithdrawStep] = useState('select');

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
        const handleScroll = () => { const y = window.scrollY; document.documentElement.style.setProperty('--parallax', `${y * 0.05}px`); };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const tg = window.Telegram.WebApp;
        tg.ready(); tg.expand(); tg.MainButton.hide();
        tg.setHeaderColor('#0a0014'); tg.setBackgroundColor('#0a0014');
        if (tg.initDataUnsafe?.user) authenticate(tg.initDataUnsafe.user);
    }, []);

    const authenticate = async (telegramUser) => {
        try {
            const userPhotoUrl = window.Telegram.WebApp.initDataUnsafe?.user?.photo_url;
            const response = await axios.post(`${API_URL}/api/auth`, { telegramId: telegramUser.id, username: telegramUser.username });
            setUser({ ...response.data.user, photo_url: userPhotoUrl, first_name: telegramUser.first_name, last_name: telegramUser.last_name });
            localStorage.setItem('token', response.data.token);
            fetchBalance(response.data.user.id); fetchTonBalance(response.data.user.id); fetchTasks(response.data.user.id); fetchMyQuests(response.data.user.id); fetchConversionRate();
        } catch (error) { console.error('Auth error:', error); } finally { setLoading(false); }
    };

    const fetchBalance = async (userId) => { try { const r = await axios.get(`${API_URL}/api/user/${userId}/balance`); setBalance(r.data.balance); } catch (e) { console.error(e); } };
    const fetchTonBalance = async (userId) => { try { const r = await axios.get(`${API_URL}/api/user/${userId}/ton-balance`); setTonBalance(r.data.balance); } catch (e) { console.error(e); } };
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
                    if (task.nft_gift_url) {
                        try {
                            const nftRes = await axios.post(`${API_URL}/api/parse-nft-background`, { nftUrl: task.nft_gift_url });
                            if (nftRes.data.success && nftRes.data.backgroundImage) {
                                setNftBackgrounds(prev => ({ ...prev, [task.id]: { background: nftRes.data.backgroundImage, pattern: nftRes.data.patternImage } }));
                            }
                        } catch (e) {}
                    }
                }
            }
        } catch (e) { console.error(e); }
    };
    const fetchMyQuests = async (userId) => { try { const r = await axios.get(`${API_URL}/api/user/${userId}/quests`); setMyQuests(r.data); } catch (e) { console.error(e); } };
    const fetchConversionRate = async () => { try { const r = await axios.get(`${API_URL}/api/settings/rate`); setConversionRate(r.data.rate); } catch (e) { console.error(e); } };
    const fetchNftPreview = async (url) => { if (!url || !url.includes('t.me/nft/')) return; try { const r = await axios.post(`${API_URL}/api/parse-nft-background`, { nftUrl: url }); if (r.data.success) { setNftPreview(r.data); } else { setNftPreview(null); } } catch (e) { setNftPreview(null); } };

    const convertStarsToTon = async () => { /* без изменений */ };
    const withdrawTon = async () => { /* без изменений */ };
    const fetchChannelAvatar = async (username, taskId) => { /* без изменений */ };
    const createRipple = (e) => { /* без изменений */ };
    const handleCardMove = (e) => { /* без изменений */ };

    const completeTask = async (taskId, taskUrl, channelUsername, inviteLink, verificationType, postUrl, referralUrl) => {
        const tg = window.Telegram.WebApp;
        let linkToOpen = taskUrl;
        if (verificationType === 'invite' && inviteLink) linkToOpen = inviteLink;
        if (verificationType === 'repost' && postUrl) linkToOpen = postUrl;
        if (verificationType === 'referral' && referralUrl) linkToOpen = referralUrl;
        tg.openLink(linkToOpen); tg.MainButton.show(); tg.MainButton.setText('⏳ Проверка...'); tg.MainButton.disable();
        setTimeout(async () => {
            try {
                const response = await axios.post(`${API_URL}/api/check-subscription`, { userId: user.id, channelUsername, questId: taskId });
                tg.MainButton.hide();
                if (response.data.success) { tg.showPopup({ title: '🎉 Выполнено!', message: response.data.message, buttons: [{ type: 'ok' }] }); fetchBalance(user.id); fetchTasks(user.id); }
                else tg.showPopup({ title: '❌ Не выполнено', message: response.data.message, buttons: [{ type: 'ok' }] });
            } catch (error) { tg.MainButton.hide(); tg.showPopup({ title: '⚠️ Ошибка', message: error.response?.data?.error || 'Ошибка проверки', buttons: [{ type: 'ok' }] }); }
        }, 5000);
    };

    const createQuest = async () => {
        const tg = window.Telegram.WebApp;
        const title = titleInput.current?.value;
        const description = descInput.current?.value;
        const reward = parseInt(rewardInput.current?.value);
        const targetUrl = channelInput.current?.value;
        if (!title || !description || !reward || !targetUrl || !totalBudget) { tg.showPopup({ title: 'Ошибка', message: 'Заполните все поля включая бюджет', buttons: [{ type: 'ok' }] }); return; }
        if (parseInt(totalBudget) < parseInt(reward)) { tg.showPopup({ title: 'Ошибка', message: 'Бюджет не может быть меньше награды', buttons: [{ type: 'ok' }] }); return; }
        const maxParticipants = Math.floor(parseInt(totalBudget) / parseInt(reward));
        let commissionAmount = 0;
        if (questType === 'extended') { const baseCommission = Math.max(50, Math.floor(reward * 0.05)); const socialLinksCount = Object.values(socialLinks).filter(v => v).length; commissionAmount = baseCommission + (socialLinksCount * 100); }
        try {
            const response = await axios.post(`${API_URL}/api/create-quest`, { userId: user.id, title, description, reward, targetUrl, inviteLink: inviteLinkInput || null, totalBudget: parseInt(totalBudget), verificationType, questType, extendedDescription: extendedDescription || null, screenshots: screenshots.filter(s => s) || null, nftGiftUrl: nftGiftUrl || null, postUrl: postUrl || null, referralUrl: referralUrl || null, socialLinks: Object.values(socialLinks).some(v => v) ? socialLinks : null, subscribersCount: subscribersCount ? parseInt(subscribersCount) : null });
            if (response.data.success) {
                const commissionMsg = commissionAmount > 0 ? `\n\n💳 При одобрении: ${commissionAmount} ⭐ комиссии` : '';
                const budgetMsg = `\n👥 Макс. участников: ${maxParticipants}`;
                tg.showPopup({ title: '✅ Задание создано!', message: response.data.message + budgetMsg + commissionMsg, buttons: [{ type: 'ok' }] });
                setShowCreateForm(false); fetchMyQuests(user.id); fetchTasks(user.id);
                [titleInput, descInput, rewardInput, channelInput].forEach(ref => { if (ref.current) ref.current.value = ''; });
                setVerificationType('admin'); setInviteLinkInput(''); setQuestType('basic'); setExtendedDescription(''); setScreenshots(['', '', '']); setSocialLinks({ telegram: '', instagram: '', youtube: '', tiktok: '' }); setSubscribersCount(''); setNftGiftUrl(''); setPostUrl(''); setReferralUrl(''); setNftPreview(null); setTotalBudget('');
            }
        } catch (error) { tg.showPopup({ title: 'Ошибка', message: error.response?.data?.error || 'Ошибка', buttons: [{ type: 'ok' }] }); }
    };

    const sendTonPayment = async () => { /* без изменений */ };
    const createInvoice = async () => { /* без изменений */ };
    const getChannelInitial = (taskTitle, targetUrl) => { /* без изменений */ };
    const getChannelColor = (taskTitle) => { /* без изменений */ };
    const getReferralLink = () => `https://t.me/StarTaskBot?start=ref_${user?.id}`;
    const copyReferralLink = () => { navigator.clipboard.writeText(getReferralLink()); window.Telegram.WebApp.showPopup({ title: '🔗 Скопировано!', message: 'Поделитесь с друзьями и получайте 10%', buttons: [{ type: 'ok' }] }); };
    const getFriendlyAddress = () => { /* без изменений */ };

    // ---- LOADING ----
    if (loading) return ( /* без изменений */ );

    // ---- PROFILE ----
    if (showProfile) return ( /* без изменений, форма создания внутри */ );

    // ---- MAIN ----
    return (
        <div style={{...st.screen, animation: 'bgMove 20s ease infinite'}}>
            {/* фон */}
            <div style={st.headerMain}><div style={st.logoMain}>⭐ StarTask</div><div style={st.headerRight}><div style={st.balanceInline}><span>⭐ {balance}</span><span>💎 {parseFloat(tonBalance||0).toFixed(2)}</span></div><div style={st.profileBtn} onClick={() => setShowProfile(true)}>{user?.photo_url ? <img src={user.photo_url} /> : <span>{user?.username?.charAt(0) || '👤'}</span>}</div></div></div>
            <div style={st.mainScroll}>
                {mainTab === 'tasks' && (<>
                    <div style={st.segmentWrap}><button onClick={() => setActiveTab('active')} style={activeTab === 'active' ? st.segmentActive : st.segment}>Активные<span>{activeTasks.length}</span></button><button onClick={() => setActiveTab('completed')} style={activeTab === 'completed' ? st.segmentActive : st.segment}>Выполненные<span>{completedTasks.length}</span></button></div>
                    {activeTab === 'active' && (activeTasks.length === 0 ? <div style={st.emptyStatePremium}>✨<h3>Всё выполнено</h3><p>Новые задания появятся скоро</p></div> : activeTasks.map((task, i) => (
                        <motion.div key={task.id} style={{...st.questCardUltra, cursor: task.quest_type === 'extended' ? 'pointer' : 'default', position: 'relative', overflow: 'hidden', background: nftBackgrounds[task.id] ? 'transparent' : 'radial-gradient(...)' }} onClick={() => { if (task.quest_type === 'extended') setSelectedTask(task); }}>
                            {nftBackgrounds[task.id]?.background && (<><div style={{...}} /><div style={{...}} /></>)}
                            <div style={st.cardGlow}></div>
                            <div style={{...st.questAvatar}}>{channelAvatars[task.id] ? <img src={channelAvatars[task.id]} /> : <span>{getChannelInitial(task.title, task.target_url)}</span>}</div>
                            <div style={st.questBody}>
                                {nftBackgrounds[task.id] && <div style={{...}}>🎁 NFT Gift</div>}
                                {task.quest_type === 'extended' && <div style={{...}}>⭐ PRO</div>}
                                <h4>{task.title}</h4><p>{task.description}</p>
                                <div style={st.questFooter}>
                                    <div style={st.rewardTag}>+{task.reward} ⭐</div>
                                    <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); createRipple(e); completeTask(task.id, task.target_url, task.target_url.split('t.me/')[1], task.invite_link, task.verification_type, task.post_url, task.referral_url); }} style={st.actionBtnUltra}>Выполнить <svg>...</svg></motion.button>
                                </div>
                            </div>
                        </motion.div>
                    )))}
                    {activeTab === 'completed' && (completedTasks.length === 0 ? <div>📋<h3>Пока пусто</h3></div> : completedTasks.map(task => ( <div key={task.id} style={{...st.questCard, opacity: 0.5}}>...</div> )))}
                </>)}
                {mainTab === 'referral' && (<>...</>)}
                {mainTab === 'info' && (<>...</>)}
            </div>
            {/* Раскрытая карточка PRO */}
            {selectedTask && ( <div style={st.modalOverlay} onClick={() => setSelectedTask(null)}>...</div> )}
            <div style={st.bottomNav}>...</div>

            {/* ===== ФОРМА СОЗДАНИЯ ЗАДАНИЯ (НОВАЯ) ===== */}
            {showCreateForm && (
    <div style={st.modalOverlay}>
        <div style={{...st.sheetPremium, maxHeight: '90vh', overflowY: 'auto'}}>
            <div style={st.sheetHeaderPremium}>
                <span>✨</span>
                <h3>Создать задание</h3>
                <button onClick={() => setShowCreateForm(false)} style={st.closePremium}>✕</button>
            </div>

            {/* ВЫБОР ТИПА ЗАДАНИЯ (сегмент-контрол) */}
            <div style={st.createTypeWrap}>
                {[
                    { id: 'admin', label: '📢 Подписка' },
                    { id: 'invite', label: '🔗 Инвайт' },
                    { id: 'repost', label: '🔁 Репост' },
                    { id: 'referral', label: '👥 Реферал' }
                ].map(type => (
                    <button
                        key={type.id}
                        onClick={() => setVerificationType(type.id)}
                        style={verificationType === type.id ? st.createTypeActive : st.createTypeBtn}
                    >
                        {type.label}
                    </button>
                ))}
            </div>

            {/* ПОЛЯ В ЗАВИСИМОСТИ ОТ ТИПА */}
            {verificationType === 'admin' && (
                <>
                    <div style={st.infoBoxBlue}>📢 Добавьте @StarTaskBot администратором канала</div>
                    <input type="text" placeholder="Ссылка на канал (t.me/...)" style={st.inputPremium} ref={channelInput} />
                </>
            )}
            {verificationType === 'invite' && (
                <>
                    <div style={st.infoBoxPurple}>🔗 Пользователь должен вступить по invite-ссылке</div>
                    <input type="text" placeholder="Инвайт ссылка (t.me/+...)" style={st.inputPremium} value={inviteLinkInput} onChange={(e) => setInviteLinkInput(e.target.value)} />
                </>
            )}
            {verificationType === 'repost' && (
                <>
                    <div style={st.infoBoxYellow}>🔁 Пользователь делает репост записи</div>
                    <input type="text" placeholder="Ссылка на пост" style={st.inputPremium} value={postUrl} onChange={(e) => setPostUrl(e.target.value)} />
                </>
            )}
            {verificationType === 'referral' && (
                <>
                    <div style={st.infoBoxGreen}>👥 Пользователь переходит по referral-ссылке</div>
                    <input type="text" placeholder="Referral URL" style={st.inputPremium} value={referralUrl} onChange={(e) => setReferralUrl(e.target.value)} />
                </>
            )}

            {/* ОБЩИЕ ПОЛЯ */}
            <input type="text" placeholder="Название задания" style={st.inputPremium} ref={titleInput} />
            <textarea placeholder="Краткое описание" style={st.textareaPremium} ref={descInput} />
            <input type="number" placeholder="Награда в Stars" style={st.inputPremium} ref={rewardInput} />
            <input type="number" placeholder="Бюджет задания в Stars (например 500)" style={st.inputPremium} value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} />
            {totalBudget && rewardInput.current?.value && parseInt(totalBudget) >= parseInt(rewardInput.current?.value) && (
                <div style={{background: 'rgba(0,194,255,0.05)', border: '1px solid rgba(0,194,255,0.15)', borderRadius: '12px', padding: '10px', marginBottom: '10px'}}>
                    <p style={{margin: 0, fontSize: '12px', color: 'rgba(0,194,255,0.8)'}}>👥 Максимум участников: <strong>{Math.floor(parseInt(totalBudget) / parseInt(rewardInput.current?.value))}</strong><br/>💰 Будет заблокировано: <strong>{totalBudget} ⭐</strong></p>
                </div>
            )}

            {/* NFT Подарок */}
            <p style={{...st.textSecondary, marginBottom: '6px', marginTop: '4px'}}>🎁 NFT Подарок (опционально):</p>
            <input type="text" placeholder="Ссылка на NFT подарок (t.me/nft/...)" style={st.inputPremium} value={nftGiftUrl} onChange={(e) => { setNftGiftUrl(e.target.value); if (e.target.value.length > 20) { fetchNftPreview(e.target.value); } else { setNftPreview(null); } }} />
            {nftPreview && nftPreview.backgroundImage && (
                <div style={{background: `url(${nftPreview.backgroundImage}) center/contain no-repeat`, backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,194,255,0.2)', borderRadius: '12px', padding: '12px', marginBottom: '12px', minHeight: '120px'}}>
                    <p style={{margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.5)', textAlign: 'center'}}>🎁 Фон подарка будет применён к карточке задания</p>
                </div>
            )}
            {nftGiftUrl && !nftPreview && (
                <div style={{background: 'rgba(255,193,7,0.05)', border: '1px solid rgba(255,193,7,0.15)', borderRadius: '12px', padding: '10px', marginBottom: '12px'}}>
                    <p style={{margin: 0, fontSize: '11px', color: 'rgba(255,193,7,0.7)', textAlign: 'center'}}>🔍 Введите полную ссылку на NFT подарок для предпросмотра</p>
                </div>
            )}

            {/* PRO поля */}
            {questType === 'extended' && ( <>...</> )}

            {/* Тип задания (Базовое / PRO) */}
            <div style={{display: 'flex', gap: '8px', marginBottom: '16px'}}>
                <button onClick={() => setQuestType('basic')} style={{flex: 1, padding: '12px 8px', borderRadius: '14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', background: questType === 'basic' ? 'rgba(0,194,255,0.12)' : 'rgba(255,255,255,0.03)', border: questType === 'basic' ? '1px solid rgba(0,194,255,0.4)' : '1px solid rgba(255,255,255,0.07)', color: questType === 'basic' ? '#00C2FF' : 'rgba(255,255,255,0.4)'}}>📋 Базовое<br/><span style={{fontWeight: '500', fontSize: '10px', opacity: 0.7}}>Без комиссии</span></button>
                <button onClick={() => setQuestType('extended')} style={{flex: 1, padding: '12px 8px', borderRadius: '14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', background: questType === 'extended' ? 'rgba(255,51,102,0.12)' : 'rgba(255,255,255,0.03)', border: questType === 'extended' ? '1px solid rgba(255,51,102,0.4)' : '1px solid rgba(255,255,255,0.07)', color: questType === 'extended' ? '#FF3366' : 'rgba(255,255,255,0.4)'}}>⭐ PRO<br/><span style={{fontWeight: '500', fontSize: '10px', opacity: 0.7}}>5% комиссия</span></button>
            </div>

            <button onClick={createQuest} style={st.btnPrimaryPremium}>Создать задание</button>
        </div>
    </div>
)}
        </div>
    );
}

// ============ STYLES ============
const st = {
    screen: { minHeight: '100vh', position: 'relative', overflowX: 'hidden', fontFamily: "'Inter', -apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif", background: 'radial-gradient(800px at 20% 0%, rgba(0,194,255,0.10), transparent), radial-gradient(600px at 80% 100%, rgba(255,51,102,0.10), transparent), linear-gradient(160deg, #05010a 0%, #0a0014 50%, #0d0020 100%)', backgroundAttachment: 'fixed', color: '#FFFFFF' },
    profileOverlay: { position: 'fixed', inset: 0, zIndex: 200, background: 'radial-gradient(800px at 20% 0%, rgba(0,194,255,0.10), transparent), radial-gradient(600px at 80% 100%, rgba(255,51,102,0.10), transparent), linear-gradient(160deg, #05010a 0%, #0a0014 50%, #0d0020 100%)', backgroundAttachment: 'fixed', display: 'flex', flexDirection: 'column' },
    loadingScreen: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #0a0014 0%, #0d001a 15%, #100020 30%, #0a0020 50%, #0d0030 70%, #0a0014 100%)', position: 'relative', overflow: 'hidden' },
    bgNeonGrid: { position: 'fixed', inset: 0, zIndex: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '50px 50px', opacity: 0.3 },
    bgOrb1: { position: 'fixed', top: '-20%', left: '-15%', width: '70%', height: '70%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,194,255,0.12) 0%, transparent 70%)', zIndex: 1, pointerEvents: 'none', filter: 'blur(120px)', animation: 'orbMove1 8s ease-in-out infinite' },
    bgOrb2: { position: 'fixed', bottom: '-20%', right: '-10%', width: '60%', height: '60%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,51,102,0.10) 0%, transparent 70%)', zIndex: 1, pointerEvents: 'none', filter: 'blur(120px)', animation: 'orbMove2 10s ease-in-out infinite' },
    bgOrb3: { position: 'fixed', top: '40%', left: '30%', width: '50%', height: '50%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)', zIndex: 1, pointerEvents: 'none', filter: 'blur(120px)', animation: 'orbMove3 12s ease-in-out infinite' },
    bgOrb4: { position: 'fixed', top: '10%', right: '20%', width: '40%', height: '40%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,136,204,0.08) 0%, transparent 70%)', zIndex: 1, pointerEvents: 'none', filter: 'blur(120px)', animation: 'orbMove4 9s ease-in-out infinite' },
    loadingGlow1: { position: 'absolute', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,194,255,0.2) 0%, transparent 50%)', filter: 'blur(60px)', animation: 'pulse 3s ease-in-out infinite', top: '30%', left: '-10%' },
    loadingGlow2: { position: 'absolute', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,51,102,0.15) 0%, transparent 50%)', filter: 'blur(60px)', animation: 'pulse 3s ease-in-out infinite 1.5s', bottom: '20%', right: '-10%' },
    loadingContent: { position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' },
    loadingLogoBox: { width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,194,255,0.08)', borderRadius: '50%', border: '1px solid rgba(0,194,255,0.2)', boxShadow: '0 0 80px rgba(0,194,255,0.2)', animation: 'pulse 3s ease-in-out infinite' },
    loadingTitle: { color: 'white', fontSize: '24px', fontWeight: '800', letterSpacing: '-1px', margin: 0, background: 'linear-gradient(135deg, #FFFFFF 0%, #00C2FF 50%, #FF3366 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
    loadingSubtitle: { color: 'rgba(255,255,255,0.3)', fontSize: '12px', margin: 0, letterSpacing: '2px', textTransform: 'uppercase' },
    loadingLine: { width: '120px', height: '1px', background: 'rgba(255,255,255,0.05)', borderRadius: '1px', overflow: 'hidden' },
    loadingLineFill: { height: '100%', width: '30%', background: 'linear-gradient(90deg, #00C2FF, #FF3366)', borderRadius: '1px', animation: 'loadbar 2s ease infinite' },
    headerMain: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'transparent' },
    logoMain: { fontSize: '18px', fontWeight: '700', cursor: 'pointer', color: 'white' },
    headerRight: { display: 'flex', alignItems: 'center', gap: '10px' },
    balanceInline: { display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)', borderRadius: '20px', padding: '5px 12px', border: '1px solid rgba(255,255,255,0.06)' },
    balanceInlineItem: { fontSize: '11px', fontWeight: '600', color: '#00C2FF' },
    profileBtn: { width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', cursor: 'pointer', border: '1.5px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)' },
    profileAvatarImgNew: { width: '100%', height: '100%', objectFit: 'cover' },
    profileAvatarFallback: { fontSize: '14px', fontWeight: '700', color: '#00C2FF' },
    mainScroll: { position: 'relative', zIndex: 10, padding: '72px 16px 90px', minHeight: '100vh', boxSizing: 'border-box' },
    segmentWrap: { display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '20px', padding: '4px', marginBottom: '16px', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)' },
    segment: { flex: 1, padding: '10px', borderRadius: '16px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.3s ease', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    segmentActive: { flex: 1, padding: '10px', borderRadius: '16px', background: 'linear-gradient(135deg,#00C2FF,#FF3366)', color: 'white', fontWeight: '600', fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,194,255,0.3)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    segmentBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.15)', borderRadius: '20px', fontSize: '10px', padding: '1px 8px', color: 'white' },
    questCard: { position: 'relative', background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '16px', display: 'flex', gap: '14px', marginBottom: '10px', overflow: 'hidden', transition: 'all 0.3s ease' },
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
    questCardUltra: { position: 'relative', backdropFilter: 'blur(30px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '16px', display: 'flex', gap: '14px', marginBottom: '12px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)' },
    cardGlow: { position: 'absolute', inset: 0, background: 'linear-gradient(120deg, transparent, rgba(255,255,255,0.05), transparent)', animation: 'shine 6s infinite' },
    actionBtnUltra: { fontSize: '12px', fontWeight: '600', color: 'white', background: 'linear-gradient(135deg,#00C2FF,#FF3366)', border: 'none', borderRadius: '16px', padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 20px rgba(0,194,255,0.4)', transition: 'all 0.25s ease' },
    emptyStatePremium: { textAlign: 'center', padding: '60px 20px' },
    emptyStateIcon: { fontSize: '48px', marginBottom: '16px', display: 'block', opacity: 0.4 },
    emptyStateTitle: { color: 'white', fontSize: '18px', fontWeight: '700', marginBottom: '8px', letterSpacing: '-0.3px' },
    emptyStateText: { color: 'rgba(255,255,255,0.3)', fontSize: '13px', margin: 0 },
    cardPremium: { background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '24px', marginBottom: '12px', textAlign: 'center' },
    cardIconBox: { fontSize: '40px', marginBottom: '14px', display: 'block' },
    cardTitle: { color: 'white', fontSize: '18px', fontWeight: '700', margin: '0 0 10px', letterSpacing: '-0.3px' },
    cardDescription: { color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: 1.6, margin: 0 },
    referralCodeBox: { background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '12px 16px', margin: '16px 0', border: '1px solid rgba(0,194,255,0.1)', textAlign: 'left', overflowX: 'auto' },
    referralCode: { fontSize: '11px', color: '#00C2FF', wordBreak: 'break-all', fontFamily: 'monospace' },
    copyBtnPremium: { width: '100%', padding: '12px', background: 'rgba(0,194,255,0.06)', border: '1px solid rgba(0,194,255,0.15)', borderRadius: '14px', color: '#00C2FF', fontWeight: '600', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s ease' },
    statsHeading: { color: 'white', fontSize: '16px', fontWeight: '700', margin: '0 0 16px', textAlign: 'left' },
    statRowPremium: { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' },
    statLabelPremium: { color: 'rgba(255,255,255,0.5)', fontSize: '13px' },
    statValuePremium: { color: 'white', fontSize: '13px', fontWeight: '700' },
    bottomNav: { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, display: 'flex', padding: '8px 12px', paddingBottom: 'calc(8px + env(safe-area-inset-bottom))', background: 'transparent', gap: '6px' },
    navItem: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: 'linear-gradient(135deg, rgba(0,194,255,0.15) 0%, rgba(255,51,102,0.08) 100%)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', border: '1px solid rgba(0, 194, 255, 0.3)', borderRadius: '16px', cursor: 'pointer', padding: '8px', transition: 'all 0.3s ease', opacity: 0.8 },
    navItemActive: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: 'linear-gradient(135deg,#00C2FF,#FF3366)', borderRadius: '16px', padding: '8px', color: 'white', fontWeight: '600', fontSize: '12px', boxShadow: '0 6px 25px rgba(0,194,255,0.4)', cursor: 'pointer', border: 'none', opacity: 1 },
    navItemIcon: { fontSize: '16px' },
    navItemLabel: { fontSize: '10px', fontWeight: '500', color: 'rgba(255,255,255,0.4)' },
    profilePanel: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 2 },
    profileHeaderFrosted: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'rgba(10, 5, 20, 0)', transition: 'opacity 0.3s ease, backdrop-filter 0.3s ease', borderBottom: '1px solid transparent' },
    profileHeaderTitle: { color: 'white', fontSize: '17px', fontWeight: '700', transition: 'opacity 0.3s ease' },
    backBtnPremium: { width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50%', color: 'white', cursor: 'pointer' },
    profileBody: { position: 'relative', zIndex: 10, flex: 1, overflowY: 'auto', paddingTop: '70px', paddingBottom: '20px' },
    profileAvatarSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px 10px' },
    profileAvatarRing: { padding: '3px', borderRadius: '50%', background: 'linear-gradient(135deg, #00C2FF, #FF3366)', marginBottom: '16px' },
    profileAvatarInner: { width: '84px', height: '84px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(10,0,20,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    profileAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    profileAvatarLetter: { fontSize: '36px', fontWeight: '700', color: 'white' },
    profileDisplayName: { fontSize: '22px', fontWeight: '800', color: 'white', margin: '0 0 6px', letterSpacing: '-0.5px' },
    profileDisplaySub: { fontSize: '13px', color: 'rgba(255,255,255,0.35)', margin: 0 },
    balanceDuo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '10px 20px 6px' },
    balanceCardPremium: { background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,51,102,0.1)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
    balanceCardLabel: { fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '1px' },
    balanceCardAmount: { fontSize: '28px', fontWeight: '800', color: '#FF3366', letterSpacing: '-1px' },
    profileSection: { padding: '8px 20px' },
    sectionLabel: { color: 'white', fontSize: '16px', fontWeight: '700', margin: '0 0 14px' },
    profileActionBtn: { width: '100%', padding: '14px 20px', marginBottom: '8px', background: 'rgba(0,194,255,0.04)', border: '1px solid rgba(0,194,255,0.1)', borderRadius: '14px', color: '#00C2FF', fontWeight: '700', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s ease' },
    walletCard: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,136,204,0.04)', border: '1px solid rgba(0,136,204,0.12)', borderRadius: '14px', padding: '12px 16px' },
    walletCardLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
    walletDot: { width: '8px', height: '8px', borderRadius: '50%', background: '#0088CC', boxShadow: '0 0 10px rgba(0,136,204,0.5)' },
    walletLabel: { margin: 0, fontSize: '12px', color: '#0088CC', fontWeight: '600' },
    walletAddress: { margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' },
    walletDisconnectBtn: { background: 'rgba(255,51,102,0.08)', border: '1px solid rgba(255,51,102,0.15)', borderRadius: '10px', padding: '6px 14px', color: '#FF3366', fontSize: '11px', fontWeight: '600', cursor: 'pointer' },
    connectWalletPremium: { width: '100%', padding: '14px', background: 'rgba(0,136,204,0.04)', border: '1px solid rgba(0,136,204,0.12)', borderRadius: '14px', color: '#0088CC', fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease' },
    filterRowPremium: { display: 'flex', gap: '8px', marginBottom: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '40px', padding: '4px', border: '1px solid rgba(0, 194, 255, 0.15)' },
    filterBtnPremium: { flex: 1, padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: '40px', color: 'rgba(255,255,255,0.5)', fontSize: '11px', cursor: 'pointer', fontWeight: '500' },
    filterBtnActivePremium: { flex: 1, padding: '8px 10px', background: 'rgba(0,194,255,0.15)', border: 'none', borderRadius: '40px', color: '#00C2FF', fontSize: '11px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 0 10px rgba(0,194,255,0.3)' },
    myQuestCardPremium: { display: 'flex', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', marginBottom: '8px' },
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
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300 },
    sheetPremium: { background: 'rgba(15,5,30,0.98)', backdropFilter: 'blur(60px)', borderRadius: '24px 24px 0 0', padding: '24px', width: '100%', maxWidth: '480px', border: '1px solid rgba(255,255,255,0.06)', borderBottom: 'none', boxSizing: 'border-box' },
    sheetHeaderPremium: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: 'white', fontSize: '18px', fontWeight: '800' },
    closePremium: { marginLeft: 'auto', background: 'rgba(255,255,255,0.04)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '14px', cursor: 'pointer' },
    textSecondary: { color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 16px' },
    inputPremium: { width: '100%', padding: '13px 16px', marginBottom: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', color: 'white', fontSize: '13px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' },
    textareaPremium: { width: '100%', padding: '13px 16px', marginBottom: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', color: 'white', fontSize: '13px', boxSizing: 'border-box', minHeight: '80px', fontFamily: 'inherit', resize: 'vertical', outline: 'none' },
    selectPremium: { width: '100%', padding: '13px 16px', marginBottom: '16px', background: 'rgba(15,5,30,0.98)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', color: 'white', fontSize: '13px', boxSizing: 'border-box', cursor: 'pointer', outline: 'none' },
    amountGridPremium: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' },
    amountBtnPremium: { padding: '12px 6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s ease' },
    amountBtnActivePremium: { padding: '12px 6px', background: 'rgba(0,194,255,0.08)', border: '1px solid rgba(0,194,255,0.25)', borderRadius: '12px', color: '#00C2FF', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 0 20px rgba(0,194,255,0.1)' },
    doubleButton: { display: 'flex', gap: '8px', marginTop: '16px' },
    btnPrimaryPremium: { flex: 1, padding: '14px', background: 'rgba(0,194,255,0.08)', border: '1px solid rgba(0,194,255,0.2)', borderRadius: '14px', color: '#00C2FF', fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease' },
    btnSecondaryPremium: { flex: 1, padding: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: '14px', cursor: 'pointer' },
    btnDangerPremium: { flex: 1, padding: '14px', background: 'rgba(255,51,102,0.1)', border: '1px solid rgba(255,51,102,0.2)', borderRadius: '14px', color: '#FF3366', fontWeight: '700', fontSize: '14px', cursor: 'pointer' },
    paymentWaitingPremium: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px', gap: '20px' },
    spinnerPremium: { width: '56px', height: '56px', borderRadius: '50%', border: '2px solid rgba(0,194,255,0.08)', borderTop: '2px solid #00C2FF', animation: 'spin 1s linear infinite' },
    paymentSuccessPremium: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', gap: '8px', textAlign: 'center' },
    loadingTextPremium: { color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '12px' },
    adminPanel: { background: 'rgba(15,5,30,0.99)', backdropFilter: 'blur(60px)', borderRadius: '24px 24px 0 0', padding: '24px', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderBottom: 'none', boxSizing: 'border-box' },
    adminHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' },
    adminHeaderLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
    adminHeaderIcon: { fontSize: '20px' },
    adminHeaderTitle: { color: 'white', fontSize: '18px', fontWeight: '800' },
    adminTabsPremium: { display: 'flex', background: 'rgba(255,255,255,0.02)', borderRadius: '40px', padding: '4px', marginBottom: '20px', border: '1px solid rgba(0, 194, 255, 0.15)' },
    adminTab: { flex: 1, padding: '10px', background: 'transparent', border: 'none', borderRadius: '40px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', cursor: 'pointer', fontWeight: '500', transition: 'all 0.3s ease' },
    adminTabActive: { flex: 1, padding: '10px', background: 'rgba(0,194,255,0.15)', border: 'none', borderRadius: '40px', color: '#00C2FF', fontSize: '13px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 0 15px rgba(0,194,255,0.3)' },
    adminTabCount: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: '20px', padding: '1px 8px', fontSize: '10px', marginLeft: '6px', color: 'white' },
    adminListArea: { display: 'flex', flexDirection: 'column', gap: '10px' },
    adminCardPremium: { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px' },
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
    // Новые стили для формы
    createTypeWrap: { display: 'flex', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '18px', marginBottom: '18px', gap: '4px' },
    createTypeBtn: { flex: 1, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.4)', padding: '10px', borderRadius: '14px', fontWeight: '600', transition: 'all 0.25s ease', cursor: 'pointer', fontSize: '13px' },
    createTypeActive: { flex: 1, border: 'none', background: 'linear-gradient(135deg,#00C2FF,#FF3366)', color: 'white', padding: '10px', borderRadius: '14px', fontWeight: '700', boxShadow: '0 6px 20px rgba(0,194,255,0.3)', cursor: 'pointer', fontSize: '13px' },
    infoBoxBlue: { background: 'rgba(0,194,255,0.06)', border: '1px solid rgba(0,194,255,0.15)', borderRadius: '14px', padding: '12px', marginBottom: '14px', color: '#00C2FF', fontSize: '12px' },
    infoBoxPurple: { background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)', borderRadius: '14px', padding: '12px', marginBottom: '14px', color: '#A855F7', fontSize: '12px' },
    infoBoxYellow: { background: 'rgba(255,193,7,0.06)', border: '1px solid rgba(255,193,7,0.15)', borderRadius: '14px', padding: '12px', marginBottom: '14px', color: '#FFC107', fontSize: '12px' },
    infoBoxGreen: { background: 'rgba(76,175,80,0.06)', border: '1px solid rgba(76,175,80,0.15)', borderRadius: '14px', padding: '12px', marginBottom: '14px', color: '#4CAF50', fontSize: '12px' },
};

const styleSheet = document.createElement("style");
styleSheet.textContent = `
    *, *::before, *::after { box-sizing: border-box; }
    html, body, #root { margin: 0; padding: 0; height: 100%; background: #0a0014; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
    input:focus, textarea:focus, select:focus { border-color: rgba(0,194,255,0.3) !important; }
    select, select option { background: rgba(15,5,30,0.99); color: white; }
    button { -webkit-tap-highlight-color: transparent; outline: none; font-family: inherit; cursor: pointer; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    button:not(:disabled):hover { filter: brightness(1.1); }
    button:not(:disabled):active { transform: scale(0.97); }
    * { -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
    input, textarea { -webkit-user-select: text; user-select: text; }
    *:focus { outline: none; }
    .questCardUltra:active { transform: scale(0.98); transition: transform 0.15s ease; }
    .ripple { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.3); transform: scale(0); animation: ripple 0.6s linear; pointer-events: none; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.05); opacity: 1; } }
    @keyframes loadbar { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes cardEntrance { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes orbMove1 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(3%, 2%) scale(1.05); } 66% { transform: translate(-2%, -1%) scale(0.95); } }
    @keyframes orbMove2 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(-3%, -2%) scale(1.05); } 66% { transform: translate(2%, 1%) scale(0.95); } }
    @keyframes orbMove3 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(2%, -3%) scale(1.08); } }
    @keyframes orbMove4 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-2%, 2%) scale(1.06); } }
    @keyframes shine { 0% { transform: translateX(-100%);} 100% { transform: translateX(200%);} }
    @keyframes ripple { to { transform: scale(4); opacity: 0; } }
    @keyframes bgMove { 0% { background-position: 0% 0%, 100% 100%, center; } 50% { background-position: 10% 5%, 90% 95%, center; } 100% { background-position: 0% 0%, 100% 100%, center; } }
    .fadeInUp { animation: fadeInUp 0.5s ease both; }
    .cardEntrance { animation: cardEntrance 0.4s ease both; }
    ::-webkit-scrollbar { width: 0; }
`;
document.head.appendChild(styleSheet);

export default App;
```