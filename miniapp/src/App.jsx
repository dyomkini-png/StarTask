import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://your-backend-url.railway.app';

function App() {
    const [user, setUser] = useState(null);
    const [balance, setBalance] = useState(0);
    
    useEffect(() => {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        
        if (tg.initDataUnsafe?.user) {
            setUser(tg.initDataUnsafe.user);
        }
    }, []);
    
    return (
        <div style={{
            minHeight: '100vh',
            background: '#1a1a2e',
            color: 'white',
            padding: '16px'
        }}>
            <h1>⭐ StarTask</h1>
            {user && <p>Привет, {user.first_name}!</p>}
            <p>Баланс: {balance} Stars</p>
            <p style={{ color: '#ffd700' }}>Mini App работает! 🎉</p>
        </div>
    );
}

export default App;