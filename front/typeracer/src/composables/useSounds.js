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
    Object.values(sounds).forEach(sound => {
      sound.volume = volume;
    });
  };

  return {
    playSound,
    setVolume
  };
}