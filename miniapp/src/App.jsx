Принял! Вот полностью готовый код с детальными оптимизациями для мобильных устройств, исправленным скроллингом и анимацией на всех активных заданиях. Код готов для вставки.

```jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { Address } from '@ton/core';

const API_URL = import.meta.env.VITE_API_URL || 'https://star-task.up.railway.app';

// ============ ОПТИМИЗАЦИИ ДЛЯ МОБИЛЬНЫХ ============
// Определяем ОДИН раз при старте
const IS_TOUCH = typeof window !== 'undefined' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches;

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
        <div style={IS_TOUCH ? {...st.modalOverlay, backdropFilter: 'none', background: 'rgba(0,0,0,0.85)'} : st.modalOverlay}>
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
            <div style={IS_TOUCH ? {...st.modalOverlay, backdropFilter: 'none', background: 'rgba(0,0,0,0.85)'} : st.modalOverlay}>
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
                                        <input
                                            type="number"
                                            value={newRate}
                                            onChange={(e) => setNewRate(e.target.value)}
                                            placeholder="Новый курс"
                                            style={{...st.inputPremium, marginBottom: 0, flex: 1}}
                                        />
                                        <button onClick={updateRate} style={{...st.btnApprovePremium, whiteSpace: 'nowrap'}}>
                                            Сохранить
                                        </button>
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
                                            <button onClick={() => completeWithdrawal(w.id)} style={st.btnApprovePremium}>
                                                ✅ Отметить как выполнено
                                            </button>
                                        </div>
                                    ))
                                }
                            </>
                        )}
                    </div>
                </div>
            </div>
            
            {showRejectModal && (
                <div style={IS_TOUCH ? {...st.modalOverlay, backdropFilter: 'none', background: 'rgba(0,0,0,0.85)'} : st.modalOverlay}>
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

    // На тач — не навешиваем parallax вообще
    useEffect(() => {
        if (IS_TOUCH) return;
        let raf = 0;
        let lastY = 0;
        const handleScroll = () => {
            lastY = window.scrollY;
            if (raf) return;
            raf = requestAnimationFrame(() => {
                document.documentElement.style.setProperty('--parallax', `${lastY * 0.05}px`);
                raf = 0;
            });
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => { window.removeEventListener('scroll', handleScroll); if (raf) cancelAnimationFrame(raf); };
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
            fetchBalance(response.data.user.id);
            fetchTonBalance(response.data.user.id);
            fetchTasks(response.data.user.id);
            fetchMyQuests(response.data.user.id);
            fetchConversionRate();
        } catch (error) { console.error('Auth error:', error); } finally { setLoading(false); }
    };

    const fetchBalance = async (userId) => {
        try { const r = await axios.get(`${API_URL}/api/user/${userId}/balance`); setBalance(r.data.balance); } catch (e) { console.error(e); }
    };
    const fetchTonBalance = async (userId) => {
        try { const r = await axios.get(`${API_URL}/api/user/${userId}/ton-balance`); setTonBalance(r.data.balance); } catch (e) { console.error(e); }
    };
    
    // Оптимизированный fetchTasks с батчингом запросов
    const fetchTasks = async (userId) => {
        try {
            const [allTasksRes, completionsRes] = await Promise.all([
                axios.get(`${API_URL}/api/quests`),
                axios.get(`${API_URL}/api/user/${userId}/completions`)
            ]);
            const allTasks = allTasksRes.data;
            const completedIds = completionsRes.data.map(c => c.quest_id);
            setActiveTasks(allTasks.filter(t => !completedIds.includes(t.id) && t.advertiser_id !== userId));
            setCompletedTasks(allTasks.filter(t => completedIds.includes(t.id)));

            // Батчинг аватаров — все запросы параллельно
            const avatarPromises = allTasks
                .filter(t => t.type === 'subscription' && t.target_url.includes('t.me/'))
                .map(async (task) => {
                    const username = task.target_url.split('t.me/')[1].replace('/', '');
                    try {
                        const r = await axios.get(`${API_URL}/api/channel/avatar/${username}`);
                        return [task.id, r.data.success ? r.data.avatar : null];
                    } catch { return [task.id, null]; }
                });

            const avatarResults = await Promise.all(avatarPromises);
            const avatarMap = Object.fromEntries(avatarResults);
            setChannelAvatars(avatarMap);

            // NFT фоны — только если не тач (тяжёлая операция + blur)
            if (!IS_TOUCH) {
                const nftTasks = allTasks.filter(t => t.nft_gift_url);
                const nftPromises = nftTasks.map(async (task) => {
                    try {
                        const nftRes = await axios.post(`${API_URL}/api/parse-nft-background`, { nftUrl: task.nft_gift_url });
                        if (nftRes.data.success && nftRes.data.backgroundImage) {
                            return [task.id, { background: nftRes.data.backgroundImage, pattern: nftRes.data.patternImage }];
                        }
                    } catch { }
                    return null;
                });
                const nftResults = (await Promise.all(nftPromises)).filter(Boolean);
                if (nftResults.length) setNftBackgrounds(Object.fromEntries(nftResults));
            }
        } catch (e) { console.error(e); }
    };
    
    const fetchMyQuests = async (userId) => {
        try { const r = await axios.get(`${API_URL}/api/user/${userId}/quests`); setMyQuests(r.data); } catch (e) { console.error(e); }
    };
    const fetchConversionRate = async () => {
        try {
            const r = await axios.get(`${API_URL}/api/settings/rate`);
            setConversionRate(r.data.rate);
        } catch (e) { console.error(e); }
    };
    const fetchNftPreview = async (url) => {
        if (!url || !url.includes('t.me/nft/')) return;
        try {
            const r = await axios.post(`${API_URL}/api/parse-nft-background`, { nftUrl: url });
            if (r.data.success) {
                setNftPreview(r.data);
            } else {
                setNftPreview(null);
            }
        } catch (e) {
            setNftPreview(null);
        }
    };

    const convertStarsToTon = async () => {
        try {
            setConvertStep('waiting');
            const response = await axios.post(`${API_URL}/api/convert/stars-to-ton`, { userId: user.id, starsAmount: convertAmount });
            if (response.data.success) { setConvertStep('success'); fetchBalance(user.id); fetchTonBalance(user.id); }
        } catch (error) {
            setConvertStep('select');
            window.Telegram.WebApp.showPopup({ title: 'Ошибка', message: error.response?.data?.error || 'Ошибка конвертации', buttons: [{ type: 'ok' }] });
        }
    };

    const withdrawTon = async () => {
        if (!wallet) {
            window.Telegram.WebApp.showPopup({ title: 'Ошибка', message: 'Подключите TON кошелёк', buttons: [{ type: 'ok' }] });
            return;
        }
        try {
            setWithdrawStep('waiting');
            const response = await axios.post(`${API_URL}/api/withdraw/ton`, { userId: user.id, amount: withdrawAmount });
            if (response.data.success) setWithdrawStep('success');
        } catch (error) {
            setWithdrawStep('select');
            window.Telegram.WebApp.showPopup({ title: 'Ошибка', message: error.response?.data?.error || 'Ошибка вывода', buttons: [{ type: 'ok' }] });
        }
    };

    const fetchChannelAvatar = async (username, taskId) => {
        try {
            const r = await axios.get(`${API_URL}/api/channel/avatar/${username}`);
            setChannelAvatars(prev => ({ ...prev, [taskId]: r.data.success ? r.data.avatar : null }));
        } catch (e) { setChannelAvatars(prev => ({ ...prev, [taskId]: null })); }
    };

    const createRipple = (e) => {
        const button = e.currentTarget;
        const circle = document.createElement('span');
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;
        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${e.clientX - button.offsetLeft - radius}px`;
        circle.style.top = `${e.clientY - button.offsetTop - radius}px`;
        circle.classList.add('ripple');
        const ripple = button.getElementsByClassName('ripple')[0];
        if (ripple) ripple.remove();
        button.appendChild(circle);
    };

    // На тач — не вешаем обработчик
    const handleCardMove = IS_TOUCH ? undefined : (e) => {
        const card = e.currentTarget;
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--y', `${e.clientY - rect.top}px`);
    };

    const completeTask = async (taskId, taskUrl, channelUsername, inviteLink, verificationType, postUrl, referralUrl) => {
        const tg = window.Telegram.WebApp;
        let linkToOpen = taskUrl;
        if (verificationType === 'invite' && inviteLink) linkToOpen = inviteLink;
        if (verificationType === 'repost' && postUrl) linkToOpen = postUrl;
        if (verificationType === 'referral' && referralUrl) linkToOpen = referralUrl;
        tg.openLink(linkToOpen);
        tg.MainButton.show(); tg.MainButton.setText('⏳ Проверка...'); tg.MainButton.disable();
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

        if (!title || !description || !reward || !targetUrl || !totalBudget) {
            tg.showPopup({ title: 'Ошибка', message: 'Заполните все поля включая бюджет', buttons: [{ type: 'ok' }] });
            return;
        }

        if (parseInt(totalBudget) < parseInt(reward)) {
            tg.showPopup({ title: 'Ошибка', message: 'Бюджет не может быть меньше награды', buttons: [{ type: 'ok' }] });
            return;
        }

        const maxParticipants = Math.floor(parseInt(totalBudget) / parseInt(reward));

        let commissionAmount = 0;
        if (questType === 'extended') {
            const baseCommission = Math.max(50, Math.floor(reward * 0.05));
            const socialLinksCount = Object.values(socialLinks).filter(v => v).length;
            commissionAmount = baseCommission + (socialLinksCount * 100);
        }

        try {
            const response = await axios.post(`${API_URL}/api/create-quest`, {
                userId: user.id, title, description, reward, targetUrl,
                inviteLink: inviteLinkInput || null,
                totalBudget: parseInt(totalBudget),
                verificationType,
                questType,
                extendedDescription: extendedDescription || null,
                screenshots: screenshots.filter(s => s) || null,
                nftGiftUrl: nftGiftUrl || null,
                postUrl: postUrl || null,
                referralUrl: referralUrl || null,
                socialLinks: Object.values(socialLinks).some(v => v) ? socialLinks : null,
                subscribersCount: subscribersCount ? parseInt(subscribersCount) : null
            });

            if (response.data.success) {
                const commissionMsg = commissionAmount > 0 
                    ? `\n\n💳 При одобрении: ${commissionAmount} ⭐ комиссии` 
                    : '';
                const budgetMsg = `\n👥 Макс. участников: ${maxParticipants}`;
                tg.showPopup({ 
                    title: '✅ Задание создано!', 
                    message: response.data.message + budgetMsg + commissionMsg, 
                    buttons: [{ type: 'ok' }] 
                });
                setShowCreateForm(false);
                fetchMyQuests(user.id);
                fetchTasks(user.id);
                [titleInput, descInput, rewardInput, channelInput].forEach(ref => { if (ref.current) ref.current.value = ''; });
                setVerificationType('admin');
                setInviteLinkInput('');
                setQuestType('basic');
                setExtendedDescription('');
                setScreenshots(['', '', '']);
                setSocialLinks({ telegram: '', instagram: '', youtube: '', tiktok: '' });
                setSubscribersCount('');
                setNftGiftUrl('');
                setPostUrl('');
                setReferralUrl('');
                setNftPreview(null);
                setTotalBudget('');
            }
        } catch (error) {
            tg.showPopup({ title: 'Ошибка', message: error.response?.data?.error || 'Ошибка', buttons: [{ type: 'ok' }] });
        }
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
            <div style={st.loadingGlow1}></div>
            <div style={st.loadingGlow2}></div>
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

    // ---- PROFILE ----
    if (showProfile) return (
        <div style={IS_TOUCH ? {...st.profileOverlay, backgroundAttachment: 'scroll'} : st.profileOverlay}>
            <div style={{...st.bgNeonGrid, transform: IS_TOUCH ? 'none' : 'translateY(var(--parallax, 0px))'}}></div>
            <div style={{...st.bgOrb1, animation: IS_TOUCH ? 'none' : undefined, filter: IS_TOUCH ? 'blur(40px)' : 'blur(120px)', transform: IS_TOUCH ? 'none' : 'translateY(var(--parallax, 0px))'}}></div>
            <div style={{...st.bgOrb2, animation: IS_TOUCH ? 'none' : undefined, filter: IS_TOUCH ? 'blur(40px)' : 'blur(120px)', transform: IS_TOUCH ? 'none' : 'translateY(var(--parallax, 0px))'}}></div>
            <div style={{...st.bgOrb3, animation: IS_TOUCH ? 'none' : undefined, filter: IS_TOUCH ? 'blur(40px)' : 'blur(120px)', transform: IS_TOUCH ? 'none' : 'translateY(var(--parallax, 0px))'}}></div>
            <div style={{...st.bgOrb4, animation: IS_TOUCH ? 'none' : undefined, filter: IS_TOUCH ? 'blur(40px)' : 'blur(120px)', transform: IS_TOUCH ? 'none' : 'translateY(var(--parallax, 0px))'}}></div>

            <div style={{...st.profileHeaderFrosted, opacity: Math.min(profileScrollY / 60, 0.85), backdropFilter: IS_TOUCH ? 'none' : `blur(${Math.min(profileScrollY / 2, 30)}px)`, background: IS_TOUCH ? 'rgba(10,5,20,0.9)' : undefined }}>
                <button onClick={() => setShowProfile(false)} style={st.backBtnPremium}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                </button>
                <span style={{...st.profileHeaderTitle, opacity: Math.min(profileScrollY / 80, 1) }}>Профиль</span>
                <div style={{width:36}}></div>
            </div>

            <div style={{...st.profileBody, WebkitOverflowScrolling: 'touch'}} onScroll={(e) => setProfileScrollY(e.currentTarget.scrollTop)}>
                <div style={st.profileAvatarSection}>
                    <div style={st.profileAvatarRing}>
                        <div style={st.profileAvatarInner}>
                            {user?.photo_url ? <img src={user.photo_url} alt="avatar" style={st.profileAvatarImg} /> : <span style={st.profileAvatarLetter}>{user?.username?.charAt(0).toUpperCase() || '👤'}</span>}
                        </div>
                    </div>
                    <h2 style={st.profileDisplayName}>{user?.first_name || user?.username}</h2>
                    <p style={st.profileDisplaySub}>@{user?.username} · ID {user?.telegram_id}</p>
                </div>

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

                <div style={st.profileSection}>
                    {wallet ? (
                        <div style={st.walletCard}>
                            <div style={st.walletCardLeft}>
                                <div style={st.walletDot}></div>
                                <div><p style={st.walletLabel}>TON кошелёк подключён</p><p style={st.walletAddress}>{getFriendlyAddress()}</p></div>
                            </div>
                            <button onClick={() => tonConnectUI.disconnect()} style={st.walletDisconnectBtn}>Отключить</button>
                        </div>
                    ) : (
                        <button onClick={() => tonConnectUI.openModal()} style={st.connectWalletPremium}>💎 Подключить TON кошелёк</button>
                    )}
                </div>

                <div style={st.profileSection}>
                    <button onClick={() => setShowCreateForm(true)} style={st.profileActionBtn}><span>✨</span> Создать задание</button>
                    <button onClick={() => setShowTopUpModal(true)} style={{...st.profileActionBtn, background: 'rgba(255,210,0,0.05)', borderColor: 'rgba(255,210,0,0.15)', color: '#FFD200'}}><span>⭐</span> Пополнить Stars</button>
                    <button onClick={() => setShowTonTopUpModal(true)} style={{...st.profileActionBtn, background: 'rgba(0,136,204,0.05)', borderColor: 'rgba(0,136,204,0.15)', color: '#0088CC'}}><span>💎</span> Пополнить TON</button>
                    <button onClick={() => setShowConvertModal(true)} style={{...st.profileActionBtn, background: 'rgba(255,193,7,0.05)', borderColor: 'rgba(255,193,7,0.15)', color: '#FFC107'}}><span>🔄</span> Конвертировать Stars → TON</button>
                    <button onClick={() => setShowWithdrawModal(true)} style={{...st.profileActionBtn, background: 'rgba(76,175,80,0.05)', borderColor: 'rgba(76,175,80,0.15)', color: '#4CAF50'}}><span>💸</span> Вывести TON</button>
                    {user?.telegram_id && String(user.telegram_id) === "850997324" && (
                        <button onClick={() => setShowAdminPanel(true)} style={{...st.profileActionBtn, background: 'rgba(255,51,102,0.05)', borderColor: 'rgba(255,51,102,0.15)', color: '#FF3366'}}><span>🛡️</span> Панель администратора</button>
                    )}
                </div>

                {myQuests.length > 0 && (
                    <div style={st.profileSection}>
                        <h3 style={st.sectionLabel}>Мои задания</h3>
                        <div style={st.filterRowPremium}>
                            {[['pending', 'На модерации'], ['active', 'Принято'], ['rejected', 'Отклонено']].map(([val, label]) => (
                                <button key={val} onClick={() => setQuestStatusFilter(val)} style={questStatusFilter === val ? st.filterBtnActivePremium : st.filterBtnPremium}>{label}</button>
                            ))}
                        </div>
                        {myQuests.filter(q => q.status === questStatusFilter).length === 0 ? <div style={st.emptySmallPremium}>Нет заданий</div> : myQuests.filter(q => q.status === questStatusFilter).map(quest => (
                            <div key={quest.id} style={st.myQuestCardPremium}>
                                <div style={{...st.myQuestAvatarBox, background: channelAvatars[quest.id] ? 'transparent' : getChannelColor(quest.title)}}>
                                    {channelAvatars[quest.id] ? <img src={channelAvatars[quest.id]} alt="" style={st.myQuestAvatarImg} /> : <span>{getChannelInitial(quest.title, quest.target_url)}</span>}
                                </div>
                                <div style={st.myQuestContent}>
                                    <p style={st.myQuestTitlePremium}>{quest.title}</p>
                                    <p style={st.myQuestDescPremium}>{quest.description}</p>
                                    <div style={st.myQuestFooterPremium}>
                                        <span style={st.myQuestReward}>+{quest.reward} ⭐</span>
                                        <span style={{...st.statusTag, ...(quest.status === 'pending' && {background:'rgba(255,193,7,0.12)', color:'#FFC107'}), ...(quest.status === 'active' && {background:'rgba(76,175,80,0.12)', color:'#4CAF50'}), ...(quest.status === 'rejected' && {background:'rgba(255,51,102,0.12)', color:'#FF3366'})}}>
                                            {quest.status === 'pending' && 'На модерации'}{quest.status === 'active' && 'Опубликовано'}{quest.status === 'rejected' && 'Отклонено'}{quest.status === 'inactive' && 'Снято'}
                                        </span>
                                    </div>
                                    {quest.status === 'rejected' && quest.rejection_reason && <p style={st.rejectionReasonText}>📝 {quest.rejection_reason}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

{showCreateForm && (() => {
    const typeMeta = {
        admin:    { icon: '📢', title: 'Подписка',  desc: 'Подписаться на канал', color: '#00C2FF', rgb: '0,194,255' },
        invite:   { icon: '🔗', title: 'Инвайт',    desc: 'Вступить по ссылке',   color: '#A855F7', rgb: '168,85,247' },
        repost:   { icon: '🔁', title: 'Репост',    desc: 'Переслать запись',     color: '#FFC107', rgb: '255,193,7' },
        referral: { icon: '👥', title: 'Реферал',   desc: 'Переход по ссылке',    color: '#4CAF50', rgb: '76,175,80' },
    };
    const cur = typeMeta[verificationType];
    const rewardVal = parseInt(rewardInput.current?.value) || 0;
    const budgetVal = parseInt(totalBudget) || 0;
    const maxParticipants = rewardVal > 0 && budgetVal >= rewardVal ? Math.floor(budgetVal / rewardVal) : 0;
    const proCommission = questType === 'extended' ? Math.max(50, Math.round(budgetVal * 0.05)) : 0;
    const socialsCount = questType === 'extended' ? Object.values(socialLinks).filter(v => v && v.trim()).length : 0;
    const totalCost = budgetVal + proCommission + socialsCount * 100;

    return (
    <div style={IS_TOUCH ? {...st.modalOverlay, backdropFilter: 'none', background: 'rgba(0,0,0,0.85)'} : st.modalOverlay}>
        <div style={{
            background: 'rgba(8,4,20,0.97)',
            backdropFilter: IS_TOUCH ? 'none' : 'blur(60px)',
            borderRadius: '28px 28px 0 0',
            width: '100%',
            maxWidth: '480px',
            maxHeight: '94vh',
            border: '1px solid rgba(255,255,255,0.07)',
            borderBottom: 'none',
            boxSizing: 'border-box',
            position: 'relative',
            overflow: 'hidden',
            animation: 'fadeInUp 0.35s ease'
        }}>
            <div className="ctOrb" style={{
                position: 'absolute', top: '-80px', right: '-60px', width: '260px', height: '260px',
                borderRadius: '50%', filter: IS_TOUCH ? 'blur(30px)' : 'blur(70px)', pointerEvents: 'none', zIndex: 0,
                background: `radial-gradient(circle, rgba(${cur.rgb},0.35), transparent 70%)`,
                transition: 'background 0.5s ease',
                animation: IS_TOUCH ? 'none' : undefined
            }} />
            <div className="ctOrb" style={{
                position: 'absolute', bottom: '-100px', left: '-80px', width: '300px', height: '300px',
                borderRadius: '50%', filter: IS_TOUCH ? 'blur(30px)' : 'blur(80px)', pointerEvents: 'none', zIndex: 0,
                background: `radial-gradient(circle, rgba(${cur.rgb},0.18), transparent 70%)`,
                transition: 'background 0.5s ease',
                animation: IS_TOUCH ? 'none' : undefined
            }} />

            <div style={{position: 'relative', zIndex: 1, padding: '20px 22px 28px', overflowY: 'auto', maxHeight: '94vh', boxSizing: 'border-box', WebkitOverflowScrolling: 'touch'}}>

                <div style={{
                    width: '40px', height: '4px', borderRadius: '4px',
                    background: 'rgba(255,255,255,0.12)', margin: '0 auto 16px'
                }} />

                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                        <div style={{
                            width: '46px', height: '46px', borderRadius: '14px',
                            background: `linear-gradient(135deg, rgba(${cur.rgb},0.25), rgba(${cur.rgb},0.05))`,
                            border: `1px solid rgba(${cur.rgb},0.3)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
                            boxShadow: `0 8px 24px rgba(${cur.rgb},0.18)`,
                            transition: 'all 0.4s ease'
                        }}>{cur.icon}</div>
                        <div>
                            <p style={{margin: 0, color: 'white', fontSize: '19px', fontWeight: '800', letterSpacing: '-0.4px'}}>Новое задание</p>
                            <p key={verificationType} className="ctChip" style={{margin: '2px 0 0', color: cur.color, fontSize: '12px', fontWeight: '600'}}>
                                {cur.desc}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setShowCreateForm(false)} style={{
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '50%', width: '34px', height: '34px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)',
                        fontSize: '14px', cursor: 'pointer'
                    }}>✕</button>
                </div>

                <div style={{marginBottom: '22px'}}>
                    <p style={{margin: '0 0 12px', color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontWeight: '700', letterSpacing: '1.8px', textTransform: 'uppercase'}}>① Тип задания</p>
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                        {Object.entries(typeMeta).map(([id, m]) => {
                            const isActive = verificationType === id;
                            return (
                                <button key={id} className="ctTypeCard" onClick={() => setVerificationType(id)} style={{
                                    padding: '16px 14px',
                                    background: isActive ? `linear-gradient(135deg, rgba(${m.rgb},0.14), rgba(${m.rgb},0.04))` : 'rgba(255,255,255,0.025)',
                                    border: isActive ? `1.5px solid rgba(${m.rgb},0.5)` : '1.5px solid rgba(255,255,255,0.06)',
                                    borderRadius: '16px', cursor: 'pointer', textAlign: 'left',
                                    transition: 'all 0.25s ease',
                                    boxShadow: isActive ? `0 8px 28px rgba(${m.rgb},0.22)` : 'none',
                                    transform: isActive ? 'translateY(-2px)' : 'none'
                                }}>
                                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px'}}>
                                        <div style={{fontSize: '24px'}}>{m.icon}</div>
                                        {isActive && <div style={{
                                            width: '18px', height: '18px', borderRadius: '50%',
                                            background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '10px', color: 'white', fontWeight: '900',
                                            boxShadow: `0 0 12px ${m.color}80`
                                        }}>✓</div>}
                                    </div>
                                    <p style={{margin: '0 0 3px', color: isActive ? m.color : 'rgba(255,255,255,0.85)', fontSize: '14px', fontWeight: '700'}}>{m.title}</p>
                                    <p style={{margin: 0, color: 'rgba(255,255,255,0.35)', fontSize: '10.5px', lineHeight: 1.3}}>{m.desc}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div style={{marginBottom: '22px'}}>
                    <p style={{margin: '0 0 12px', color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontWeight: '700', letterSpacing: '1.8px', textTransform: 'uppercase'}}>② Ссылки</p>

                    {verificationType === 'admin' && (
                        <>
                            <div style={{
                                background: `rgba(${cur.rgb},0.05)`, border: `1px solid rgba(${cur.rgb},0.15)`,
                                borderRadius: '14px', padding: '12px 14px', marginBottom: '12px',
                                display: 'flex', alignItems: 'flex-start', gap: '10px'
                            }}>
                                <span style={{fontSize: '15px', marginTop: '1px'}}>ℹ️</span>
                                <p style={{margin: 0, fontSize: '11.5px', color: `rgba(${cur.rgb},0.85)`, lineHeight: 1.45}}>
                                    Добавьте <strong style={{color: cur.color}}>@StarTaskBot</strong> администратором канала — нужно для автоматической проверки подписки.
                                </p>
                            </div>
                            <input type="text" className="ctInput" placeholder="t.me/yourchannel" style={{...st.inputPremium, borderColor: `rgba(${cur.rgb},0.2)`, background: `rgba(${cur.rgb},0.03)`}} ref={channelInput} />
                        </>
                    )}
                    {verificationType === 'invite' && (
                        <>
                            <div style={{
                                background: `rgba(${cur.rgb},0.05)`, border: `1px solid rgba(${cur.rgb},0.15)`,
                                borderRadius: '14px', padding: '12px 14px', marginBottom: '12px',
                                display: 'flex', alignItems: 'flex-start', gap: '10px'
                            }}>
                                <span style={{fontSize: '15px', marginTop: '1px'}}>🔗</span>
                                <p style={{margin: 0, fontSize: '11.5px', color: `rgba(${cur.rgb},0.85)`, lineHeight: 1.45}}>
                                    Пользователь вступает по уникальной ссылке. Доверенная верификация.
                                </p>
                            </div>
                            <input type="text" className="ctInput" placeholder="t.me/+invite_code" style={{...st.inputPremium, borderColor: `rgba(${cur.rgb},0.2)`, background: `rgba(${cur.rgb},0.03)`}} value={inviteLinkInput} onChange={(e) => setInviteLinkInput(e.target.value)} />
                            <input type="text" className="ctInput" placeholder="Ссылка на канал (t.me/...)" style={st.inputPremium} ref={channelInput} />
                        </>
                    )}
                    {verificationType === 'repost' && (
                        <>
                            <div style={{
                                background: `rgba(${cur.rgb},0.05)`, border: `1px solid rgba(${cur.rgb},0.15)`,
                                borderRadius: '14px', padding: '12px 14px', marginBottom: '12px',
                                display: 'flex', alignItems: 'flex-start', gap: '10px'
                            }}>
                                <span style={{fontSize: '15px', marginTop: '1px'}}>🔁</span>
                                <p style={{margin: 0, fontSize: '11.5px', color: `rgba(${cur.rgb},0.85)`, lineHeight: 1.45}}>
                                    Пользователь пересылает пост. Доверенная верификация после перехода.
                                </p>
                            </div>
                            <input type="text" className="ctInput" placeholder="Ссылка на пост (t.me/channel/123)" style={{...st.inputPremium, borderColor: `rgba(${cur.rgb},0.2)`, background: `rgba(${cur.rgb},0.03)`}} value={postUrl} onChange={(e) => setPostUrl(e.target.value)} />
                            <input type="text" className="ctInput" placeholder="Ссылка на канал (t.me/...)" style={st.inputPremium} ref={channelInput} />
                        </>
                    )}
                    {verificationType === 'referral' && (
                        <>
                            <div style={{
                                background: `rgba(${cur.rgb},0.05)`, border: `1px solid rgba(${cur.rgb},0.15)`,
                                borderRadius: '14px', padding: '12px 14px', marginBottom: '12px',
                                display: 'flex', alignItems: 'flex-start', gap: '10px'
                            }}>
                                <span style={{fontSize: '15px', marginTop: '1px'}}>👥</span>
                                <p style={{margin: 0, fontSize: '11.5px', color: `rgba(${cur.rgb},0.85)`, lineHeight: 1.45}}>
                                    Пользователь переходит по реферальной ссылке. Доверенная верификация.
                                </p>
                            </div>
                            <input type="text" className="ctInput" placeholder="Реферальная ссылка (t.me/bot?start=ref...)" style={{...st.inputPremium, borderColor: `rgba(${cur.rgb},0.2)`, background: `rgba(${cur.rgb},0.03)`}} value={referralUrl} onChange={(e) => setReferralUrl(e.target.value)} />
                            <input type="text" className="ctInput" placeholder="Ссылка на канал/бота (t.me/...)" style={st.inputPremium} ref={channelInput} />
                        </>
                    )}
                </div>

                <div style={{marginBottom: '22px'}}>
                    <p style={{margin: '0 0 12px', color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontWeight: '700', letterSpacing: '1.8px', textTransform: 'uppercase'}}>③ Формат</p>
                    <div style={{
                        display: 'flex', padding: '4px', borderRadius: '16px',
                        background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)',
                        position: 'relative'
                    }}>
                        <div style={{
                            position: 'absolute', top: '4px', bottom: '4px',
                            left: questType === 'basic' ? '4px' : '50%',
                            width: 'calc(50% - 4px)',
                            borderRadius: '12px',
                            background: questType === 'extended'
                                ? 'linear-gradient(135deg, rgba(255,51,102,0.18), rgba(255,51,102,0.06))'
                                : 'rgba(255,255,255,0.06)',
                            border: questType === 'extended' ? '1px solid rgba(255,51,102,0.3)' : '1px solid rgba(255,255,255,0.1)',
                            transition: 'all 0.3s cubic-bezier(.4,1.4,.5,1)',
                            boxShadow: questType === 'extended' ? '0 4px 16px rgba(255,51,102,0.18)' : 'none'
                        }} />
                        <button onClick={() => setQuestType('basic')} style={{
                            flex: 1, padding: '12px 8px', borderRadius: '12px', cursor: 'pointer',
                            background: 'transparent', border: 'none', position: 'relative', zIndex: 1,
                            color: questType === 'basic' ? 'white' : 'rgba(255,255,255,0.4)',
                            transition: 'color 0.2s'
                        }}>
                            <p style={{margin: '0 0 2px', fontSize: '13.5px', fontWeight: '700'}}>📋 Базовое</p>
                            <p style={{margin: 0, fontSize: '10.5px', opacity: 0.6}}>Без комиссии</p>
                        </button>
                        <button onClick={() => setQuestType('extended')} style={{
                            flex: 1, padding: '12px 8px', borderRadius: '12px', cursor: 'pointer',
                            background: 'transparent', border: 'none', position: 'relative', zIndex: 1,
                            color: questType === 'extended' ? '#FF6B8A' : 'rgba(255,255,255,0.4)',
                            transition: 'color 0.2s'
                        }}>
                            <p style={{margin: '0 0 2px', fontSize: '13.5px', fontWeight: '700'}}>⭐ PRO</p>
                            <p style={{margin: 0, fontSize: '10.5px', opacity: 0.7}}>5% · приоритет</p>
                        </button>
                    </div>
                </div>

                <div style={{marginBottom: '22px'}}>
                    <p style={{margin: '0 0 12px', color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontWeight: '700', letterSpacing: '1.8px', textTransform: 'uppercase'}}>④ Детали</p>
                    <input type="text" className="ctInput" placeholder="Название задания" style={st.inputPremium} ref={titleInput} />
                    <textarea className="ctInput" placeholder="Краткое описание для пользователей" style={st.textareaPremium} ref={descInput} />

                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px'}}>
                        <div style={{
                            padding: '12px 14px', borderRadius: '14px',
                            background: 'linear-gradient(135deg, rgba(255,215,0,0.05), rgba(255,215,0,0.02))',
                            border: '1px solid rgba(255,215,0,0.12)'
                        }}>
                            <p style={{margin: '0 0 4px', color: 'rgba(255,215,0,0.7)', fontSize: '10.5px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px'}}>Награда</p>
                            <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                                <input type="number" className="ctInput" placeholder="5" style={{
                                    width: '100%', padding: '4px 0', background: 'transparent', border: 'none',
                                    color: 'white', fontSize: '20px', fontWeight: '800', outline: 'none', margin: 0
                                }} ref={rewardInput} onChange={(e) => setTotalBudget(t => t)} />
                                <span style={{fontSize: '16px'}}>⭐</span>
                            </div>
                        </div>
                        <div style={{
                            padding: '12px 14px', borderRadius: '14px',
                            background: `linear-gradient(135deg, rgba(${cur.rgb},0.05), rgba(${cur.rgb},0.02))`,
                            border: `1px solid rgba(${cur.rgb},0.15)`
                        }}>
                            <p style={{margin: '0 0 4px', color: `rgba(${cur.rgb},0.75)`, fontSize: '10.5px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px'}}>Бюджет</p>
                            <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                                <input type="number" className="ctInput" placeholder="500" style={{
                                    width: '100%', padding: '4px 0', background: 'transparent', border: 'none',
                                    color: 'white', fontSize: '20px', fontWeight: '800', outline: 'none', margin: 0
                                }} value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} />
                                <span style={{fontSize: '16px'}}>⭐</span>
                            </div>
                        </div>
                    </div>

                    {maxParticipants > 0 && (
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '14px', padding: '12px 14px', marginBottom: '10px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                <span style={{fontSize: '15px'}}>👥</span>
                                <span style={{fontSize: '12px', color: 'rgba(255,255,255,0.55)'}}>До <strong style={{color: 'white'}}>{maxParticipants}</strong> участников</span>
                            </div>
                            <div style={{
                                padding: '4px 10px', borderRadius: '8px',
                                background: `rgba(${cur.rgb},0.12)`, border: `1px solid rgba(${cur.rgb},0.25)`,
                                fontSize: '11px', color: cur.color, fontWeight: '700'
                            }}>{rewardVal} ⭐ × {maxParticipants}</div>
                        </div>
                    )}
                </div>

                <div style={{marginBottom: '22px'}}>
                    <p style={{margin: '0 0 12px', color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontWeight: '700', letterSpacing: '1.8px', textTransform: 'uppercase'}}>
                        ⑤ 🎁 NFT Подарок <span style={{color: 'rgba(255,255,255,0.2)', fontWeight: '500', textTransform: 'none', letterSpacing: '0'}}>— опционально</span>
                    </p>
                    <input type="text" className="ctInput" placeholder="t.me/nft/GiftName-12345" style={{
                        ...st.inputPremium,
                        borderColor: nftPreview ? 'rgba(255,215,0,0.35)' : undefined,
                        background: nftPreview ? 'rgba(255,215,0,0.04)' : undefined
                    }}
                        value={nftGiftUrl}
                        onChange={(e) => {
                            setNftGiftUrl(e.target.value);
                            if (e.target.value.length > 20) fetchNftPreview(e.target.value);
                            else setNftPreview(null);
                        }}
                    />
                    {nftPreview?.backgroundImage && (
                        <div style={{
                            height: '90px', borderRadius: '14px', overflow: 'hidden',
                            backgroundImage: `url(${nftPreview.backgroundImage})`,
                            backgroundSize: '200% auto', backgroundPosition: 'center',
                            filter: 'brightness(0.75)',
                            border: '1px solid rgba(255,215,0,0.25)',
                            marginBottom: '10px',
                            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 6px 24px rgba(255,215,0,0.12)'
                        }}>
                            <span style={{
                                background: 'rgba(0,0,0,0.55)', borderRadius: '20px', padding: '5px 14px',
                                fontSize: '11.5px', color: '#FFD700', fontWeight: '700',
                                border: '1px solid rgba(255,215,0,0.3)'
                            }}>🎁 Фон применён к карточке</span>
                        </div>
                    )}
                </div>

                {questType === 'extended' && (
                    <div style={{marginBottom: '22px'}}>
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(255,51,102,0.08), rgba(255,51,102,0.02))',
                            border: '1px solid rgba(255,51,102,0.2)',
                            borderRadius: '14px', padding: '12px 14px', marginBottom: '14px',
                            display: 'flex', alignItems: 'flex-start', gap: '10px'
                        }}>
                            <span style={{fontSize: '15px', marginTop: '1px'}}>⭐</span>
                            <p style={{margin: 0, fontSize: '11.5px', color: 'rgba(255,107,138,0.95)', lineHeight: 1.5}}>
                                PRO: <strong>5%</strong> от бюджета (мин. 50 ⭐) + <strong>100 ⭐</strong> за каждую соцсеть. Списывается при одобрении.
                            </p>
                        </div>
                        <p style={{margin: '0 0 10px', color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase'}}>PRO поля</p>
                        <textarea className="ctInput" placeholder="Подробное описание канала — тематика, аудитория..." style={{...st.textareaPremium, minHeight: '90px', borderColor: 'rgba(255,51,102,0.15)'}} value={extendedDescription} onChange={(e) => setExtendedDescription(e.target.value)} />
                        <input type="number" className="ctInput" placeholder="Количество подписчиков" style={{...st.inputPremium, borderColor: 'rgba(255,51,102,0.15)'}} value={subscribersCount} onChange={(e) => setSubscribersCount(e.target.value)} />
                        <p style={{margin: '6px 0 8px', color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '600'}}>📸 Скриншоты</p>
                        {screenshots.map((url, i) => (
                            <input key={i} type="text" className="ctInput" placeholder={`Скриншот ${i + 1}`} style={{...st.inputPremium, marginBottom: '8px', borderColor: 'rgba(255,51,102,0.12)'}} value={url} onChange={(e) => { const u = [...screenshots]; u[i] = e.target.value; setScreenshots(u); }} />
                        ))}
                        <p style={{margin: '6px 0 8px', color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '600'}}>🌐 Соцсети <span style={{color: 'rgba(255,51,102,0.7)'}}>+100 ⭐ каждая</span></p>
                        {[['telegram','✈️ Telegram'],['instagram','📸 Instagram'],['youtube','▶️ YouTube'],['tiktok','🎵 TikTok']].map(([key, label]) => (
                            <input key={key} type="text" className="ctInput" placeholder={label} style={{...st.inputPremium, marginBottom: '8px', borderColor: socialLinks[key] ? 'rgba(255,51,102,0.3)' : 'rgba(255,51,102,0.1)', background: socialLinks[key] ? 'rgba(255,51,102,0.04)' : undefined}} value={socialLinks[key]} onChange={(e) => setSocialLinks(p => ({...p, [key]: e.target.value}))} />
                        ))}
                    </div>
                )}

                {budgetVal > 0 && (
                    <div style={{
                        marginBottom: '14px', padding: '14px 16px',
                        background: `linear-gradient(135deg, rgba(${cur.rgb},0.08), rgba(255,255,255,0.02))`,
                        border: `1px solid rgba(${cur.rgb},0.2)`,
                        borderRadius: '16px'
                    }}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                            <span style={{fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase'}}>К оплате</span>
                            <span style={{fontSize: '20px', fontWeight: '900', color: 'white'}}>{totalCost} <span style={{fontSize: '15px'}}>⭐</span></span>
                        </div>
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px'}}>
                            <span style={{fontSize: '10.5px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)'}}>Бюджет {budgetVal}⭐</span>
                            {proCommission > 0 && <span style={{fontSize: '10.5px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,51,102,0.1)', color: '#FF6B8A'}}>+ комиссия {proCommission}⭐</span>}
                            {socialsCount > 0 && <span style={{fontSize: '10.5px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,51,102,0.1)', color: '#FF6B8A'}}>+ {socialsCount} соцсет.</span>}
                            <span style={{fontSize: '10.5px', padding: '3px 8px', borderRadius: '6px', background: `rgba(${cur.rgb},0.1)`, color: cur.color}}>Баланс: {balance}⭐</span>
                        </div>
                    </div>
                )}

                <button className="ctCreateBtn" onClick={createQuest} style={{
                    width: '100%', padding: '17px', borderRadius: '18px', cursor: 'pointer',
                    background: `linear-gradient(135deg, rgba(${cur.rgb},0.28), rgba(${cur.rgb},0.1))`,
                    border: `1px solid rgba(${cur.rgb},0.45)`,
                    color: cur.color,
                    fontSize: '15.5px', fontWeight: '800', letterSpacing: '-0.2px',
                    marginTop: '4px', transition: 'all 0.2s ease',
                    boxShadow: `0 8px 32px rgba(${cur.rgb},0.22), inset 0 1px 0 rgba(255,255,255,0.08)`
                }}>
                    {cur.icon} Создать задание
                </button>

            </div>
        </div>
    </div>
    );
})()}

            {showTonTopUpModal && (
                <div style={IS_TOUCH ? {...st.modalOverlay, backdropFilter: 'none', background: 'rgba(0,0,0,0.85)'} : st.modalOverlay}>
                    <div style={IS_TOUCH ? {...st.sheetPremium, backdropFilter: 'none', background: 'rgb(15,5,30)'} : st.sheetPremium}>
                        <div style={st.sheetHeaderPremium}><span>💎</span><h3>Пополнение TON</h3><button onClick={() => { setShowTonTopUpModal(false); setTonPaymentStep('select'); }} style={st.closePremium}>✕</button></div>
                        {tonPaymentStep === 'select' && <>
                            <p style={st.textSecondary}>Выберите сумму пополнения:</p>
                            <div style={st.amountGridPremium}>{[0.5, 1, 2, 5, 10, 20].map(amt => (<button key={amt} onClick={() => setTonTopUpAmount(amt)} style={tonTopUpAmount === amt ? st.amountBtnActivePremium : st.amountBtnPremium}>{amt} 💎</button>))}</div>
                            <button onClick={sendTonPayment} style={{...st.btnPrimaryPremium, marginTop:'20px', background: 'rgba(0,136,204,0.12)', borderColor: 'rgba(0,136,204,0.3)', color: '#0088CC'}}>Оплатить {tonTopUpAmount} TON</button>
                        </>}
                        {tonPaymentStep === 'waiting' && (<div style={st.paymentWaitingPremium}><div style={st.spinnerPremium}></div><p style={st.textSecondary}>Ожидание подтверждения транзакции...</p></div>)}
                        {tonPaymentStep === 'success' && (<div style={st.paymentSuccessPremium}><span style={{fontSize:'64px'}}>✅</span><h3 style={{color:'white', margin:'12px 0 4px'}}>Готово</h3><p style={st.textSecondary}>+{tonTopUpAmount} TON зачислено на баланс</p><button onClick={() => { setShowTonTopUpModal(false); setTonPaymentStep('select'); }} style={st.btnPrimaryPremium}>Закрыть</button></div>)}
                    </div>
                </div>
            )}

            {showTopUpModal && (
                <div style={IS_TOUCH ? {...st.modalOverlay, backdropFilter: 'none', background: 'rgba(0,0,0,0.85)'} : st.modalOverlay}>
                    <div style={IS_TOUCH ? {...st.sheetPremium, backdropFilter: 'none', background: 'rgb(15,5,30)'} : st.sheetPremium}>
                        <div style={st.sheetHeaderPremium}><span>⭐</span><h3>Пополнение Stars</h3><button onClick={() => setShowTopUpModal(false)} style={st.closePremium}>✕</button></div>
                        <p style={st.textSecondary}>Выберите сумму пополнения:</p>
                        <div style={st.amountGridPremium}>{[1, 50, 100, 250, 500, 1000].map(amt => (<button key={amt} onClick={() => setTopUpAmount(amt)} style={topUpAmount === amt ? st.amountBtnActivePremium : st.amountBtnPremium}>{amt} ⭐</button>))}</div>
                        <div style={st.doubleButton}><button onClick={() => setShowTopUpModal(false)} style={st.btnSecondaryPremium}>Отмена</button><button onClick={createInvoice} style={st.btnPrimaryPremium}>Оплатить</button></div>
                    </div>
                </div>
            )}

            {showConvertModal && (
    <div style={IS_TOUCH ? {...st.modalOverlay, backdropFilter: 'none', background: 'rgba(0,0,0,0.85)'} : st.modalOverlay}>
        <div style={IS_TOUCH ? {...st.sheetPremium, backdropFilter: 'none', background: 'rgb(15,5,30)'} : st.sheetPremium}>
            <div style={st.sheetHeaderPremium}><span>🔄</span><h3>Stars → TON</h3><button onClick={() => { setShowConvertModal(false); setConvertStep('select'); }} style={st.closePremium}>✕</button></div>
            {convertStep === 'select' && <>
                <p style={st.textSecondary}>Курс: {conversionRate} ⭐ = 1 💎 TON · Ваш баланс: {balance} ⭐</p>
                <div style={st.amountGridPremium}>{[conversionRate, conversionRate * 2, conversionRate * 5, conversionRate * 10].map(amt => (<button key={amt} onClick={() => setConvertAmount(amt)} style={convertAmount === amt ? st.amountBtnActivePremium : st.amountBtnPremium}>{amt} ⭐</button>))}</div>
                <p style={{...st.textSecondary, textAlign: 'center', marginTop: '12px'}}>Получите: <strong style={{color: '#29B6F6'}}>{(convertAmount / conversionRate).toFixed(2)} TON</strong></p>
                <button onClick={convertStarsToTon} style={{...st.btnPrimaryPremium, marginTop: '8px'}}>Конвертировать</button>
            </>}
            {convertStep === 'waiting' && (<div style={st.paymentWaitingPremium}><div style={st.spinnerPremium}></div><p style={st.textSecondary}>Выполняем конвертацию...</p></div>)}
            {convertStep === 'success' && (<div style={st.paymentSuccessPremium}><span style={{fontSize: '52px'}}>✅</span><h3 style={{color: 'white', margin: '12px 0 4px'}}>Готово!</h3><p style={st.textSecondary}>{convertAmount} ⭐ → {(convertAmount / conversionRate).toFixed(2)} TON зачислено</p><button onClick={() => { setShowConvertModal(false); setConvertStep('select'); }} style={st.btnPrimaryPremium}>Закрыть</button></div>)}
        </div>
    </div>
)}

{showWithdrawModal && (
    <div style={IS_TOUCH ? {...st.modalOverlay, backdropFilter: 'none', background: 'rgba(0,0,0,0.85)'} : st.modalOverlay}>
        <div style={IS_TOUCH ? {...st.sheetPremium, backdropFilter: 'none', background: 'rgb(15,5,30)'} : st.sheetPremium}>
            <div style={st.sheetHeaderPremium}><span>💸</span><h3>Вывод TON</h3><button onClick={() => { setShowWithdrawModal(false); setWithdrawStep('select'); }} style={st.closePremium}>✕</button></div>
            {withdrawStep === 'select' && <>
                <p style={st.textSecondary}>Доступно: {parseFloat(tonBalance || 0).toFixed(3)} TON · Минимум 0.1 TON</p>
                {wallet ? (<div style={{...st.walletCard, marginBottom: '16px'}}><div style={st.walletCardLeft}><div style={st.walletDot}></div><div><p style={st.walletLabel}>Вывод на кошелёк</p><p style={st.walletAddress}>{getFriendlyAddress()}</p></div></div></div>) : (<p style={{...st.textSecondary, color: '#FF3366'}}>⚠️ Подключите TON кошелёк для вывода</p>)}
                <div style={st.amountGridPremium}>{[0.1, 0.5, 1, 2].map(amt => (<button key={amt} onClick={() => setWithdrawAmount(amt)} style={withdrawAmount === amt ? st.amountBtnActivePremium : st.amountBtnPremium}>{amt} 💎</button>))}</div>
                <p style={{...st.textSecondary, fontSize: '11px', textAlign: 'center', marginTop: '12px'}}>⏱ Обработка заявки до 24 часов</p>
                <button onClick={withdrawTon} disabled={!wallet} style={{...st.btnPrimaryPremium, marginTop: '8px', opacity: wallet ? 1 : 0.5}}>Подать заявку на вывод</button>
            </>}
            {withdrawStep === 'waiting' && (<div style={st.paymentWaitingPremium}><div style={st.spinnerPremium}></div><p style={st.textSecondary}>Создаём заявку...</p></div>)}
            {withdrawStep === 'success' && (<div style={st.paymentSuccessPremium}><span style={{fontSize: '52px'}}>📬</span><h3 style={{color: 'white', margin: '12px 0 4px'}}>Заявка принята!</h3><p style={st.textSecondary}>{withdrawAmount} TON будет отправлен на ваш кошелёк в течение 24 часов</p><button onClick={() => { setShowWithdrawModal(false); setWithdrawStep('select'); }} style={st.btnPrimaryPremium}>Закрыть</button></div>)}
        </div>
    </div>
)}

            {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} userId={user?.telegram_id} />}
        </div>
    );

    // ---- MAIN ----
    return (
        <div style={{
            ...st.screen,
            backgroundAttachment: IS_TOUCH ? 'scroll' : 'fixed',
            animation: IS_TOUCH ? 'none' : 'bgMove 20s ease infinite'
        }}>
            <div style={{...st.bgNeonGrid, transform: IS_TOUCH ? 'none' : 'translateY(var(--parallax, 0px))'}}></div>
            <div style={{...st.bgOrb1, animation: IS_TOUCH ? 'none' : undefined, filter: IS_TOUCH ? 'blur(40px)' : 'blur(120px)', transform: IS_TOUCH ? 'none' : 'translateY(var(--parallax, 0px))'}}></div>
            <div style={{...st.bgOrb2, animation: IS_TOUCH ? 'none' : undefined, filter: IS_TOUCH ? 'blur(40px)' : 'blur(120px)', transform: IS_TOUCH ? 'none' : 'translateY(var(--parallax, 0px))'}}></div>
            <div style={{...st.bgOrb3, animation: IS_TOUCH ? 'none' : undefined, filter: IS_TOUCH ? 'blur(40px)' : 'blur(120px)', transform: IS_TOUCH ? 'none' : 'translateY(var(--parallax, 0px))'}}></div>
            <div style={{...st.bgOrb4, animation: IS_TOUCH ? 'none' : undefined, filter: IS_TOUCH ? 'blur(40px)' : 'blur(120px)', transform: IS_TOUCH ? 'none' : 'translateY(var(--parallax, 0px))'}}></div>

            <div style={st.headerMain}>
                <div style={st.logoMain} onClick={() => window.Telegram.WebApp.openLink('https://t.me/startask_official')}>⭐ StarTask</div>
                <div style={st.headerRight}>
                    <div style={st.balanceInline}>
                        <span style={st.balanceInlineItem}>⭐ {balance}</span>
                        <span style={{...st.balanceInlineItem, color: '#0088CC'}}>💎 {parseFloat(tonBalance||0).toFixed(2)}</span>
                    </div>
                    <div style={st.profileBtn} onClick={() => setShowProfile(true)}>
                        {user?.photo_url ? <img src={user.photo_url} alt="profile" style={st.profileAvatarImgNew} /> : <span style={st.profileAvatarFallback}>{user?.username?.charAt(0).toUpperCase() || '👤'}</span>}
                    </div>
                </div>
            </div>

            <div style={{...st.mainScroll, WebkitOverflowScrolling: 'touch', willChange: 'transform', transform: 'translateZ(0)'}} className="mainScroll">
                {mainTab === 'tasks' && (<>
                    <div style={st.segmentWrap}>
                        <button onClick={() => setActiveTab('active')} style={activeTab === 'active' ? st.segmentActive : st.segment}>Активные<span style={st.segmentBadge}>{activeTasks.length}</span></button>
                        <button onClick={() => setActiveTab('completed')} style={activeTab === 'completed' ? st.segmentActive : st.segment}>Выполненные<span style={st.segmentBadge}>{completedTasks.length}</span></button>
                    </div>

                    {activeTab === 'active' && (activeTasks.length === 0 ? <div style={st.emptyStatePremium}><div style={st.emptyStateIcon}>✨</div><h3 style={st.emptyStateTitle}>Всё выполнено</h3><p style={st.emptyStateText}>Новые задания появятся в ближайшее время</p></div> : activeTasks.map((task, i) => {
    const typeMeta = {
        admin:    { icon: '📢', label: 'Подписка', color: '#00C2FF', rgb: '0,194,255' },
        invite:   { icon: '🔗', label: 'Инвайт',   color: '#A855F7', rgb: '168,85,247' },
        repost:   { icon: '🔁', label: 'Репост',   color: '#FFC107', rgb: '255,193,7' },
        referral: { icon: '👥', label: 'Реферал',  color: '#4CAF50', rgb: '76,175,80' },
    };
    const tMeta = typeMeta[task.verification_type] || typeMeta.admin;
    const hasNftBg = !!nftBackgrounds[task.id];

    return (
    <motion.div
        key={task.id}
        className="questCardUltra"
        style={{
            ...st.questCardUltra,
            cursor: task.quest_type === 'extended' ? 'pointer' : 'default',
            position: 'relative',
            overflow: 'hidden',
            border: `1px solid rgba(${tMeta.rgb}, 0.32)`,
            boxShadow: IS_TOUCH
                ? `0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(${tMeta.rgb}, 0.06)`
                : `0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(${tMeta.rgb}, 0.06), 0 8px 28px rgba(${tMeta.rgb}, 0.18)`,
            background: hasNftBg
                ? 'transparent'
                : `linear-gradient(135deg, rgba(${tMeta.rgb},0.1), rgba(255,255,255,0.025))`,
            transition: IS_TOUCH ? 'transform 0.15s ease' : 'transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease',
            willChange: 'transform',
            transform: 'translateZ(0)',
            contain: 'layout style paint',
        }}
        onMouseMove={handleCardMove}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.04, duration: 0.35 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
            if (task.quest_type === 'extended') {
               setSelectedTask(task);
            }
        }}
    >
        {/* Анимированный шиммер для ВСЕХ карточек */}
        <motion.div
            className="cardShimmer"
            animate={{ x: ['-120%', '120%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay: i * 0.2 }}
            style={{
                position: 'absolute', top: 0, left: 0, width: '60%', height: '100%',
                background: `linear-gradient(90deg, transparent 0%, rgba(${tMeta.rgb}, 0.12) 50%, transparent 100%)`,
                zIndex: 1, pointerEvents: 'none', willChange: 'transform',
            }}
        />

        <div style={{
            position: 'absolute', left: 0, top: '12%', bottom: '12%', width: '3px',
            borderRadius: '0 4px 4px 0',
            background: `linear-gradient(180deg, ${tMeta.color}, rgba(${tMeta.rgb}, 0.25))`,
            boxShadow: `0 0 12px rgba(${tMeta.rgb}, 0.6)`,
            zIndex: 2
        }} />

        {nftBackgrounds[task.id]?.background && (
            <>
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: `url(${nftBackgrounds[task.id].background})`,
                    backgroundSize: '200% auto', backgroundPosition: 'center center',
                    filter: IS_TOUCH ? 'blur(4px) brightness(0.5)' : 'blur(12px) brightness(0.5) saturate(1.4)',
                    zIndex: 0,
                }} />
                <div style={{
                    position: 'absolute', inset: 0,
                    background: `linear-gradient(135deg, rgba(${tMeta.rgb},0.25) 0%, rgba(0,0,0,0.4) 100%)`,
                    zIndex: 0
                }} />
            </>
        )}

        <div style={{...st.cardGlow, animation: IS_TOUCH ? 'none' : 'shine 6s infinite'}}></div>

        <div style={{
            ...st.questAvatar, position: 'relative', zIndex: 1,
            background: channelAvatars[task.id] ? 'transparent' : getChannelColor(task.title),
            boxShadow: `0 0 0 2px rgba(${tMeta.rgb}, 0.35), 0 4px 16px rgba(${tMeta.rgb}, 0.25)`
        }}>
            {channelAvatars[task.id] ? <img src={channelAvatars[task.id]} alt="" style={st.questAvatarImg} /> : <span style={st.questAvatarLetter}>{getChannelInitial(task.title, task.target_url)}</span>}
            <div style={{
                position: 'absolute', bottom: '-2px', right: '-2px',
                width: '20px', height: '20px', borderRadius: '50%',
                background: `linear-gradient(135deg, rgba(${tMeta.rgb}, 0.95), rgba(${tMeta.rgb}, 0.65))`,
                border: '2px solid rgba(8,4,20,0.95)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px',
                boxShadow: `0 2px 8px rgba(${tMeta.rgb}, 0.5)`
            }}>{tMeta.icon}</div>
        </div>

        <div style={{...st.questBody, position: 'relative', zIndex: 1}}>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px'}}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: `rgba(${tMeta.rgb}, 0.12)`,
                    border: `1px solid rgba(${tMeta.rgb}, 0.3)`,
                    borderRadius: '8px', padding: '2px 7px',
                    fontSize: '10px', color: tMeta.color, fontWeight: '700', letterSpacing: '0.2px'
                }}>{tMeta.label}</div>

                {nftBackgrounds[task.id] && (
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: 'rgba(255,215,0,0.15)',
                        border: '1px solid rgba(255,215,0,0.3)',
                        borderRadius: '8px', padding: '2px 7px',
                        fontSize: '10px', color: '#FFD700', fontWeight: '700'
                    }}>🎁 NFT</div>
                )}
                {task.quest_type === 'extended' && (
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: 'rgba(255,51,102,0.12)',
                        border: '1px solid rgba(255,51,102,0.3)',
                        borderRadius: '8px', padding: '2px 7px',
                        fontSize: '10px', color: '#FF3366', fontWeight: '700'
                    }}>⭐ PRO</div>
                )}
            </div>

            <h4 style={st.questTitle}>{task.title}</h4>
            <p style={st.questDesc}>{task.description}</p>

            <div style={st.questFooter}>
                <div style={{
                    ...st.rewardTag,
                    color: tMeta.color,
                    background: `rgba(${tMeta.rgb}, 0.1)`,
                    borderColor: `rgba(${tMeta.rgb}, 0.28)`
                }}>+{task.reward} ⭐</div>
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                        e.stopPropagation();
                        createRipple(e);
                        completeTask(task.id, task.target_url, task.target_url.split('t.me/')[1], task.invite_link, task.verification_type, task.post_url, task.referral_url);
                    }}
                    style={{
                        ...st.actionBtnUltra,
                        position: 'relative', overflow: 'hidden',
                        background: `linear-gradient(135deg, rgba(${tMeta.rgb}, 0.95), rgba(${tMeta.rgb}, 0.65))`,
                        boxShadow: `0 4px 20px rgba(${tMeta.rgb}, 0.4)`
                    }}
                >
                    Выполнить
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                </motion.button>
            </div>
        </div>
    </motion.div>
    );
}))}

                    {activeTab === 'completed' && (completedTasks.length === 0 ? <div style={st.emptyStatePremium}><div style={st.emptyStateIcon}>📋</div><h3 style={st.emptyStateTitle}>Пока пусто</h3><p style={st.emptyStateText}>Выполняйте задания и получайте награды</p></div> : completedTasks.map(task => (
                        <div key={task.id} style={{...st.questCard, opacity: 0.5}}>
                            <div style={{...st.questAvatar, background: channelAvatars[task.id] ? 'transparent' : getChannelColor(task.title)}}>{channelAvatars[task.id] ? <img src={channelAvatars[task.id]} alt="" style={st.questAvatarImg} /> : <span style={st.questAvatarLetter}>{getChannelInitial(task.title, task.target_url)}</span>}</div>
                            <div style={st.questBody}><h4 style={st.questTitle}>{task.title}</h4><p style={st.questDesc}>{task.description}</p><div style={st.questFooter}><div style={{...st.rewardTag, background: 'rgba(168,85,247,0.1)', color: '#A855F7', borderColor: 'rgba(168,85,247,0.2)'}}>✓ +{task.reward} ⭐</div><span style={st.completedMark}>Выполнено</span></div></div>
                        </div>
                    )))}
                </>)}

                {mainTab === 'referral' && (<>
                    <div style={st.cardPremium}><div style={st.cardIconBox}>👥</div><h3 style={st.cardTitle}>Партнёрская программа</h3><p style={st.cardDescription}>Приглашайте друзей и получайте <strong style={{color: '#FF3366'}}>10%</strong> от их заработка навсегда</p><div style={st.referralCodeBox}><code style={st.referralCode}>{getReferralLink()}</code></div><button onClick={copyReferralLink} style={st.copyBtnPremium}><span>📋</span> Скопировать ссылку</button></div>
                    <div style={st.cardPremium}><h4 style={st.statsHeading}>Статистика</h4><div style={st.statRowPremium}><span style={st.statLabelPremium}>Приглашено друзей</span><span style={st.statValuePremium}>0</span></div><div style={st.statRowPremium}><span style={st.statLabelPremium}>Заработано комиссии</span><span style={st.statValuePremium}>0 ⭐</span></div></div>
                </>)}

                {mainTab === 'info' && (<>
                    {[{ icon: '⭐', title: 'StarTask', desc: 'Первая B2B-платформа для продвижения Telegram-каналов через вознаграждения в Stars и TON. С нами зарабатывают тысячи пользователей.' }, { icon: '🚀', title: 'Как начать', desc: 'Выберите задание → Выполните простое действие → Получите вознаграждение мгновенно на ваш баланс. Никаких задержек.' }, { icon: '💎', title: 'TON Foundation', desc: 'Проект поддержан TON Foundation. Мы строим Web3-экономику заданий с криптовалютными расчётами.' }].map(({ icon, title, desc }) => (<div key={title} style={st.cardPremium}><div style={st.cardIconBox}>{icon}</div><h3 style={st.cardTitle}>{title}</h3><p style={st.cardDescription}>{desc}</p></div>))}
                </>)}
            </div>

            {selectedTask && (
                <div style={IS_TOUCH ? {...st.modalOverlay, backdropFilter: 'none', background: 'rgba(0,0,0,0.85)'} : st.modalOverlay} onClick={() => setSelectedTask(null)}>
                    <div style={{...st.sheetPremium, maxHeight: '85vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch'}} onClick={e => e.stopPropagation()}>
                        <div style={{position: 'relative', marginBottom: '16px'}}>
                            {channelAvatars[selectedTask.id] ? (
                                <img src={channelAvatars[selectedTask.id]} alt="" style={{width: '100%', height: '160px', objectFit: 'cover', borderRadius: '16px'}} />
                            ) : (
                                <div style={{width: '100%', height: '120px', borderRadius: '16px', background: getChannelColor(selectedTask.title), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px'}}>
                                    {getChannelInitial(selectedTask.title, selectedTask.target_url)}
                                </div>
                            )}
                            <button onClick={() => setSelectedTask(null)} style={{...st.closePremium, position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.5)'}}>✕</button>
                            {selectedTask.quest_type === 'extended' && (
                                <div style={{position: 'absolute', top: '10px', left: '10px', background: 'linear-gradient(135deg,#00C2FF,#FF3366)', borderRadius: '20px', padding: '4px 10px', fontSize: '11px', fontWeight: '700', color: 'white'}}>⭐ PRO</div>
                            )}
                        </div>

                        <h2 style={{color: 'white', fontSize: '20px', fontWeight: '800', margin: '0 0 6px', letterSpacing: '-0.5px'}}>{selectedTask.title}</h2>
                        <p style={{color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '0 0 16px', lineHeight: 1.5}}>{selectedTask.description}</p>

                        {selectedTask.subscribers_count && (
                            <div style={{display: 'flex', gap: '10px', marginBottom: '16px'}}>
                                <div style={{flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '10px', textAlign: 'center'}}>
                                    <p style={{margin: 0, color: '#00C2FF', fontSize: '16px', fontWeight: '700'}}>{selectedTask.subscribers_count.toLocaleString()}</p>
                                    <p style={{margin: 0, color: 'rgba(255,255,255,0.35)', fontSize: '10px'}}>подписчиков</p>
                                </div>
                                <div style={{flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '10px', textAlign: 'center'}}>
                                    <p style={{margin: 0, color: '#FF3366', fontSize: '16px', fontWeight: '700'}}>+{selectedTask.reward} ⭐</p>
                                    <p style={{margin: 0, color: 'rgba(255,255,255,0.35)', fontSize: '10px'}}>награда</p>
                                </div>
                            </div>
                        )}

                        {selectedTask.extended_description && (
                            <div style={{background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '14px', marginBottom: '16px'}}>
                                <p style={{margin: '0 0 6px', color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px'}}>О канале</p>
                                <p style={{margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: 1.6}}>{selectedTask.extended_description}</p>
                            </div>
                        )}

                        {selectedTask.screenshots && selectedTask.screenshots.length > 0 && (
                            <div style={{marginBottom: '16px'}}>
                                <p style={{margin: '0 0 10px', color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px'}}>Скриншоты</p>
                                <div style={{display: 'flex', gap: '8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch'}}>
                                    {selectedTask.screenshots.map((url, i) => url && (
                                        <img key={i} src={url} alt={`screenshot ${i+1}`} style={{width: '140px', height: '200px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0}} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedTask.social_links && Object.values(selectedTask.social_links).some(v => v) && (
                            <div style={{marginBottom: '16px'}}>
                                <p style={{margin: '0 0 10px', color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px'}}>Соцсети</p>
                                <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                                    {Object.entries(selectedTask.social_links).map(([key, val]) => val && (
                                        <a key={key} href={val} target="_blank" rel="noreferrer" style={{display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '6px 12px', color: 'white', fontSize: '12px', textDecoration: 'none', fontWeight: '600'}}>
                                            {key === 'telegram' && '✈️'}{key === 'instagram' && '📸'}{key === 'youtube' && '▶️'}{key === 'tiktok' && '🎵'}{key.charAt(0).toUpperCase() + key.slice(1)}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button onClick={(e) => { createRipple(e); setSelectedTask(null); completeTask(selectedTask.id, selectedTask.target_url, selectedTask.target_url.split('t.me/')[1], selectedTask.invite_link, selectedTask.verification_type, selectedTask.post_url, selectedTask.referral_url); }}
                        style={{...st.actionBtnUltra, width: '100%', justifyContent: 'center', padding: '14px', fontSize: '15px'}}>
                            Выполнить и получить +{selectedTask.reward} ⭐
                        </button>
                    </div>
                </div>
            )}

            <div style={st.bottomNav}>
                {[{ id: 'tasks', icon: '📋', label: 'Задания' }, { id: 'referral', icon: '👥', label: 'Партнёры' }, { id: 'info', icon: 'ℹ️', label: 'О проекте' }].map(({ id, icon, label }) => (<button key={id} onClick={() => setMainTab(id)} style={mainTab === id ? st.navItemActive : st.navItem}><span style={st.navItemIcon}>{icon}</span><span style={st.navItemLabel}>{label}</span></button>))}
            </div>
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
    questCardUltra: { position: 'relative', backdropFilter: 'blur(30px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '16px', display: 'flex', gap: '14px', marginBottom: '12px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease' },
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
    button:not(:disabled):active { transform: scale(0.97); }
    * { -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
    input, textarea { -webkit-user-select: text; user-select: text; }
    *:focus { outline: none; }
    .questCardUltra:active { transform: scale(0.98); transition: transform 0.15s ease; }
    .ripple { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.3); transform: scale(0); animation: ripple 0.6s linear; pointer-events: none; }
    .ctInput:focus { border-color: rgba(255,255,255,0.22) !important; background: rgba(255,255,255,0.05) !important; box-shadow: 0 0 0 4px rgba(255,255,255,0.04); }
    .ctTypeCard { position: relative; overflow: hidden; }
    .ctTypeCard::before { content: ''; position: absolute; inset: -1px; border-radius: 16px; padding: 1px; background: linear-gradient(135deg, transparent, rgba(255,255,255,0.06), transparent); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; opacity: 0; transition: opacity .3s; }
    .ctTypeCard:hover::before { opacity: 1; }
    .ctCreateBtn { position: relative; overflow: hidden; }
    .ctOrb { animation: orbDrift 14s ease-in-out infinite; }
    .ctChip { animation: chipPop 0.35s cubic-bezier(.2,1.4,.4,1) both; }
    .mainScroll { -webkit-overflow-scrolling: touch !important; }
    .cardShimmer { will-change: transform; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.05); opacity: 1; } }
    @keyframes loadbar { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes cardEntrance { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes orbDrift { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(2%, 4%) scale(1.06); } }
    @keyframes chipPop { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
    @keyframes ripple { to { transform: scale(4); opacity: 0; } }
    @keyframes bgMove { 0% { background-position: 0% 0%, 100% 100%, center; } 50% { background-position: 10% 5%, 90% 95%, center; } 100% { background-position: 0% 0%, 100% 100%, center; } }
    .fadeInUp { animation: fadeInUp 0.5s ease both; }
    .cardEntrance { animation: cardEntrance 0.4s ease both; }
    ::-webkit-scrollbar { width: 0; }

    @media (hover: none) and (pointer: coarse), (max-width: 768px) {
        * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
        [class*="bgOrb"] { filter: blur(40px) !important; }
        .ctOrb, .ctCreateBtn::after, .cardGlow { animation: none !important; }
        .questCardUltra { transition: transform 0.15s ease !important; }
        body > div { background-attachment: scroll !important; }
        .cardGlow { display: none; }
    }
    @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
    }
`;
document.head.appendChild(styleSheet);

export default App;