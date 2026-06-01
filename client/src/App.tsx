import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Game from './pages/Game';
import './App.css';

export type ThemeMode = 'dark' | 'light';

function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const savedTheme = window.localStorage.getItem('theme');
    return savedTheme === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'));

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Home theme={theme} onToggleTheme={toggleTheme} />}
        />
        <Route
          path="/game/:gameId"
          element={<Game theme={theme} onToggleTheme={toggleTheme} />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
