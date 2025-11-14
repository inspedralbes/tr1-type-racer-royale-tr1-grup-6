<script setup>
// 1. IMPORTAR WATCH
import { ref, computed, onMounted, onUnmounted, defineEmits, watch } from 'vue';
import communicationManager from '../services/communicationManager.js';
import GameResult from '@/components/GameResult.vue';

const props = defineProps({
  initialWords: { type: Array, default: () => [] },
  intervalMs: { type: Number, default: 1500 },
  maxStack: { type: Number, default: 20 },
  players: { type: Array, default: () => [] },
  modo: { type: String, default: 'normal' },
  isSpectator: { type: Boolean, default: false },
  spectatorTargetId: { type: String, default: null },
});
const emit = defineEmits(['volverInicio', 'switchSpectatorTarget']);

// 2. CREAR LISTA LOCAL DE JUGADORES
const localPlayers = ref([]);

// 3. AÑADIR WATCH PARA SINCRONIZAR LISTAS (SIN ELIMINAR)
watch(
  () => props.players,
  (propPlayers) => {
    propPlayers.forEach((propP) => {
      let localP = localPlayers.value.find((p) => p.id === propP.id);
      if (localP) {
        // Actualiza datos existentes
        Object.assign(localP, propP);
      } else {
        // Añade nuevo jugador con 3 vidas por defecto (para este modo)
        localPlayers.value.push({
          ...JSON.parse(JSON.stringify(propP)),
          lives: 3,
        });
      }
    });
  },
  { deep: true, immediate: true },
);

// 4. CAMBIAR COMPUTEDS PARA USAR 'localPlayers'
const sortedPlayers = computed(() => {
  return [...localPlayers.value].sort((a, b) => {
    // Ordena primero por vidas, luego por palabras
    if ((b.lives || 0) !== (a.lives || 0)) {
      return (b.lives || 0) - (a.lives || 0);
    }
    return (b.completedWords || 0) - (a.completedWords || 0);
  });
});

const watchedPlayer = computed(() => {
  if (!props.isSpectator || !props.spectatorTargetId) return null;
  const target = localPlayers.value.find(
    (p) => p.id === props.spectatorTargetId,
  );
  return target || localPlayers.value[0] || null;
});

// ... (El resto de refs y computed no cambian) ...
const perdedor = ref(false);
const ganador = ref(false);
const perdidoMensaje = ref('');

const filesDelTeclat = ref([
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]);
const teclaPremuda = ref('');

const JuegoTerminado = ref(false);
const estatDelJoc = ref({
  paraules: [],
  estadistiques: [],
});
const textEntratLocal = ref('');

const palabrasCompletadas = ref(0);
const remainingWords = ref([]);
let revealTimer = null;
let tempsIniciParaula = 0;

const wordStack = computed(() => {
  if (props.isSpectator) {
    return watchedPlayer.value?.wordStack || [];
  } else {
    return estatDelJoc.value.paraules;
  }
});

const paraulaActiva = computed(() => {
  if (wordStack.value.length === 0) {
    return null;
  }
  return wordStack.value[wordStack.value.length - 1];
});

const displayedText = computed(() => {
  if (props.isSpectator) {
    return watchedPlayer.value?.currentWordProgress || '';
  } else {
    return textEntratLocal.value;
  }
});

const totalErrors = ref(0);
let gameStartTime = 0;

const vidasRestantes = ref(3);
const tiempoRestante = ref(5);
let countdownTimer = null;
const playersLives = ref({}); // Mantenemos este para la UI de corazones si es necesario

function handleVolverInicio() {
  emit('volverInicio');
}

function convertirEnEspectador() {
  console.log('Sol·licitant convertir-se en espectador...');
  communicationManager.requestSpectate();
}

