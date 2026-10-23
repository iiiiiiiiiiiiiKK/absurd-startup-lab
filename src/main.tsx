import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { auditPosterLayout } from './lib/poster';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('root element missing');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

/**
 * 测试钩子：仅在带 ?audit=1 打开时暴露，
 * 供 scripts/poster-check.mjs 做「海报文字越界」精确自审。
 */
if (new URLSearchParams(window.location.search).has('audit')) {
  (window as unknown as Record<string, unknown>).__aslPosterAudit = auditPosterLayout;
}
