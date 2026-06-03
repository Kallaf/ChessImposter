import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLobbySocket } from '../hooks/useLobbySocket';
import { getDisplayName, getGuestId } from '../lib/guest';
import type { ThemeMode } from '../App';
import { Clock, Play, Crown, Skull, Moon, Sun } from 'lucide-react';
import { motion } from 'motion/react';

const TIME_OPTIONS = [
  { id: 'bullet' as const, label: 'Bullet', time: '1-2 min', timeCodes: ['1+0', '2+1'] },
  { id: 'blitz' as const, label: 'Blitz', time: '3-5 min', timeCodes: ['3+0', '3+2', '5+0'] },
  { id: 'rapid' as const, label: 'Rapid', time: '10-15 min', timeCodes: ['10+0', '15+10'] },
];

type Props = {
  theme: ThemeMode;
  onToggleTheme: () => void;
};

function ModeCard({ 
  mode, 
  selected, 
  onClick 
}: { 
  mode: 'standard' | 'true_king', 
  selected: boolean,
  onClick: () => void 
}) {
  const isStandard = mode === 'standard';

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative px-6 py-4 rounded-lg border-2 transition-all duration-200 ${
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:border-primary/30'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          {isStandard ? <Crown className="w-5 h-5" /> : <Skull className="w-5 h-5" />}
        </div>
        <div className="text-left">
          <div className="font-medium text-foreground">
            {isStandard ? 'Standard' : 'True King'}
          </div>
          <div className="text-sm text-muted-foreground">
            {isStandard ? 'Classic rules' : 'Mystery mode'}
          </div>
        </div>
      </div>

      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
        >
          <svg
            className="w-3 h-3 text-primary-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </motion.div>
      )}
    </motion.button>
  );
}

export default function Lobby({ theme, onToggleTheme }: Props) {
  const navigate = useNavigate();
  const [selectedTimeCategory, setSelectedTimeCategory] = useState<'bullet' | 'blitz' | 'rapid'>('rapid');
  const [gameMode, setGameMode] = useState<'standard' | 'true_king'>('standard');

  const lobby = useLobbySocket(true);

  useEffect(() => {
    lobby.onGameStarted((gameId) => {
      navigate(`/game/${gameId}`);
    });
  }, [lobby, navigate]);

  const myId = getGuestId();
  const myChallenge = lobby.challenges.find((c) => c.creatorGuestId === myId);

  // Get time control code from selected category
  const getTimeControl = () => {
    const category = TIME_OPTIONS.find(t => t.id === selectedTimeCategory);
    return category?.timeCodes[0] || '5+0';
  };

  function handleCreate() {
    const timeControl = getTimeControl();
    // Always use 'random' for side preference
    lobby.createChallenge(timeControl, 'random', gameMode);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header - Navbar */}
      <header className="border-b border-border bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-primary" />
            <span className="text-xl font-semibold text-foreground">ChessMaster</span>
          </div>
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-accent transition-colors text-foreground"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Create Challenge & Open Challenges */}
          <div className="lg:col-span-2 space-y-6">
            {/* Create Challenge Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card border border-border rounded-xl p-8 shadow-sm"
            >
              <h2 className="text-xl font-medium mb-6 text-foreground">Create Challenge</h2>

              <div className="space-y-6">
                {/* Game Mode Selection */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-3 font-medium">
                    Game mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ModeCard
                      mode="standard"
                      selected={gameMode === 'standard'}
                      onClick={() => setGameMode('standard')}
                    />
                    <ModeCard
                      mode="true_king"
                      selected={gameMode === 'true_king'}
                      onClick={() => setGameMode('true_king')}
                    />
                  </div>
                </div>

                {/* Time Control Selection */}
                <div>
                  <label className="block text-sm text-muted-foreground mb-3 font-medium">
                    Time control
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {TIME_OPTIONS.map((option) => (
                      <motion.button
                        key={option.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedTimeCategory(option.id)}
                        className={`px-4 py-3 rounded-lg border-2 transition-all duration-200 ${
                          selectedTimeCategory === option.id
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div className="font-medium text-sm">{option.label}</div>
                        <div
                          className={`text-xs ${
                            selectedTimeCategory === option.id
                              ? 'text-primary-foreground/80'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {option.time}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Find Challenge Button */}
                <div className="pt-4">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleCreate}
                    disabled={Boolean(myChallenge)}
                    className={`w-full py-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                      myChallenge
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-primary text-primary-foreground hover:opacity-90'
                    }`}
                  >
                    <Play className="w-5 h-5" />
                    {myChallenge ? 'Challenge posted' : 'Find Challenge'}
                  </motion.button>
                </div>
              </div>
            </motion.div>

            {/* Open Challenges Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card border border-border rounded-xl p-8 shadow-sm"
            >
              <h2 className="text-xl font-medium mb-6 text-foreground">Open Challenges</h2>
              {lobby.challenges.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No open challenges yet. Be the first to create one!
                </p>
              ) : (
                <ul className="space-y-2">
                  {lobby.challenges.map((c) => (
                    <li
                      key={c.challengeId}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border hover:border-primary/30 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{c.creatorName}</div>
                        <div className="text-sm text-muted-foreground">
                          {c.timeControl} · {c.gameMode}
                        </div>
                      </div>
                      {c.creatorGuestId !== myId ? (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          type="button"
                          onClick={() => lobby.joinChallenge(c.challengeId)}
                          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
                        >
                          Join
                        </motion.button>
                      ) : (
                        <span className="px-4 py-2 text-sm text-muted-foreground">Yours</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </div>

          {/* Right Column - Player Info */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-card border border-border rounded-xl p-6 shadow-sm"
            >
              <h2 className="text-lg font-medium text-foreground mb-4">Players Online</h2>
              <div className="text-center py-8">
                <div className="text-4xl font-bold text-primary mb-2">
                  {lobby.onlineCount}
                </div>
                <div className="text-sm text-muted-foreground">players in lobby</div>
              </div>
              
              <div className="border-t border-border pt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  You are playing as: <span className="font-medium text-foreground">{getDisplayName()}</span>
                </p>
                {myChallenge && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => lobby.cancelChallenge(myChallenge.challengeId)}
                    className="w-full px-4 py-2 rounded-lg border border-border bg-card hover:bg-destructive/10 hover:border-destructive text-foreground transition-colors"
                  >
                    Cancel Challenge
                  </motion.button>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