// ... (handleKeyDown, iniciarCronometreParaula no cambian) ...
function handleKeyDown(event) {
  if (JuegoTerminado.value || props.isSpectator || perdedor.value) return;

  const key = event.key;

  if (key.length === 1 && /^[a-zA-Z]$/.test(key)) {
    if (!gameStartTime) {
      gameStartTime = Date.now();
    }
    teclaPremuda.value = key.toUpperCase();
    setTimeout(() => {
      teclaPremuda.value = '';
    }, 100);
  }

  if (JuegoTerminado.value) return;

  if (key === 'Backspace') {
    event.preventDefault();
    textEntratLocal.value = textEntratLocal.value.slice(0, -1);
    validarProgres();
  } else if (key.length === 1 && /^[a-zA-Z]$/.test(key)) {
    event.preventDefault();
    textEntratLocal.value += key;
    validarProgres();
  }
}

function iniciarCronometreParaula() {
  tempsIniciParaula = Date.now();
}

// 5. MODIFICAR 'validarProgres' para usar 'localPlayers'
function validarProgres() {
  if (JuegoTerminado.value || perdedor.value) return;

  const typed = textEntratLocal.value;
  const paraula =
    estatDelJoc.value.paraules[estatDelJoc.value.paraules.length - 1];

  communicationManager.updatePlayerProgress({
    currentWordProgress: typed,
    wordStack: estatDelJoc.value.paraules,
  });

  if (!paraula) {
    textEntratLocal.value = '';
    reiniciarCronometro();
    return;
  }

  if (
    !Array.isArray(paraula.letterErrors) ||
    paraula.letterErrors.length !== paraula.text.length
  ) {
    paraula.letterErrors = Array.from(
      { length: paraula.text.length },
      () => false,
    );
  }

  if (typed === paraula.text) {
    palabrasCompletadas.value++;

    // Actualiza la lista local
    const self = localPlayers.value.find(
      (p) => p.id === communicationManager.getId(),
    );
    if (self) self.completedWords = (self.completedWords || 0) + 1;

    const wordErrors = paraula.letterErrors.filter((e) => e).length;
    paraula.errors = wordErrors;
    paraula.estat = 'completada';

    const playTime = gameStartTime ? Date.now() - gameStartTime : 0;
    communicationManager.updatePlayerProgress({
      completedWords: palabrasCompletadas.value,
      lives: vidasRestantes.value,
      totalErrors: totalErrors.value,
      playTime: playTime,
    });

    estatDelJoc.value.paraules.pop();
    textEntratLocal.value = '';
    reiniciarCronometro();
    return;
  }

  for (let i = 0; i < typed.length; i++) {
    if (i >= paraula.text.length) break;

    const isError = typed[i] !== paraula.text[i];
    if (isError && !paraula.letterErrors[i]) {
      paraula.letterErrors[i] = true;

      totalErrors.value++;

      if (props.modo === 'muerteSubita' && !perdedor.value && !ganador.value) {
        manejarError();
      }
    } else if (!isError) {
      paraula.letterErrors[i] = false;
    }
  }
}

function getClasseLletra(indexLletra) {
  if (!paraulaActiva.value) return '';

  const typed = displayedText.value;
  const target = paraulaActiva.value.text;

  if (indexLletra >= typed.length) {
    if (paraulaActiva.value.letterErrors[indexLletra]) {
      return 'incorrecte';
    }
    return '';
  }

  return typed[indexLletra] === target[indexLletra] ? 'correcte' : 'incorrecte';
}

// 6. CREAR FUNCIÓN PARA GUARDAR STATS AL SER ELIMINADO
function saveEliminationStats() {
  if (perdedor.value) return; // Ya se ha procesado

  const playTime = gameStartTime ? Date.now() - gameStartTime : 0;
  const finalStats = {
    playTime,
    totalErrors: totalErrors.value,
    completedWords: palabrasCompletadas.value,
    lives: 0,
    eliminated: true,
  };

  // Enviar al servidor
  communicationManager.updatePlayerProgress(finalStats);

  // Guardar en localPlayers
  const self = localPlayers.value.find(
    (p) => p.id === communicationManager.getId(),
  );
  if (self) {
    Object.assign(self, finalStats);
  }
}

