import React from 'react';
import ReactDOM from 'react-dom/client';
import { initBridge } from './lib/bridge';
import App from './App';
import './styles/globals.css';

initBridge();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
