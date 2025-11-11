<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import communicationManager from "../services/communicationManager.js";
import GameResult from "@/components/GameResult.vue";

// Props
const props = defineProps({
  initialWords: { type: Array, default: () => [] },
  intervalMs: { type: Number, default: 1500 },
  maxStack: { type: Number, default: 20 },
  players: { type: Array, default: () => [] },
  modo: { type: String, default: "normal" },
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
const emit = defineEmits(["volverInicio"]);
const palabrasCompletadas = ref(0);
const remainingWords = ref([]);
let revealTimer = null;
let tempsIniciParaula = 0;
function handleVolverInicio() {
  emit("volverInicio");
}
// Computed: palabra activa
const paraulaActiva = computed(() => {
  if (estatDelJoc.value.paraules.length === 0) {
    return null;
  }
  return estatDelJoc.value.paraules[estatDelJoc.value.paraules.length - 1];
});

const totalErrors = ref(0);

//variables corazones
const vidasRestantes = ref(3); //  Dos vidas por jugador
const tiempoRestante = ref(5); // 5 segundos
let countdownTimer = null;
const playersLives = ref({});

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
    validarProgres();
  } else if (key.length === 1 && /^[a-zA-Z]$/.test(key)) {
    event.preventDefault();
    estatDelJoc.value.textEntrat += key;
    validarProgres();
  }
}

// Cronómetro inicio palabra
function iniciarCronometreParaula() {
  tempsIniciParaula = Date.now();
}