// 7. MODIFICAR 'reiniciarCronometro' y 'manejarError' para llamar a saveEliminationStats
function reiniciarCronometro() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
  tiempoRestante.value = 5;

  if (JuegoTerminado.value || perdedor.value) return;

  countdownTimer = setInterval(() => {
    if (JuegoTerminado.value || perdedor.value) {
      clearInterval(countdownTimer);
      return;
    }

    tiempoRestante.value -= 0.1;
    if (tiempoRestante.value <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
      vidasRestantes.value--;
      updateLocalPlayerLives(vidasRestantes.value);
      manejarTiempoAgotado();
      if (vidasRestantes.value <= 0) {
        perdedor.value = true;
        perdidoMensaje.value =
          'Has perdut totes les teves vides. ¡Estàs eliminat!';
        saveEliminationStats(); // <-- CAMBIO CLAVE
        communicationManager.reportMuerteSubitaElimination();
      }
    }
  }, 100);
}

function manejarTiempoAgotado() {
  if (JuegoTerminado.value || perdedor.value) return;

  if (props.modo === 'muerteSubita') {
    reiniciarCronometro();
  }
}

function manejarError() {
  if (JuegoTerminado.value || perdedor.value) return;

  if (props.modo === 'muerteSubita') {
    totalErrors.value++;
    vidasRestantes.value--;
    updateLocalPlayerLives(vidasRestantes.value);

    const input = document.querySelector('.text-input');
    if (input) {
      input.style.borderColor = '#ff4d4d';
      setTimeout(() => (input.style.borderColor = ''), 300);
    }

    if (vidasRestantes.value <= 0) {
      perdedor.value = true;
      perdidoMensaje.value =
        'Has perdut totes les teves vides. ¡Estàs eliminat!';
      saveEliminationStats(); // <-- CAMBIO CLAVE
      communicationManager.reportMuerteSubitaElimination();
    }
  }
}

// 8. MODIFICAR 'updateLocalPlayerLives' para actualizar 'localPlayers'
function updateLocalPlayerLives(newLives) {
  const playerId = communicationManager.id;
  if (playerId) {
    // Actualiza 'playersLives' (UI de corazones antigua)
    playersLives.value[playerId] = {
      ...(playersLives.value[playerId] || { name: 'Tú' }),
      lives: newLives,
    };
    playersLives.value = { ...playersLives.value };

    // **CAMBIO CLAVE**: Actualiza 'localPlayers'
    const localP = localPlayers.value.find((p) => p.id === playerId);
    if (localP) {
      localP.lives = newLives;
    }

    communicationManager.updatePlayerProgress({
      lives: newLives,
    });
  }
}

