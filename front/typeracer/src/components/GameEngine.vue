<script setup>
import { ref, computed, onMounted, onUnmounted, watch, defineEmits } from "vue";
import communicationManager from "../services/communicationManager.js";
import GameResult from "@/components/GameResult.vue";
import { useSounds } from '@/composables/useSounds';

const startTime = ref(null);
const endTime = ref(null);
const emit = defineEmits(["volverInicio"]);
// Props
const props = defineProps({
  initialWords: { type: Array, default: () => [] },
  intervalMs: { type: Number, default: 1500 },
  maxStack: { type: Number, default: 20 },
  players: { type: Array, default: () => [] },
  modo: { type: String, default: "normal" },
});

const { playSound } = useSounds();

const isShaking = ref(false);

const perdedor = ref(false);
const ganador = ref(false);
const perdidoMensaje = ref("");
const filesDelTeclat = ref([
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
]);
const teclaPremuda = ref("");
const JuegoTerminado = ref(false);
const estatDelJoc = ref({
  paraules: [],
  textEntrat: "",
  estadistiques: [],
});
const palabrasCompletadas = ref(0);
const remainingWords = ref([]);
let revealTimer = null;
let tempsIniciParaula = 0;
const paraulaActiva = computed(() => {
  if (estatDelJoc.value.paraules.length === 0) {
    return null;
  }
  return estatDelJoc.value.paraules[estatDelJoc.value.paraules.length - 1];
});
const totalErrors = ref(0);
function handleVolverInicio() {
  emit("volverInicio");
}