// Validar progreso en palabra actual
function validarProgres() {
  if (JuegoTerminado.value) return;

  const typed = estatDelJoc.value.textEntrat;
  const paraula = paraulaActiva.value;

  if (!paraula) {
    estatDelJoc.value.textEntrat = "";
    reiniciarCronometro();
    return;
  }

  // Inicializar errores de letras si no existen
  if (
    !Array.isArray(paraula.letterErrors) ||
    paraula.letterErrors.length !== paraula.text.length
  ) {
    paraula.letterErrors = Array.from(
      { length: paraula.text.length },
      () => false
    );
  }

  // Si completó la palabra correctamente
  if (typed === paraula.text) {
    palabrasCompletadas.value++;
    const self = props.players.find((p) => p.id === communicationManager.id);
    if (self) self.completedWords = (self.completedWords || 0) + 1;

    // Contar errores de la palabra
    const wordErrors = paraula.letterErrors.filter(e => e).length;
    paraula.errors = wordErrors;
    paraula.estat = "completada";

    communicationManager.updatePlayerProgress({
      completedWords: palabrasCompletadas.value,
      lives: vidasRestantes.value,
    });
    // Limpiar input y reiniciar cronómetro
    estatDelJoc.value.paraules.pop();
    estatDelJoc.value.textEntrat = "";
    reiniciarCronometro();
    return;
  }

  // Validar cada letra y manejar errores
  for (let i = 0; i < typed.length; i++) {
    if (i >= paraula.text.length) break;

    const isError = typed[i] !== paraula.text[i];
    if (isError && !paraula.letterErrors[i]) {
      paraula.letterErrors[i] = true;

      // Reducir vidas si estamos en modo muerte súbita
      if (props.modo === "muerteSubita" && !perdedor.value && !ganador.value) {
        manejarError();
      }
    } else {
      paraula.letterErrors[i] = false;
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

function reiniciarCronometro() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
  tiempoRestante.value = 5; // Siempre se resetea a 5

  // Detener el timer si el juego ya terminó
  if (JuegoTerminado.value) return;

  countdownTimer = setInterval(() => {
    if (JuegoTerminado.value) {
      clearInterval(countdownTimer);
      return;
    }

    tiempoRestante.value -= 0.1;
    if (tiempoRestante.value <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
      manejarTiempoAgotado();
    }
  }, 100);
}

// Cuando se acaba el tiempo
function manejarTiempoAgotado() {
  if (JuegoTerminado.value) return;

  if (props.modo === "muerteSubita") {
    // Simplemente reiniciar el cronómetro sin penalización por tiempo
    reiniciarCronometro();
  }
}

// Manejar error al escribir
function manejarError() {
  if (JuegoTerminado.value) return;

  // Solo aplica en modo muerte súbita
  if (props.modo === "muerteSubita") {
    vidasRestantes.value--;
    updateLocalPlayerLives(vidasRestantes.value);

    // Efecto de error visual
    const input = document.querySelector(".text-input");
    if (input) {
      input.style.borderColor = "#ff4d4d";
      setTimeout(() => (input.style.borderColor = ""), 300);
    }

    // Si se quedó sin vidas, entonces derrota inmediata
    if (vidasRestantes.value <= 0) {
      perdedor.value = true;
      perdidoMensaje.value = "Has perdido todas tus vidas. ¡Estás eliminado!";
      JuegoTerminado.value = true;
      communicationManager.reportMuerteSubitaElimination();
      finalizarJuego();
    }
  }
}

  // 🚨 Función centralizada para actualizar vidas localmente y en el servidor
function updateLocalPlayerLives(newLives) {
  const playerId = communicationManager.id;
  if (playerId) {
    // 1. Actualiza el objeto interno (playersLives) para el rendering
    playersLives.value[playerId] = {
      ...(playersLives.value[playerId] || { name: "Tú" }),
      lives: newLives,
    };
    playersLives.value = { ...playersLives.value };
    communicationManager.updatePlayerProgress({
      lives: newLives,
    });
  }
}

// Ciclo vida
onMounted(() => {
  // Inicializar vidas de todos los jugadores (incluyendo el propio)
  if (props.players && props.players.length > 0) {
    props.players.forEach((player) => {
      playersLives.value[player.id] = {
        name: player.name,
        lives: 3,
      };
    });
  }
  
  // Inicializar vidas del jugador actual cuando se conecta
  communicationManager.onConnect((id) => {
    if (props.modo === "muerteSubita") {
      playersLives.value[id] = {
        name: "Tú",
        lives: vidasRestantes.value,
      };
      playersLives.value = { ...playersLives.value };
    }
  });  communicationManager.onPlayerWon((data) => {
    if (JuegoTerminado.value) return;
    ganador.value = true;
    perdedor.value = false;
    JuegoTerminado.value = true;
    perdidoMensaje.value =
      data?.message || "¡Has ganado! Todos los demás fueron eliminados.";
    if (revealTimer) clearInterval(revealTimer);
    if (countdownTimer) clearInterval(countdownTimer);
  });

  communicationManager.onPlayerProgressUpdate((data) => {
    if (data.playerId && data.lives !== undefined) {
      playersLives.value[data.playerId] = {
        ...(playersLives.value[data.playerId] || {}),
        lives: data.lives,
      };
    }
  });

  communicationManager.onPlayerEliminated((data) => {
    if (data.playerId) {
      if (playersLives.value[data.playerId]) {
        playersLives.value[data.playerId].lives = 0;
      }
    }
  });

  communicationManager.onGameOver((data) => {
    JuegoTerminado.value = true;
  });

  // Inicializar palabras restantes
  if (Array.isArray(props.initialWords) && props.initialWords.length > 0) {
    remainingWords.value = props.initialWords.slice();
  }

  // Iniciar timer para revelar palabras e iniciar el cronómetro
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
        
        // Si es la primera palabra, iniciar el cronómetro
        if (estatDelJoc.value.paraules.length === 1) {
          reiniciarCronometro();
        }
      }
    } catch (e) {
      console.error("Error en revealTimer:", e);
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

function finalizarJuego() {
  JuegoTerminado.value = true;
  if (revealTimer) clearInterval(revealTimer);
  if (countdownTimer) clearInterval(countdownTimer);
}
</script>

<template>
  <div>
    <div class="game-header">
      <!-- Sidebar + corazones -->

      <h2 class="modo-titulo">
        Mode de joc:
        <span :class="['modo-text', props.modo]">
          {{ props.modo === "muerteSubita" ? "Mort Súbita" : "Normal" }}
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
        <div class="input-barra-wrapper">
          <input
            type="text"
            class="text-input"
            v-model="estatDelJoc.textEntrat"
            @input="validarProgres"
            @keydown="handleKeyDown"
            placeholder="Comença a escriure..."
            :disabled="JuegoTerminado"
            autocomplete="off"
          />
          <div class="barra-tiempo">
            <div
              class="progreso-tiempo"
              :style="{ width: (tiempoRestante / 5) * 100 + '%' }"
            ></div>
          </div>
        </div>

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
          <li
            v-for="p in props.players"
            :key="p.id"
            class="player-item"
            :class="{ eliminado: p.eliminated || playersLives[p.id]?.lives === 0 }"
          >
            <div class="player-info">
              <span class="player-name-text">{{ p.name }}</span>
              <span
                v-if="p.eliminated"
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
                <span
                  v-for="n in (playersLives[p.id]?.lives || 0)"
                  :key="n"
                  class="corazon"
                  >❤️</span
                >
              </div>
            </div>
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
        :modo="props.modo"
      />
    </div>
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
  background-color: #00ff7f;
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

/*estilos para el header del modo de juego*/

.game-header {
  width: 100%;
  text-align: center;
  margin-bottom: 12px;
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
