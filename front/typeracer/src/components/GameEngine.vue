<script setup>
import { ref, computed, onMounted, onUnmounted, watch, defineEmits } from "vue";
import communicationManager from "../services/communicationManager.js";
import GameResult from "@/components/GameResult.vue";

const emit = defineEmits(["volverInicio"]);
// Props
const props = defineProps({
  initialWords: { type: Array, default: () => [] },
  intervalMs: { type: Number, default: 1500 },
  maxStack: { type: Number, default: 20 },
  players: { type: Array, default: () => [] },
});

// Estado ganador y perdedor
const perdedor = ref(false);
const ganador = ref(false);
const perdidoMensaje = ref("");

// Estado teclado
const filesDelTeclat = ref([
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
]);
const teclaPremuda = ref("");

// Estado juego
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

// Computed: palabra activa
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

// Manejo teclado
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
  } else if (key.length === 1 && /^[a-zA-Z]$/.test(key)) {
    event.preventDefault();
    estatDelJoc.value.textEntrat += key;
  } else {
    return;
  }

  validarProgres();
}

// Cronómetro inicio palabra
function iniciarCronometreParaula() {
  tempsIniciParaula = Date.now();
}

// Validar progreso en palabra actual
function validarProgres() {
  if (estatDelJoc.value.textEntrat.length === 1 && tempsIniciParaula === 0) {
    iniciarCronometreParaula();
  }

  const typed = estatDelJoc.value.textEntrat;
  const paraula = paraulaActiva.value;

  if (!paraula) {
    estatDelJoc.value.textEntrat = "";
    return;
  }

  if (
    !Array.isArray(paraula.letterErrors) ||
    paraula.letterErrors.length !== paraula.text.length
  ) {
    paraula.letterErrors = Array.from(
      { length: paraula.text.length },
      () => false
    );
  }

  let errorCount = 0;

  for (let i = 0; i < typed.length; i++) {
    if (i >= paraula.text.length) break;
    const isError = typed[i] !== paraula.text[i];
    if (isError) {
      // Solo incrementa errores totales si el error en esta letra no estaba marcado antes
      if (!paraula.letterErrors[i]) {
        totalErrors.value++;
      }
      paraula.letterErrors[i] = true;
      errorCount++;
    } else {
      // Si la letra es correcta, aseguramos que no hay error ahí
      paraula.letterErrors[i] = false;
    }
  }
  paraula.errors = errorCount; // Enviar progreso y errores acumulados al servidor

  communicationManager.updatePlayerProgress({
    completedWords: palabrasCompletadas.value,
    totalErrors: totalErrors.value,
  });

  if (typed === paraula.text) {
    palabrasCompletadas.value++;

    // Enviar progreso actualizado justo al completar la palabra
    communicationManager.updatePlayerProgress({
      completedWords: palabrasCompletadas.value,
      totalErrors: totalErrors.value,
    });

    estatDelJoc.value.paraules.pop();
    estatDelJoc.value.textEntrat = "";
    tempsIniciParaula = 0;

    const nextParaula = paraulaActiva.value;
    if (nextParaula) {
      if (
        !Array.isArray(nextParaula.letterErrors) ||
        nextParaula.letterErrors.length !== nextParaula.text.length
      ) {
        nextParaula.letterErrors = Array.from(
          { length: nextParaula.text.length },
          () => false
        );
        nextParaula.errors = 0;
      }
    }
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

// Ciclo vida
onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
  // Al inicio (onMounted)
  if (
    estatDelJoc.value.paraules.length === 0 &&
    Array.isArray(props.initialWords) &&
    props.initialWords.length > 0
  ) {
    remainingWords.value = props.initialWords.slice();
  }

  // Actualiza marcador propio para la sidebar
  const ownPlayer = props.players.find((p) => p.id === communicationManager.id);
  if (ownPlayer) {
    ownPlayer.completedWords = palabrasCompletadas.value;
  }

  // Reporta al backend si tienes el stack lleno tras recargar (pero NO marques tú el estado final)
  if (
    !JuegoTerminado.value &&
    estatDelJoc.value.paraules.length >= props.maxStack
  ) {
    communicationManager.reportPlayerLost();
  }

  // Inicializa palabras si no tienes estado guardado
  if (
    estatDelJoc.value.paraules.length === 0 &&
    Array.isArray(props.initialWords) &&
    props.initialWords.length > 0
  ) {
    remainingWords.value = props.initialWords.slice();
  }

  // Timer solo si no has perdido ni se ha acabado el juego
  if (
    !JuegoTerminado.value &&
    estatDelJoc.value.paraules.length < props.maxStack
  ) {
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
            estat: "pendent",
            errors: 0,
            letterErrors: Array.from({ length: nextText.length }, () => false),
          };
          estatDelJoc.value.paraules.unshift(newParaula);
        }
        if (
          estatDelJoc.value.paraules.length >= props.maxStack &&
          !perdedor.value
        ) {
          communicationManager.reportPlayerLost();
        }
      } catch (e) {
        console.error("Error en revealTimer:", e);
      }
    }, props.intervalMs || 3000);
  }

  // SOLO estos eventos gestionan la pantalla final
  communicationManager.onPlayerEliminated((data) => {
    if (JuegoTerminado.value) return;
    perdedor.value = true;
    ganador.value = false;
    JuegoTerminado.value = true;
    perdidoMensaje.value =
      data?.message || "Has perdido: demasiadas palabras acumuladas.";
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
    if (revealTimer) {
      clearInterval(revealTimer);
      revealTimer = null;
    }
  });

  communicationManager.onGameOver((data) => {
    if (JuegoTerminado.value) return;

    if (data.winnerId === communicationManager.id) {
      ganador.value = true;
      perdedor.value = false;
      perdidoMensaje.value =
        data.message || "¡Has ganado! Todos los demás fueron eliminados.";
    } else {
      ganador.value = false;
      perdedor.value = true;
      perdidoMensaje.value =
        data.message || `Has perdido. ${data.winnerName} ha ganado.`;
    }

    JuegoTerminado.value = true;
    if (revealTimer) {
      clearInterval(revealTimer);
      revealTimer = null;
    }
  });
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  if (revealTimer) {
    clearInterval(revealTimer);
    revealTimer = null;
  }
});

