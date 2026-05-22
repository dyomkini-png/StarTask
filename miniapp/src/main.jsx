import React from 'react';
import ReactDOM from 'react-dom/client';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import TelegramAnalytics from '@telegram-apps/analytics';
import App from './App';

// Инициализируем аналитику ДО рендера
TelegramAnalytics.init({
    token: 'eyJhcHBfbmFtZSI6InN0YXJ0YXNrIiwiYXBwX3VybCI6Imh0dHBzOi8vdC5tZS9TdGFyVGFza0JvdCIsImFwcF9kb21haW4iOiJodHRwczovL3N0YXJ0YXNrLXRlbi52ZXJjZWwuYXBwLyJ9!zYnDJaKj6pJo2pIA/kFcwp8tMsTcGDDPGMW1589jSKI=',
    appName: 'StarTask',
});

const manifestUrl = 'https://startask-ten.vercel.app/tonconnect-manifest.json';

ReactDOM.createRoot(document.getElementById('root')).render(
    <TonConnectUIProvider manifestUrl={manifestUrl}>
        <App />
    </TonConnectUIProvider>
);