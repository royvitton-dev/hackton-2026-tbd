import React from 'react';
import ReactDOM from 'react-dom/client';
async function startApp() {
  const legacy = window.location.pathname.startsWith('/health');
  const module = legacy ? await import('./App') : await import('./game/GameApp');
  if (legacy) { await import('./styles.css'); await import('./anatomy.css'); }
  const App = module.default;
  ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
}
void startApp();
