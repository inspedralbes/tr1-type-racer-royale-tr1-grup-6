import { ref } from 'vue';

// Define los nombres de tus archivos de audio
// que PONDRÁS en 'public/audio/'
const soundMap = {
  keyPress: '/audio/key-press.mp3',      // Sonido de tecla correcta
  keyError: '/audio/key-error.wav',      // Sonido de tecla incorrecta
  keyBackspace: '/audio/backspace.mp3',  // Sonido de borrar
  wordComplete: '/audio/word-complete.wav',// Al completar una palabra
  newWord: '/audio/newWord.wav',        // Cuando aparece una palabra nueva
  gameLose: '/audio/game-lose.wav',      // Al perder
  gameWin: '/audio/gameWin.wav'         // Al ganar
};

// --- No necesitas editar nada debajo de esta línea ---

const sounds = {};

// Carga previa de todos los sonidos
for (const key in soundMap) {
  sounds[key] = new Audio(soundMap[key]);
}

// Función para clonar y reproducir (permite que los sonidos se superpongan)
function playSoundClone(audioNode) {
  if (!audioNode) return;
  const clone = audioNode.cloneNode(true);
  clone.volume = audioNode.volume;
  clone.play();
}

// El "composable" que usarás en tus componentes
export function useSounds() {

  const playSound = (name) => {
    if (sounds[name]) {
      playSoundClone(sounds[name]);
    } else {
      console.warn(`Sonido "${name}" no encontrado.`);
    }
  };

  // Función para establecer el volumen (de 0.0 a 1.0)
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