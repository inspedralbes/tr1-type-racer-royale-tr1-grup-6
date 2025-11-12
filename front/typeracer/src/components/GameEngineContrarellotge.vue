<script setup>
import { ref, computed, onMounted, onUnmounted, defineEmits } from 'vue';
import communicationManager from '../services/communicationManager.js';
import GameResult from '@/components/GameResult.vue';
import { useSounds } from '@/composables/useSounds';

const startTime = ref(null);
const endTime = ref(null);

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

const { playSound } = useSounds();

const isShaking = ref(false);
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

const watchedPlayer = computed(() => {
  if (!props.isSpectator || !props.spectatorTargetId) return null;
  const target = props.players.find((p) => p.id === props.spectatorTargetId);
  // Si no el troba (potser s'ha desconnectat), mira el primer jugador
  return target || props.players[0] || null;
});

// AQUESTA ÉS LA PILA DE PARAULES QUE ES MOSTRA
const wordStack = computed(() => {
  if (props.isSpectator) {
    // Si som espectadors, mirem la pila del jugador observat
    return watchedPlayer.value?.wordStack || [];
  } else {
    // Si som jugadors, mirem la nostra pila local
    return estatDelJoc.value.paraules;
  }
});

const sortedPlayers = computed(() => {
  return [...props.players].sort(
    (a, b) => (b.completedWords || 0) - (a.completedWords || 0),
  );
});

// LA PARAULA ACTIVA DEPÈN DE LA PILA QUE ES MOSTRA
const paraulaActiva = computed(() => {
  if (wordStack.value.length === 0) {
    return null;
  }
  return wordStack.value[wordStack.value.length - 1];
});

// EL TEXT D'INPUT DEPÈN DE QUI SOM
const displayedText = computed(() => {
  if (props.isSpectator) {
    return watchedPlayer.value?.currentWordProgress || '';
  } else {
    return textEntratLocal.value;
  }
});

const totalErrors = ref(0);

function handleVolverInicio() {
  emit('volverInicio');
}

function handleKeyDown(event) {
  if (JuegoTerminado.value || props.isSpectator) return;

  const key = event.key;
  if (key.length === 1 && /^[a-zA-Z]$/.test(key)) {
    teclaPremuda.value = key.toUpperCase();
    setTimeout(() => {
      teclaPremuda.value = '';
    }, 100);
  }
  if (key === 'Backspace') {
    event.preventDefault();
    textEntratLocal.value = textEntratLocal.value.slice(0, -1);
  } else if (key.length === 1 && /^[a-zA-Z]$/.test(key)) {
    event.preventDefault();
    textEntratLocal.value += key;
  } else {
    event.preventDefault();
    return;
  }
  validarProgres();
}
function iniciarCronometreParaula() {
  tempsIniciParaula = Date.now();
}

