import React from 'react';
import ReactDOM from 'react-dom/client';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import App from './App';

const manifestUrl = 'https://startask-ten.vercel.app/tonconnect-manifest.json';

ReactDOM.createRoot(document.getElementById('root')).render(
    <TonConnectUIProvider manifestUrl={manifestUrl}>
        <App />
    </TonConnectUIProvider>
);