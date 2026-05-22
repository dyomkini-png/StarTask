import React from 'react';
import ReactDOM from 'react-dom/client';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import TelegramAnalytics from '@telegram-apps/analytics';
import App from './App';

// Инициализируем аналитику ДО рендера
TelegramAnalytics.init({
    token: import.meta.env.VITE_ANALYTICS_TOKEN || '',
    appName: 'StarTask',
});

const manifestUrl = 'https://startask-ten.vercel.app/tonconnect-manifest.json';

ReactDOM.createRoot(document.getElementById('root')).render(
    <TonConnectUIProvider manifestUrl={manifestUrl}>
        <App />
    </TonConnectUIProvider>
);