// 2. MODIFICAR 'validarProgres'
function validarProgres() {
  if (JuegoTerminado.value || props.isSpectator) return;

  if (textEntratLocal.value.length === 1 && tempsIniciParaula === 0) {
    iniciarCronometreParaula();
  }
  if (!startTime.value && textEntratLocal.value.length === 1) {
    startTime.value = Date.now();
  }

  const typed = textEntratLocal.value;
  // El jugador valida contra la seva pròpia pila local
  const paraula =
    estatDelJoc.value.paraules[estatDelJoc.value.paraules.length - 1];

  // Envia el progrés I la pila
  communicationManager.updatePlayerProgress({
    currentWordProgress: typed,
    wordStack: estatDelJoc.value.paraules,
  });

  if (!paraula) {
    textEntratLocal.value = '';
    return;
  }
  if (typed.length > 0) {
    const lastCharIndex = typed.length - 1;
    if (lastCharIndex < paraula.text.length) {
      if (typed[lastCharIndex] !== paraula.text[lastCharIndex]) {
        playSound('keyError');
        isShaking.value = true;
        setTimeout(() => {
          isShaking.value = false;
        }, 400);
      } else {
        playSound('keyPress');
      }
    } else {
      playSound('keyError');
      isShaking.value = true;
      setTimeout(() => {
        isShaking.value = false;
      }, 400);
    }
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
  let errorCount = 0;
  for (let i = 0; i < typed.length; i++) {
    if (i >= paraula.text.length) break;
    const isError = typed[i] !== paraula.text[i];
    if (isError) {
      if (!paraula.letterErrors[i]) {
        totalErrors.value++;
        if (props.modo === 'muerteSubita') {
          communicationManager.reportMuerteSubitaElimination();
        }
      }
      paraula.letterErrors[i] = true;
      errorCount++;
    } else {
      paraula.letterErrors[i] = false;
    }
  }
  paraula.errors = errorCount;

  if (typed === paraula.text) {
    palabrasCompletadas.value++;

    estatDelJoc.value.paraules.pop();
    textEntratLocal.value = '';
    tempsIniciParaula = 0;

    const progressPayload = {
      completedWords: palabrasCompletadas.value,
      totalErrors: totalErrors.value,
      playTime: (endTime.value || Date.now()) - (startTime.value || Date.now()),
      currentWordProgress: '',
      wordStack: estatDelJoc.value.paraules,
    };

    if (palabrasCompletadas.value >= 20 && !JuegoTerminado.value) {
      JuegoTerminado.value = true;
      onGameEnd();
      communicationManager.updatePlayerProgress(progressPayload);
    } else {
      communicationManager.updatePlayerProgress(progressPayload);
    }

    const nextParaula =
      estatDelJoc.value.paraules[estatDelJoc.value.paraules.length - 1];
    if (nextParaula) {
      if (
        !Array.isArray(nextParaula.letterErrors) ||
        nextParaula.letterErrors.length !== nextParaula.text.length
      ) {
        nextParaula.letterErrors = Array.from(
          { length: nextParaula.text.length },
          () => false,
        );
        nextParaula.errors = 0;
      }
    }
  }
}
function onGameEnd() {
  if (!endTime.value) {
    endTime.value = Date.now();
  }
}

// 3. MODIFICAR 'getClasseLletra'
function getClasseLletra(indexLletra) {
  if (!paraulaActiva.value) return '';
  const typed = displayedText.value;
  const target = paraulaActiva.value.text;

  const classes = [];

  if (indexLletra === typed.length) {
    classes.push('caret');
  }

  if (indexLletra >= typed.length) {
    if (paraulaActiva.value.letterErrors[indexLletra]) {
      classes.push('incorrecte');
    }
  } else {
    classes.push(
      typed[indexLletra] === target[indexLletra] ? 'correcte' : 'incorrecte',
    );
  }

  return classes.join(' ');
}

// 4. MODIFICAR 'onMounted'
onMounted(() => {
  if (!props.isSpectator) {
    window.addEventListener('keydown', handleKeyDown);
  }

  if (
    !props.isSpectator &&
    estatDelJoc.value.paraules.length === 0 &&
    Array.isArray(props.initialWords) &&
    props.initialWords.length > 0
  ) {
    remainingWords.value = props.initialWords.slice();
  }

  const ownPlayer = props.players.find(
    (p) => p.id === communicationManager.getId(),
  );
  if (ownPlayer) {
    ownPlayer.completedWords = palabrasCompletadas.value;
  }

  if (
    !JuegoTerminado.value &&
    estatDelJoc.value.paraules.length >= props.maxStack
  ) {
    if (!props.isSpectator) {
      communicationManager.reportPlayerLost();
    }
  }

  communicationManager.onPlayerEliminated((data) => {
    if (JuegoTerminado.value) return;

    // Només s'aplica al jugador eliminat
    if (data.playerId === communicationManager.getId() && !props.isSpectator) {
      perdedor.value = true;
      ganador.value = false;
      JuegoTerminado.value = true;
      onGameEnd();
      communicationManager.updatePlayerProgress({
        completedWords: palabrasCompletadas.value,
        totalErrors: totalErrors.value,
        playTime:
          (endTime.value || Date.now()) - (startTime.value || Date.now()),
      });
      perdidoMensaje.value =
        data?.message || 'Has perdut: massa paraules acumulades.';
      playSound('gameLose');
      if (revealTimer) {
        clearInterval(revealTimer);
        revealTimer = null;
      }
    }
  });

  communicationManager.onPlayerWon((data) => {
    if (JuegoTerminado.value) return;

    // Només el jugador real pot guanyar
    if (data.winnerId === communicationManager.getId() && !props.isSpectator) {
      ganador.value = true;
      perdedor.value = false;
      perdidoMensaje.value =
        data?.message || 'Has guanyat! Tots els altres han estat eliminats.';
      playSound('gameWin');
    }

    JuegoTerminado.value = true;
    if (revealTimer) {
      clearInterval(revealTimer);
      revealTimer = null;
    }
  });

  communicationManager.onGameOver((data) => {
    if (JuegoTerminado.value) return;
    onGameEnd();

    if (props.isSpectator) {
      // LÒGICA D'ESPECTADOR
      ganador.value = false;
      perdedor.value = false;
      perdidoMensaje.value = data.message || `${data.winnerName} ha guanyat.`;
    } else {
      // LÒGICA DE JUGADOR
      if (!props.isSpectator) {
        communicationManager.updatePlayerProgress({
          completedWords: palabrasCompletadas.value,
          totalErrors: totalErrors.value,
          playTime:
            (endTime.value || Date.now()) - (startTime.value || Date.now()),
        });
      }
      if (data.winnerId === communicationManager.getId()) {
        ganador.value = true;
        perdedor.value = false;
        playSound('gameWin');
        perdidoMensaje.value =
          data.message || 'Has guanyat! Tots els altres han estat eliminats.';
      } else {
        ganador.value = false;
        perdedor.value = true;
        playSound('gameLose');
        perdidoMensaje.value =
          data.message || `Has perdut. ${data.winnerName} ha guanyat.`;
      }
    }

    JuegoTerminado.value = true;
    if (revealTimer) {
      clearInterval(revealTimer);
      revealTimer = null;
    }
  });

  if (!JuegoTerminado.value && !props.isSpectator) {
    revealTimer = setInterval(() => {
      if (JuegoTerminado.value) return;
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
          playSound('newWord');

          // CORRECCIÓ 6: El jugador ha d'enviar la pila quan cau una paraula
          communicationManager.updatePlayerProgress({
            wordStack: estatDelJoc.value.paraules,
          });
        }

        if (
          estatDelJoc.value.paraules.length >= props.maxStack &&
          !perdedor.value &&
          !JuegoTerminado.value
        ) {
          communicationManager.reportPlayerLost();
        }
      } catch (e) {
        console.error('Error en revealTimer:', e);
      }
    }, props.intervalMs || 3000);
  }
});