function calculateProgress(completedWords) {
  return (completedWords / estatDelJoc.value.paraules.length) * 100;
}
</script>

<template>
  <div class="game-layout">
    <div class="game-main">
      <TransitionGroup name="fall" tag="div" class="paraules-container">
        <div
          v-for="(paraula, index) in estatDelJoc.paraules"
          :key="paraula.id"
          class="paraula"
          :class="{
            'paraula-activa': index === estatDelJoc.paraules.length - 1,
            'completada-correcta':
              paraula.estat === 'completada' && paraula.errors === 0,
            'completada-incorrecta':
              paraula.estat === 'completada' && paraula.errors > 0,
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
        v-model="estatDelJoc.textEntrat"
        @input="validarProgres"
        placeholder="Comença a escriure..."
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
      <h3>Jugadors</h3>
      <ul>
        <li v-for="p in props.players" :key="p.id" class="player-name-inline">
          <span class="player-name-text">{{ p.name }}</span>
          <span class="completed-count">
            Paraules fetes: {{ p.completedWords || 0 }}
          </span>
        </li>
      </ul>
    </aside>

    <GameResult
      v-if="JuegoTerminado"
      :winner="ganador"
      :loser="perdedor"
      :message="perdidoMensaje"
      :players="props.players"
      @volverInicio="handleVolverInicio"
    />
  </div>
</template>

<style scoped>
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
  /* sticky keyboard so it remains visible while words scroll */
  position: sticky;
  bottom: 0;
  margin-top: 12px;
  text-align: center;
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
  border-radius: 4px;
  border: 1px solid var(--color-border, #ccc);
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
  /* keep the keyboard visible by bounding the game area height */
  min-height: calc(60vh);
  max-height: calc(80vh);
}

.players-sidebar {
  width: 300px;
  background: var(--color-background-soft, #f8f8f8);
  border-radius: 8px;
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
  font-size: 1.1rem;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
  padding-bottom: 8px;
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
  /* Make the word stack scroll inside this box instead of growing the page */
  border: 1px solid var(--color-border, #ccc);
  background: var(--color-background, #fff);
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  border-radius: 8px;
  box-shadow: inset 0 2px 8px var(--shadow-color, rgba(0, 0, 0, 0.05));
  overflow-y: auto;
  /* allow this area to grow within .game-main but not push the keyboard */
  flex: 1 1 auto;
  min-height: 120px;
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
  font-family: "Courier New", Courier, monospace;
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
  font-family: "Courier New", Courier, monospace;
  text-align: center;
  box-shadow: 0 2px 12px rgba(0, 123, 255, 0.08);
  outline: none;
  transition: border-color 0.15s;
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
</style>
