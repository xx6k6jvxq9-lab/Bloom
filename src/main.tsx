import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { WechatBindPage } from './components/wechat/WechatBindPage.tsx';
import { isWechatBindPath } from './features/wechat-bridge/pathRouting.ts';
import './index.css';

const RootComponent = typeof window !== 'undefined' && isWechatBindPath(window.location.pathname)
  ? WechatBindPage
  : App;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootComponent />
  </StrictMode>,
);