onUnmounted(() => {
  if (!props.isSpectator) {
    window.removeEventListener('keydown', handleKeyDown);
  }
  if (revealTimer) {
    clearInterval(revealTimer);
    revealTimer = null;
  }
});
</script>

<template>
  <div>
    <div class="game-header">
      <h2 class="modo-titulo">
        Mode de joc:
        <span :class="['modo-text', props.modo]">
          {{ props.modo === 'muerteSubita' ? 'Muerte Súbita' : 'Normal' }}
        </span>
      </h2>
    </div>
    <div class="game-layout">
      <div class="game-main">
        <TransitionGroup
          name="fall"
          tag="div"
          class="paraules-container"
          :class="{
            'danger-zone': wordStack.length > props.maxStack * 0.75,
          }"
        >
          <div
            v-for="(paraula, index) in wordStack"
            :key="paraula.id"
            class="paraula"
            :class="{
              'paraula-activa': index === wordStack.length - 1,
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

        <input
          type="text"
          class="text-input"
          :class="{ 'shake-animation': isShaking }"
          :value="displayedText"
          @input="textEntratLocal = $event.target.value"
          :placeholder="
            props.isSpectator ? 'MODO ESPECTADOR' : '> Comença a escriure...'
          "
          :disabled="JuegoTerminado"
          :readonly="props.isSpectator"
        />

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
        <div v-if="props.isSpectator" class="spectator-controls">
          <h4>Mirant a: {{ watchedPlayer?.name || '...' }}</h4>
          <div class="spectator-targets">
            <button
              v-for="p in props.players"
              :key="p.id"
              @click="emit('switchSpectatorTarget', p.id)"
              :class="{ 'target-active': p.id === props.spectatorTargetId }"
              :title="`Canviar a ${p.name}`"
            >
              {{ p.name.substring(0, 3) }}
            </button>
          </div>
        </div>

        <h3>[REFUGIATS]</h3>
        <ul>
          <li v-for="p in sortedPlayers" :key="p.id" class="player-name-inline">
            <span
              class="color-dot"
              :style="{
                backgroundColor: p.color,
                filter: `brightness(1.5) drop-shadow(0 0 5px ${p.color})`,
              }"
              aria-hidden="true"
            ></span>
            <span class="player-name-text">{{ p.name }}</span>
            <span class="completed-count">
              [Paraules: {{ p.completedWords || 0 }}]
            </span>
          </li>
        </ul>
      </aside>
    </div>

    <GameResult
      v-if="JuegoTerminado"
      :winner="ganador"
      :loser="perdedor"
      :message="perdidoMensaje"
      :players="props.players"
      @volverInicio="handleVolverInicio"
      :modo="props.modo"
      :isSpectator="props.isSpectator"
    />
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
  font-size: 1.5rem;
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
  font-size: 1.2rem;
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
  color: var(--color-success);
  font-weight: bold;
}
.incorrecte {
  color: var(--color-background);
  background-color: var(--color-heading);
  border-radius: 3px;
}
.teclat {
  position: sticky;
  bottom: 0;
  margin-top: 12px;
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
  border: 2px solid var(--color-text-muted);
  min-width: 40px;
  height: 45px;
  margin: 2px;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.1s ease-out;
  font-weight: bold;
  background: transparent;
  color: var(--color-text);
  font-size: 1.5rem;
}
.tecla:hover {
  background-color: var(--color-border);
}
.tecla-premuda {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-background);
  transform: scale(0.95);
  text-shadow: none;
}
.game-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  flex-wrap: nowrap;
  justify-content: center;
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
  background: var(--color-background-soft);
  border-radius: 12px;
  padding: 12px 16px;
  border: 2px solid var(--color-border);
  box-shadow: 0 0 18px var(--shadow-color), inset 0 0 10px var(--shadow-color);
}
.players-sidebar h3 {
  margin: 0 0 12px 0;
  color: var(--color-heading);
  font-weight: 700;
  font-size: 1.5rem;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 8px;
  text-align: center;
}
.player-name-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 8px;
  border-radius: 6px;
  color: var(--color-text);
  font-weight: 700;
  font-size: 1.3rem;
}
.player-name-text {
  font-weight: 700;
  color: var(--color-heading);
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.completed-count {
  font-size: 1.1rem;
  color: var(--color-text-muted);
  background: var(--color-background);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
  flex-shrink: 0;
}
.color-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  margin-right: 8px;
  flex-shrink: 0;
  border: 1px solid var(--color-text-muted);
}
.paraules-container {
  border: 2px solid var(--color-text-muted);
  background: rgba(32, 255, 32, 0.05);
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  border-radius: 12px;
  box-shadow: inset 0 0 10px var(--shadow-color);
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
.paraula {
  padding: 8px 12px;
  margin-bottom: 6px;
  border-radius: 8px;
  background: var(--color-border);
  border: 1px solid var(--color-text-muted);
  transition: all 0.3s ease;
  font-size: 1.8rem;
  color: var(--color-text-muted);
  opacity: 0.8;
  text-align: center;
  font-weight: 500;
}
.paraula-activa {
  background: var(--color-background-soft);
  color: var(--color-heading);
  opacity: 1;
  font-size: 2.2rem;
  font-weight: bold;
  border: 2px solid var(--color-primary);
  box-shadow: 0 0 12px var(--shadow-color);
  transform: scale(1.02);
}
.text-input {
  width: 100%;
  box-sizing: border-box;
  font-size: 3rem;
  padding: 12px 16px;
  border-radius: 8px;
  border: 3px solid var(--color-primary);
  margin: 14px 0 6px;
  background: var(--color-background);
  color: var(--color-heading);
  font-family: var(--font-main);
  text-align: center;
  box-shadow: 0 0 20px var(--shadow-color);
  outline: none;
  transition: border-color 0.15s;
}
.text-input:focus {
  border-color: var(--color-success);
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
.shake-animation {
  animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}
@keyframes shake {
  10%,
  90% {
    transform: translate3d(-1px, 0, 0);
  }
  20%,
  80% {
    transform: translate3d(2px, 0, 0);
  }
  30%,
  50%,
  70% {
    transform: translate3d(-4px, 0, 0);
  }
  40%,
  60% {
    transform: translate3d(4px, 0, 0);
  }
}
.modo-text {
  display: inline-block;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
  background-color: var(--color-border);
  transition: all 0.3s ease;
}
.modo-text.muerteSubita {
  background-color: var(--color-error-bg);
  color: var(--color-error);
  border: 1px solid var(--color-error);
  text-shadow: 0 0 5px var(--color-error);
  animation: flicker-danger 2s infinite;
}
@keyframes flicker-danger {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 5px var(--color-error);
  }
  50% {
    opacity: 0.8;
    box-shadow: 0 0 10px var(--color-error);
  }
}
.lletra {
  position: relative;
  transition: all 0.1s ease;
}
.lletra.caret {
  border-left: 3px solid var(--color-primary);
  animation: blink-caret 1s step-end infinite;
}
@keyframes blink-caret {
  0%,
  100% {
    border-left-color: var(--color-primary);
  }
  50% {
    border-left-color: transparent;
  }
}
.paraules-container.danger-zone {
  border-color: var(--color-error);
  animation: pulse-danger-border 1s infinite alternate;
}
@keyframes pulse-danger-border {
  from {
    box-shadow: inset 0 0 10px var(--shadow-color);
  }
  to {
    border-color: var(--color-error);
    box-shadow: inset 0 0 20px var(--color-error), 0 0 10px var(--color-error);
  }
}
@keyframes pulse-focus {
  0% {
    box-shadow: 0 0 20px var(--shadow-color);
    border-color: var(--color-success);
  }
  50% {
    box-shadow: 0 0 30px var(--color-success), 0 0 20px var(--shadow-color);
    border-color: var(--color-success);
  }
  100% {
    box-shadow: 0 0 20px var(--shadow-color);
    border-color: var(--color-success);
  }
}
.text-input:focus {
  animation: pulse-focus 1.5s infinite;
}
</style>