// 9. MODIFICAR 'onMounted' para actualizar 'localPlayers'
onMounted(() => {
  // El watch 'immediate: true' ya ha poblado 'localPlayers'.
  // Ahora sincronizamos 'playersLives' (si aún se usa) y 'vidasRestantes' local.

  // Sincroniza 'playersLives' con 'localPlayers'
  localPlayers.value.forEach((player) => {
    playersLives.value[player.id] = {
      name: player.name,
      lives: player.lives ?? 3, // Asume 3 si no está definido
    };
  });

  const self = localPlayers.value.find(
    (p) => p.id === communicationManager.getId(),
  );
  if (self) {
    vidasRestantes.value = self.lives ?? 3;
  }

  communicationManager.onConnect((id) => {
    if (props.modo === 'muerteSubita') {
      playersLives.value[id] = {
        name: 'Tú',
        lives: vidasRestantes.value,
      };
      playersLives.value = { ...playersLives.value };

      const localP = localPlayers.value.find((p) => p.id === id);
      if (localP) {
        localP.lives = vidasRestantes.value;
      }
    }
  });

  communicationManager.onPlayerWon((data) => {
    if (JuegoTerminado.value) return;

    if (props.isSpectator) {
      ganador.value = false;
      perdidoMensaje.value =
        data?.message || `Partida acabada. Guanyador: ${data.winnerName}`;
    } else {
      if (data.winnerId === communicationManager.getId()) {
        ganador.value = true;
        perdedor.value = false;
      } else {
        perdedor.value = true;
        ganador.value = false;
      }
      perdidoMensaje.value = data?.message || '';
    }

    finalizarJuego();
  });

  // **CAMBIO CLAVE**: Actualiza ambas listas
  communicationManager.onPlayerProgressUpdate((data) => {
    if (data.playerId && data.lives !== undefined) {
      playersLives.value[data.playerId] = {
        ...(playersLives.value[data.playerId] || {}),
        lives: data.lives,
      };

      const localP = localPlayers.value.find((p) => p.id === data.playerId);
      if (localP) {
        localP.lives = data.lives;
      }
    }
  });

  // **CAMBIO CLAVE**: Actualiza ambas listas
  communicationManager.onPlayerEliminated((data) => {
    if (data.playerId) {
      if (playersLives.value[data.playerId]) {
        playersLives.value[data.playerId].lives = 0;
      }

      const localP = localPlayers.value.find((p) => p.id === data.playerId);
      if (localP) {
        localP.lives = 0;
        localP.eliminated = true; // Marca como eliminado en la lista local
      }
    }
  });

  communicationManager.onGameOver((data) => {
    if (JuegoTerminado.value) return;

    if (props.isSpectator) {
      ganador.value = false;
      perdidoMensaje.value =
        data.message || `La partida ha acabat. Guanyador: ${data.winnerName}.`;
    } else {
      if (data.winnerId === communicationManager.getId()) {
        ganador.value = true;
        perdedor.value = false;
        perdidoMensaje.value =
          data.message || 'Has guanyat! Tots els altres han estat eliminats.';
      } else {
        ganador.value = false;
        perdedor.value = true;
        perdidoMensaje.value =
          data.message || `Has perdut. ${data.winnerName} ha guanyat.`;
      }
    }

    finalizarJuego();
  });

  if (Array.isArray(props.initialWords) && props.initialWords.length > 0) {
    remainingWords.value = props.initialWords.slice();
  }

  revealTimer = setInterval(() => {
    if (JuegoTerminado.value || perdedor.value) return;
    try {
      if (
        remainingWords.value.length > 0 &&
        estatDelJoc.value.paraules.length < props.maxStack
      ) {
        const nextText = remainingWords.value.shift();
        const newParaula = {
          id: Date.now() + Math.random(),
          text: nextText,
          estat: 'pendent',
          errors: 0,
          letterErrors: Array.from({ length: nextText.length }, () => false),
        };
        estatDelJoc.value.paraules.unshift(newParaula);

        if (estatDelJoc.value.paraules.length === 1) {
          reiniciarCronometro();
        }
      }
    } catch (e) {
      console.error('Error en revealTimer:', e);
    }
  }, props.intervalMs || 3000);
});

onUnmounted(() => {
  if (revealTimer) clearInterval(revealTimer);
  if (countdownTimer) clearInterval(countdownTimer);
});

function calculateProgress(completedWords) {
  return (completedWords / estatDelJoc.value.paraules.length) * 100;
}