function handleKeyDown(event) {
  const key = event.key;
  if (key.length === 1 && /^[a-zA-Z]$/.test(key)) {
    teclaPremuda.value = key.toUpperCase();
    setTimeout(() => {
      teclaPremuda.value = "";
    }, 100);
  }
  if (JuegoTerminado.value) return;
  if (key === "Backspace") {
    event.preventDefault();
    estatDelJoc.value.textEntrat = estatDelJoc.value.textEntrat.slice(0, -1);
    playSound('keyBackspace');
  } else if (key.length === 1 && /^[a-zA-Z]$/.test(key)) {
    event.preventDefault();
    estatDelJoc.value.textEntrat += key;
  } else {
    // Prevenir otras teclas (como Enter, Tab, etc.) si no son alfabéticas
    event.preventDefault();
    return;
  }
  // Se llama a validarProgres aquí, manualmente, tras actualizar el modelo
  validarProgres();
}
function iniciarCronometreParaula() {
  tempsIniciParaula = Date.now();
}
function validarProgres() {
  if (JuegoTerminado.value) return; // Bloqueja tot si la partida ha finalitzat

  if (estatDelJoc.value.textEntrat.length === 1 && tempsIniciParaula === 0) {
    iniciarCronometreParaula();
  }
  if (!startTime.value && estatDelJoc.value.textEntrat.length === 1) {
    startTime.value = Date.now();
  }
  const typed = estatDelJoc.value.textEntrat;
  const paraula = paraulaActiva.value;
  if (!paraula) {
    estatDelJoc.value.textEntrat = "";
    return;
  }
  if (typed.length > 0) {
    const lastCharIndex = typed.length - 1;
    if (lastCharIndex < paraula.text.length) {
      if (typed[lastCharIndex] !== paraula.text[lastCharIndex]) {
        playSound('keyError');
        isShaking.value = true;
        setTimeout(() => { isShaking.value = false; }, 400);
      } else {
        playSound('keyPress');
      }
    } else {
      playSound('keyError');
      isShaking.value = true;
      setTimeout(() => { isShaking.value = false; }, 400);
    }
  }
  if (!Array.isArray(paraula.letterErrors) || paraula.letterErrors.length !== paraula.text.length) {
    paraula.letterErrors = Array.from({ length: paraula.text.length }, () => false);
  }
  let errorCount = 0;
  for (let i = 0; i < typed.length; i++) {
    if (i >= paraula.text.length) break;
    const isError = typed[i] !== paraula.text[i];
    if (isError) {
      if (!paraula.letterErrors[i]) {
        totalErrors.value++;
        if (props.modo === "muerteSubita") {
          // En muerte súbita, cualquier error elimina al jugador
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
  communicationManager.updatePlayerProgress({
    completedWords: palabrasCompletadas.value,
    totalErrors: totalErrors.value,
    playTime: (endTime.value || Date.now()) - (startTime.value || Date.now()),
  });
  if (typed === paraula.text) {
    palabrasCompletadas.value++;

    if (palabrasCompletadas.value >= 20 && !JuegoTerminado.value) {
      JuegoTerminado.value = true;
      // Registrar tiempo final y enviar progreso final
      onGameEnd();
      communicationManager.updatePlayerProgress({
        completedWords: palabrasCompletadas.value,
        totalErrors: totalErrors.value,
        playTime:
          (endTime.value || Date.now()) - (startTime.value || Date.now()),
      });
      // Qualsevol acció extra: mostrar resultats, deshabilitar input, etc.
    } else {
      // Enviar progreso actualizado justo al completar la palabra (tiempo parcial)
      communicationManager.updatePlayerProgress({
        completedWords: palabrasCompletadas.value,
        totalErrors: totalErrors.value,
        playTime:
          (endTime.value || Date.now()) - (startTime.value || Date.now()),
      });
    }

    estatDelJoc.value.paraules.pop();
    estatDelJoc.value.textEntrat = "";
    tempsIniciParaula = 0;
    const nextParaula = paraulaActiva.value;
    if (nextParaula) {
      if (!Array.isArray(nextParaula.letterErrors) || nextParaula.letterErrors.length !== nextParaula.text.length) {
        nextParaula.letterErrors = Array.from({ length: nextParaula.text.length }, () => false);
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
// Lógica colores letras
function getClasseLletra(indexLletra) {
  if (!paraulaActiva.value) return "";
  const typed = estatDelJoc.value.textEntrat;
  const target = paraulaActiva.value.text;
  if (indexLletra >= typed.length) {
    if (paraulaActiva.value.letterErrors[indexLletra]) {
      return "incorrecte";
    }
    return "";
  }
  return typed[indexLletra] === target[indexLletra] ? "correcte" : "incorrecte";
}

onMounted(() => {
  // 1. Afegir listener de tecles
  window.addEventListener("keydown", handleKeyDown);
  
  // 2. Inicialitzar paraules (UNA SOLA VEGADA)
  if (
    estatDelJoc.value.paraules.length === 0 &&
    Array.isArray(props.initialWords) &&
    props.initialWords.length > 0
  ) {
    remainingWords.value = props.initialWords.slice();
  }

  // 3. Actualitzar marcador propi per a la sidebar
  const ownPlayer = props.players.find((p) => p.id === communicationManager.id);
  if (ownPlayer) {
    ownPlayer.completedWords = palabrasCompletadas.value;
  }

  // 4. Reportar si es té l'stack ple després de recarregar (però NO marcar l'estat final)
  if (
    !JuegoTerminado.value &&
    estatDelJoc.value.paraules.length >= props.maxStack
  ) {
    communicationManager.reportPlayerLost();
  }

  // 5. Configurar TOTS els listeners d'estat del joc (la font de la veritat)
  communicationManager.onPlayerEliminated((data) => {
    if (JuegoTerminado.value) return;
    perdedor.value = true;
    ganador.value = false;
    JuegoTerminado.value = true;
    onGameEnd();
    communicationManager.updatePlayerProgress({
      completedWords: palabrasCompletadas.value,
      totalErrors: totalErrors.value,
      playTime: (endTime.value || Date.now()) - (startTime.value || Date.now()),
    });
    perdidoMensaje.value =
      data?.message || "Has perdido: demasiadas palabras acumuladas.";
    playSound('gameLose');
    if (revealTimer) {
      clearInterval(revealTimer);
      revealTimer = null;
    }
  });

  communicationManager.onPlayerWon((data) => {
    if (JuegoTerminado.value) return;
    ganador.value = true;
    perdedor.value = false;
    JuegoTerminado.value = true;
    perdidoMensaje.value =
      data?.message || "¡Has ganado! Todos los demás fueron eliminados.";
    playSound('gameWin');
    if (revealTimer) {
      clearInterval(revealTimer);
      revealTimer = null;
    }
  });

  communicationManager.onGameOver((data) => {
    if (JuegoTerminado.value) return;
    onGameEnd();
    communicationManager.updatePlayerProgress({
      completedWords: palabrasCompletadas.value,
      totalErrors: totalErrors.value,
      playTime: (endTime.value || Date.now()) - (startTime.value || Date.now()),
    });
    if (data.winnerId === communicationManager.id) {
      ganador.value = true;
      perdedor.value = false;
      playSound('gameWin');
      perdidoMensaje.value = data.message || "¡Has ganado! Todos los demás fueron eliminados.";
    } else {
      ganador.value = false;
      perdedor.value = true;
      playSound('gameLose');
      perdidoMensaje.value = data.message || `Has perdido. ${data.winnerName} ha ganado.`;
    }
    JuegoTerminado.value = true;
    if (revealTimer) {
      clearInterval(revealTimer);
      revealTimer = null;
    }
  });

  // 6. Iniciar el timer per revelar paraules (UNA SOLA VEGADA)
  if (!JuegoTerminado.value) {
    revealTimer = setInterval(() => {
      if (JuegoTerminado.value) return; // Comprovació de seguretat
      try {
        if (
          remainingWords.value.length > 0 &&
          estatDelJoc.value.paraules.length < props.maxStack
        ) {
          const nextText = remainingWords.value.shift();
          const newParaula = {
            id: Date.now() + Math.random(),
            text: nextText,
            estat: "pendent",
            errors: 0,
            letterErrors: Array.from({ length: nextText.length }, () => false),
          };
          estatDelJoc.value.paraules.unshift(newParaula);
          playSound('newWord');
        }
        
        // **CORRECCIÓ CLAU:**
        // Només reportar la pèrdua. No canviar l'estat localment.
        // El listener 'onPlayerEliminated' s'encarregarà de gestionar la fi del joc.
        if (
          estatDelJoc.value.paraules.length >= props.maxStack &&
          !perdedor.value && !JuegoTerminado.value // Evita enviaments múltiples
        ) {
          communicationManager.reportPlayerLost();
        }
      } catch (e) {
        console.error("Error en revealTimer:", e);
      }
    }, props.intervalMs || 3000);
  }
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  if (revealTimer) {
    clearInterval(revealTimer);
    revealTimer = null;
  }
});

// Funció 'calculateProgress' eliminada perquè no s'utilitzava.
</script>

<template>
  <div> 
    <div class="game-header">
      <h2 class="modo-titulo">
        Modo de juego:
        <span :class="['modo-text', props.modo]">
          {{ props.modo === "muerteSubita" ? "Muerte Súbita" : "Normal" }}
        </span>
      </h2>
    </div>
    <div class="game-layout">
      <div class="game-main">
        <TransitionGroup name="fall" tag="div" class="paraules-container">
          <div
            v-for="(paraula, index) in estatDelJoc.paraules"
            :key="paraula.id"
            class="paraula"
            :class="{
              'paraula-activa': index === estatDelJoc.paraules.length - 1
            }"
          >
            <template v-if="index === estatDelJoc.paraules.length - 1">
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
          v-model="estatDelJoc.textEntrat"
          placeholder="> Comença a escriure..."
          :disabled="JuegoTerminado"
        />

        <div class="teclat">
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
        <h3>[REFUGIATS]</h3>
        <ul>
          <li v-for="p in props.players" :key="p.id" class="player-name-inline">
            <span class="color-dot" :style="{ backgroundColor: p.color, filter: `brightness(1.5) drop-shadow(0 0 5px ${p.color})` }"></span>
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
    />
  </div>
</template>

<style scoped>
/* [... Els teus estils romanen iguals ...] */
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
  background: linear-gradient(
    to top,
    var(--color-background-soft),
    transparent
  );
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
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 120px;
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

/* Animación de caída */
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

/* Animación de Shake */
.shake-animation {
  animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}
@keyframes shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
  40%, 60% { transform: translate3d(4px, 0, 0); }
}
</style>