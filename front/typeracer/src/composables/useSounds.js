import { ref } from 'vue';

const soundMap = {
  keyPress: '/audio/key-press.mp3',
  keyError: '/audio/key-error.wav',
  keyBackspace: '/audio/backspace.mp3',
  wordComplete: '/audio/word-complete.wav',
  newWord: '/audio/newWord.wav',
  gameLose: '/audio/game-lose.wav',
  gameWin: '/audio/gameWin.wav'
};

const sounds = {};

for (const key in soundMap) {
  sounds[key] = new Audio(soundMap[key]);
}

const menuMusic = new Audio('/audio/type-racer-theme.mp3');
menuMusic.loop = true;
menuMusic.volume = 0.3;

const gameMusic = new Audio('/audio/type-racer-theme2.mp3');
gameMusic.loop = true;
gameMusic.volume = 0.3;


function playSoundClone(audioNode) {
  if (!audioNode) return;
  const clone = audioNode.cloneNode(true);
  clone.volume = audioNode.volume;
  clone.play();
}

export function useSounds() {

  const playSound = (name) => {
    if (sounds[name]) {
      playSoundClone(sounds[name]);
    } else {
      console.warn(`Sonido "${name}" no encontrado.`);
    }
  };

  const setVolume = (volume) => {
    // Esto ajusta el volumen de los SFX
    Object.values(sounds).forEach(sound => {
      sound.volume = volume;
    });

    menuMusic.volume = 0.3;
    gameMusic.volume = 0.3;
    // --- FIN DE LA CORRECCIÓN ---
  };

  // --- Funciones de Música ---
  const playMenuMusic = () => {
    gameMusic.pause();
    gameMusic.currentTime = 0;
    menuMusic.play().catch(e => console.warn("Menu music play failed", e));
  };

  const playGameMusic = () => {
    menuMusic.pause();
    menuMusic.currentTime = 0;
    gameMusic.play().catch(e => console.warn("Game music play failed", e));
  };

  const stopAllMusic = () => {
    menuMusic.pause();
    menuMusic.currentTime = 0;
    gameMusic.pause();
    gameMusic.currentTime = 0;
  };

  return {
    playSound,
    setVolume,
    playMenuMusic,
    playGameMusic,
    stopAllMusic
  };
}