// 10. MODIFICAR 'finalizarJuego' para usar 'localPlayers'
function finalizarJuego() {
  if (JuegoTerminado.value) return;
  JuegoTerminado.value = true;

  const playTime = gameStartTime ? Date.now() - gameStartTime : 0;
  const finalStats = {
    playTime: playTime,
    totalErrors: totalErrors.value,
    completedWords: palabrasCompletadas.value,
    lives: vidasRestantes.value,
  };

  if (!props.isSpectator) {
    communicationManager.updatePlayerProgress(finalStats);

    // **CAMBIO CLAVE**: Actualiza 'localPlayers'
    const localPlayer = localPlayers.value.find(
      (p) => p.id === communicationManager.getId(),
    );
    // No sobrescribas si ya estabas eliminado (tus stats finales ya se guardaron)
    if (localPlayer && !localPlayer.eliminated) {
      localPlayer.playTime = finalStats.playTime;
      localPlayer.totalErrors = finalStats.totalErrors;
      localPlayer.completedWords = finalStats.completedWords;
      localPlayer.lives = finalStats.lives;
    }
  }

  if (revealTimer) clearInterval(revealTimer);
  if (countdownTimer) clearInterval(countdownTimer);
}
</script>

<template>
  <div>
    <div class="game-header">
      <h2 class="modo-titulo">
        Mode de joc:
        <span :class="['modo-text', props.modo]">
          {{ props.modo === 'muerteSubita' ? 'Mort Súbita' : 'Normal' }}
        </span>
      </h2>
      <!-- Botón para volver al lobby cuando estamos en modo espectador -->
      <button
        v-if="props.isSpectator"
        class="spectator-back-btn"
        @click="handleVolverInicio"
        title="Volver al lobby"
      >
        Volver al lobby
      </button>
    </div>
    <div class="game-layout">
      <div class="game-main">
        <TransitionGroup name="fall" tag="div" class="paraules-container">
          <div
            v-for="(paraula, index) in wordStack"
            :key="paraula.id"
            class="paraula"
            :class="{
              'paraula-activa': index === wordStack.length - 1,
              'completada-correcta':
                paraula.estat === 'completada' && paraula.errors === 0,
              'completada-incorrecta':
                paraula.estat === 'completada' && paraula.errors > 0,
            }"
          >
            <template v-if="index === wordStack.length - 1">
              <span
                v-for="(lletra, i) in paraula.text.split('')"
                :key="i"
                class="lletra"
                :class="getClasseLletra(i)"
              >
                {{ lletra }}
              </span>
            </template>
            <template v-else>
              {{ paraula.text }}
            </template>
          </div>
        </TransitionGroup>
        <div class="input-barra-wrapper">
          <input
            type="text"
            class="text-input"
            :value="displayedText"
            @input="textEntratLocal = $event.target.value"
            @keydown="handleKeyDown"
            :placeholder="
              props.isSpectator ? 'MODO ESPECTADOR' : 'Comença a escriure...'
            "
            :disabled="JuegoTerminado || perdedor"
            :readonly="props.isSpectator"
            autocomplete="off"
          />
          <div class="barra-tiempo">
            <div
              class="progreso-tiempo"
              :style="{ width: (tiempoRestante / 5) * 100 + '%' }"
            ></div>
          </div>
        </div>

        <div class="teclat" v-if="!props.isSpectator">
          <div
            v-for="(fila, fIndex) in filesDelTeclat"
            :key="fIndex"
            class="fila"
          >
            <div
              v-for="lletra in fila"
              :key="lletra"
              class="tecla"
              :class="{ 'tecla-premuda': teclaPremuda === lletra }"
            >
              {{ lletra }}
            </div>
          </div>
        </div>
      </div>

      <aside class="players-sidebar">
        <h3 v-if="props.isSpectator" class="spectator-banner">
          [MODO ESPECTADOR]
        </h3>

        <div
          v-if="props.isSpectator && !JuegoTerminado"
          class="spectator-controls"
        >
          <h4>Mirant a: {{ watchedPlayer?.name || '...' }}</h4>
          <div class="spectator-targets">
            <button
              v-for="p in localPlayers"
              :key="p.id"
              @click="emit('switchSpectatorTarget', p.id)"
              :class="{ 'target-active': p.id === props.spectatorTargetId }"
              :title="`Canviar a ${p.name}`"
            >
              {{ p.name.substring(0, 3) }}
            </button>
          </div>

          <button @click="handleVolverInicio" class="spectator-exit-btn">
            Sortir al Lobby
          </button>
        </div>

        <h3>Jugadors</h3>
        <ul>
          <li
            v-for="p in sortedPlayers"
            :key="p.id"
            class="player-item"
            :class="{
              eliminado: p.eliminated || p.lives === 0,
            }"
          >
            <div class="player-info">
              <span class="player-name-text">{{ p.name }}</span>
              <span
                v-if="p.eliminated || p.lives === 0"
                style="color: #dc3545; font-weight: bold; margin-left: 10px"
              >
                Eliminat
              </span>
            </div>
            <div class="player-stats">
              <span class="completed-count">
                Paraules: {{ p.completedWords || 0 }}
              </span>
              <div class="vidas-jugador">
                <span v-for="n in p.lives || 0" :key="n" class="corazon"
                  >❤️</span
                >
              </div>
            </div>
          </li>
        </ul>
      </aside>

      <div
        v-if="perdedor && !JuegoTerminado && !isSpectator"
        class="overlay-eliminado"
      >
        <div class="overlay-content">
          <h2>Has sido eliminado</h2>
          <p>{{ perdidoMensaje || '¡Mala suerte!' }}</p>
          <div class="opciones-perdedor">
            <button @click="convertirEnEspectador" class="btn btn-espectador">
              Ver Partida
            </button>
            <button @click="handleVolverInicio" class="btn btn-salir">
              Salir al Lobby
            </button>
          </div>
        </div>
      </div>

      <GameResult
        v-if="JuegoTerminado"
        :winner="ganador"
        :loser="perdedor"
        :message="perdidoMensaje"
        :players="localPlayers"
        @volverInicio="handleVolverInicio"
        :modo="props.modo"
        :isSpectator="props.isSpectator"
      />
    </div>
  </div>
