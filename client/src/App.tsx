import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import GuestGate from './components/GuestGate';
import Game from './pages/Game';
import Lobby from './pages/Lobby';
import { hasIdentity } from './lib/guest';
import './App.css';

export type ThemeMode = 'dark' | 'light';

function App() {
  const [identityReady, setIdentityReady] = useState(hasIdentity);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const savedTheme = window.localStorage.getItem('theme');
    return savedTheme === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'));

  if (!identityReady) {
    return <GuestGate onReady={() => setIdentityReady(true)} />;
  }

  return (
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
  );
}

export default App;
