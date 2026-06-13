export type SoundType = 'capture' | 'castle' | 'game-end' | 'game-start' | 'illegal' | 'move-check' | 'move-opponent' | 'move-self' | 'notify' | 'premove' | 'promote' | 'tenseconds';

const audioMap: Record<SoundType, string> = {
  capture: '/sounds/capture.mp3',
  castle: '/sounds/castle.mp3',
  'game-end': '/sounds/game-end.mp3',
  'game-start': '/sounds/game-start.mp3',
  illegal: '/sounds/illegal.mp3',
  'move-check': '/sounds/move-check.mp3',
  'move-opponent': '/sounds/move-opponent.mp3',
  'move-self': '/sounds/move-self.mp3',
  notify: '/sounds/notify.mp3',
  premove: '/sounds/premove.mp3',
  promote: '/sounds/promote.mp3',
  tenseconds: '/sounds/tenseconds.mp3'
};

const audioCache: Partial<Record<SoundType, HTMLAudioElement>> = {};
export let audioUnlocked = false;

if (typeof window !== 'undefined') {
  Object.entries(audioMap).forEach(([key, path]) => {
    const audio = new Audio(path);
    audio.preload = 'auto';
    audioCache[key as SoundType] = audio;
  });
}

export const playSound = (type: SoundType) => {
  const audio = audioCache[type];
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch((e) => console.warn(`Audio blocked (${type}):`, e.message));
  }
};

export const unlockAudioEngine = () => {
  if (audioUnlocked) return;
  Object.values(audioCache).forEach(audio => {
    if (audio) {
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
      }).catch(() => {});
    }
  });
  audioUnlocked = true;
};