</template>

<style scoped>
.spectator-banner {
  color: var(--color-warning, #ffc107);
  background: var(--color-background);
  border: 1px solid var(--color-warning, #ffc107);
  padding: 5px;
  text-align: center;
  border-radius: 4px;
  margin-bottom: 10px !important;
}
.spectator-controls {
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--color-border);
}
.spectator-controls h4 {
  margin: 0 0 8px;
  color: var(--color-text);
  font-size: 0.9rem;
  text-align: center;
}
.spectator-targets {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  justify-content: center;
}
.spectator-targets button {
  padding: 4px 8px;
  font-size: 0.8rem;
  background-color: var(--color-background-soft);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  cursor: pointer;
}
.spectator-targets button:hover {
  background-color: var(--color-border);
}
.spectator-targets button.target-active {
  background-color: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
  font-weight: bold;
}
.correcte {
  color: #28a745;
  font-weight: bold;
}
.incorrecte {
  color: #dc3545;
  background-color: #f8d7da;
  border-radius: 3px;
}
.teclat {
  position: sticky;
  bottom: 0;
  margin-top: 12px;
  text-align: center;
  display: block;
  max-width: 100%;
  padding: 10px 0 16px;
  z-index: 30;
}
.fila {
  margin-bottom: 5px;
  display: flex;
  justify-content: center;
}
.tecla {
  display: inline-flex;
  padding: 10px;
  border-radius: 8px;
  border: 2px solid var(--color-border, #ccc);
  min-width: 40px;
  height: 45px;
  margin: 2px;
  align-items: center;
  justify-content: center;
  text-align: center;
  cursor: pointer;
  transition: all 0.1s ease-out;
  font-weight: bold;
  background: var(--color-background, #fff);
  color: var(--color-text, #333);
  font-size: 1.5rem;
}
.tecla:hover {
  background-color: var(--color-background-soft, #f0f0f0);
}
.tecla-premuda {
  background-color: #007bff;
  border-color: #007bff;
  color: white;
  transform: scale(0.95);
}

/*estilo imput con tiempo*/
.input-barra-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 20px;
  flex-direction: column;
  align-items: center;
}

.text-input {
  width: 100%;
  max-width: 400px;
  padding: 12px 16px;
  font-size: 1.2rem;
  border: 4px solid;
  border-radius: 12px;
  outline: none;
  transition: border-color 0.2s linear;
  border-image: linear-gradient(
    to right,
    #00ff7f calc(var(--progress) * 1%),
    #333 calc(var(--progress) * 1%)
  );
  border-image-slice: 1;
}

.text-input:focus {
  box-shadow: 0 0 10px rgba(0, 255, 127, 0.4);
}
/* Barra de tiempo debajo del input */
.barra-tiempo {
  width: 100%;
  max-width: 400px;
  height: 8px;
  background-color: #333;
  border-radius: 6px;
  margin-top: 6px;
  overflow: hidden;
}

.progreso-tiempo {
  height: 100%;
  background: linear-gradient(
    180deg,
    rgba(200, 40, 40, 0.98),
    rgba(220, 70, 70, 0.98)
  );
  transition: width 0.1s linear;
}

.game-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  flex-wrap: nowrap;
  justify-content: center;
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}
.game-main {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 720px;
  display: flex;
  flex-direction: column;
  min-height: calc(60vh);
  max-height: calc(80vh);
}
.players-sidebar {
  width: 300px;
  background: var(--color-background-soft, #f8f8f8);
  border-radius: 12px;
  padding: 12px 16px;
  align-self: flex-start;
  box-shadow: 0 6px 18px var(--shadow-color, rgba(0, 0, 0, 0.08));
  border: 1px solid var(--color-border, #e0e0e0);
}
.players-sidebar h3 {
  margin: 0 0 12px 0;
  text-align: center;
  color: var(--color-heading, #333);
  font-weight: 700;
  font-size: 1.5rem;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
  padding-bottom: 8px;
  text-align: center;
}
.player-name-inline.eliminado {
  opacity: 0.5;
  text-decoration: line-through;
}
.player-name-inline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 8px;
  background: transparent;
  border-radius: 6px;
  color: var(--color-text, #333);
  font-weight: 600;
}

.player-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  margin-bottom: 10px;
  background: var(--color-background, #fff);
  border-radius: 6px;
  border: 1px solid var(--color-border, #e0e0e0);
  transition: opacity 0.3s ease;
}

.player-item.eliminado {
  opacity: 0.5;
}

.player-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.player-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}

.vidas-jugador {
  display: flex;
  gap: 4px;
}

.corazon {
  font-size: 1.2rem;
}
.player-name-text {
  font-weight: 700;
  color: var(--color-heading, #333);
}
.completed-count {
  font-size: 12px;
  color: var(--color-text, #555);
  opacity: 0.9;
  background: var(--color-background, #fff);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
}
.paraules-container {
  border: 1px solid var(--color-border, #ccc);
  background: var(--color-background, #fff);
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  border-radius: 8px;
  box-shadow: inset 0 2px 8px var(--shadow-color, rgba(0, 0, 0, 0.05));
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
.paraula {
  padding: 8px 12px;
  margin-bottom: 6px;
  border-radius: 6px;
  background: var(--color-background-soft, #f4f4f4);
  border: 1px solid var(--color-border, #e0e0e0);
  transition: all 0.3s ease;
  font-size: 1.2rem;
  color: var(--color-text-muted, #aaa);
  opacity: 0.6;
  text-align: center;
  font-weight: 500;
}
.paraula-activa {
  background: var(--color-background, #fff);
  color: var(--color-heading, #333);
  opacity: 1;
  font-size: 1.6rem;
  font-weight: bold;
  border-color: #007bff;
  box-shadow: 0 4px 12px var(--shadow-color, rgba(0, 123, 255, 0.15));
  transform: scale(1.02);
}
.input-display-area {
  margin-top: 20px;
  padding: 12px 16px;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 8px;
  font-size: 1.5rem;
  font-family: 'Courier New', Courier, monospace;
  color: var(--color-text, #333);
  min-height: 55px;
  background: var(--color-background, #fff);
  text-align: left;
  box-shadow: 0 2px 4px var(--shadow-color, rgba(0, 0, 0, 0.05));
  word-wrap: break-word;
}
.cursor {
  animation: blink 1s step-end infinite;
  font-weight: bold;
  margin-left: 1px;
  color: #007bff;
  font-size: 1.6rem;
}
.text-input {
  width: 100%;
  box-sizing: border-box;
  font-size: 2rem;
  padding: 12px 16px;
  border-radius: 10px;
  border: 2px solid #007bff;
  margin: 14px 0 6px;
  background: var(--color-background, #fff);
  color: var(--color-text, #333);
  font-family: 'Courier New', Courier, monospace;
  text-align: center;
  box-shadow: 0 2px 12px rgba(0, 123, 255, 0.08);
  outline: none;
  transition: border-color 0.15s;
}
.game-header {
  width: 100%;
  text-align: center;
  margin-bottom: 12px;
  position: relative; /* permite posicionar el botón de espectador */
}
.modo-titulo {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--color-heading, #333);
}
.modo-text {
  padding: 4px 10px;
  border-radius: 8px;
  font-weight: bold;
}
.modo-text.normal {
  background-color: #007bff;
  color: white;
}
.modo-text.muerteSubita {
  background-color: #dc3545;
  color: white;
}

/* Estilo del botón "Volver al lobby" cuando eres espectador */
.spectator-back-btn {
  position: absolute;
  top: 8px;
  right: 70px;
  background-color: var(--color-primary, #007bff);
  color: white;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 1rem;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
}
.spectator-back-btn:hover {
  transform: translateY(-1px);
}
.text-input:focus {
  border-color: #28a745;
}
.text-input:disabled {
  background: #444851;
  color: #b3b3b3;
  opacity: 0.7;
}
.fall-enter-active {
  transition: all 0.5s ease-in;
}
.fall-enter-from {
  opacity: 0;
  transform: translateY(-40px);
}
.fall-enter-to {
  opacity: 1;
  transform: translateY(0);
}
.fall-leave-active {
  transition: all 0.3s ease-out;
  position: absolute;
}
.fall-leave-from {
  opacity: 1;
  transform: scale(1);
}
.fall-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
.fall-move {
  transition: transform 0.4s ease;
}
@keyframes blink {
  from,
  to {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

/* --- NOU ESTILS AFEGITS (Overlay) --- */
.overlay-eliminado {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
  color: white;
}
.overlay-content {
  text-align: center;
  background: var(--color-background-soft);
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}
.overlay-content h2 {
  color: var(--color-error);
  font-size: 2.5rem;
  margin-bottom: 10px;
}
.overlay-content p {
  font-size: 1.2rem;
  margin-bottom: 30px;
}
.opciones-perdedor {
  display: flex;
  gap: 20px;
}
.opciones-perdedor .btn {
  padding: 12px 24px;
  font-size: 1.1rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-family: var(--font-main);
}
.btn-espectador {
  background-color: var(--color-primary);
  color: white;
}
.btn-salir {
  background-color: var(--color-background-mute);
  color: var(--color-text);
}

/* --- **** ESTILS NOUS PER AL BOTÓ D'ESPECTADOR **** --- */
.spectator-exit-btn {
  width: 100%;
  margin-top: 15px;
  padding: 10px 12px;
  font-size: 1.1rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-family: var(--font-main);
  background-color: var(--color-background-mute);
  color: var(--color-text);
  transition: background-color 0.2s;
}
.spectator-exit-btn:hover {
  background-color: var(--color-border);
}
</style>
