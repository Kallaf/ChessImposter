import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import GuestGate from './components/GuestGate';
import Game from './pages/Game';
import Lobby from './pages/Lobby';
import { hasIdentity } from './lib/guest';
import './App.css';
import { NotificationProvider } from './context/NotificationContext';

export type ThemeMode = 'dark' | 'light';

function App() {
  const [identityReady, setIdentityReady] = useState(hasIdentity);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const savedTheme = window.localStorage.getItem('theme');
    return savedTheme === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'));

  if (!identityReady) {
    return <GuestGate  theme={theme} onToggleTheme={toggleTheme} onReady={() => setIdentityReady(true)} />;
  }

  return (
    <NotificationProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={<Lobby theme={theme} onToggleTheme={toggleTheme} />}
          />
          <Route
            path="/game/:gameId"
            element={<Game theme={theme} onToggleTheme={toggleTheme} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </NotificationProvider>
  );
}

export default App;
