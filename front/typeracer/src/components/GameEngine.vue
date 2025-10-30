<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import communicationManager from "../services/communicationManager.js";
import GameResult from "@/components/GameResult.vue";

// Props
const props = defineProps({
  initialWords: { type: Array, default: () => [] },
  intervalMs: { type: Number, default: 2000 },
  maxStack: { type: Number, default: 20 },
  players: { type: Array, default: () => [] },
});

//variables per guanyador y perdedor
const perdedor = ref(false);
const ganador = ref(false);
const perdidoMensaje = ref("");

// Estado del teclado
const filesDelTeclat = ref([
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
]);
const teclaPremuda = ref("");

// Estado del juego
const JuegoTerminado = ref(false);
const estatDelJoc = ref({
  paraules: [], // pila de palabras visibles
  textEntrat: "", // texto introducido por el usuario
  estadistiques: [], // estadísticas (deshabilitadas)
  indexParaulaActiva: 0, // índice para palabra activa (si usas)
});
const palabrasCompletadas = ref(0);

// Variables auxiliares
const remainingWords = ref([]); // palabras pendientes por revelar
let revealTimer = null;
let tempsIniciParaula = 0;

// Computed: palabra activa (la primera de la pila)
const paraulaActiva = computed(() => {
  if (
    estatDelJoc.value.paraules.length === 0 ||
    estatDelJoc.value.indexParaulaActiva >= estatDelJoc.value.paraules.length
  ) {
    return null;
  }
  return estatDelJoc.value.paraules[estatDelJoc.value.indexParaulaActiva];
});

// Manejo del teclado (para animar tecla pulsada)
function handleKeyDown(event) {
  if (event.key.length > 1 && event.key !== "Backspace") return;
  teclaPremuda.value = event.key.toUpperCase();
  setTimeout(() => {
    teclaPremuda.value = "";
  }, 100);
}

// Inicializar timer para medir tiempo de palabra
function iniciarCronometreParaula() {
  tempsIniciParaula = Date.now();
}

// Validar progreso en la palabra actual y actualizar estado
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

  const target = paraula.text;
  paraula.letterErrors.fill(false);
  let errorCount = 0;

  for (let i = 0; i < typed.length; i++) {
    if (i >= target.length) break;
    if (typed[i] !== target[i]) {
      paraula.letterErrors[i] = true;
      errorCount++;
    }
  }
  paraula.errors = errorCount;

  if (typed === target) {
    palabrasCompletadas.value++;

    communicationManager.updatePlayerProgress(palabrasCompletadas.value);

    // Eliminar palabra completada del array
    estatDelJoc.value.paraules.splice(estatDelJoc.value.indexParaulaActiva, 1);

    // Resetear índice a 0 para la siguiente palabra (ahora primera)
    estatDelJoc.value.indexParaulaActiva = 0;

    estatDelJoc.value.textEntrat = "";
    tempsIniciParaula = 0;

    // Preparar la siguiente palabra, si existe
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

// Lógica visual para pintar colores de letras
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

// Ciclo de vida
onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
  //perdedor y ganador
  communicationManager.onPlayerEliminated((data) => {
    if (JuegoTerminado.value) return;
    perdedor.value = true;
    ganador.value = false;
    JuegoTerminado.value = true;
    perdidoMensaje.value =
      data?.message || "Has perdido: demasiadas palabras acumuladas.";
  });

  //  Cuando este jugador gana
  communicationManager.onPlayerWon((data) => {
    if (JuegoTerminado.value) return;
    ganador.value = true;
    perdedor.value = false;
    JuegoTerminado.value = true;
    perdidoMensaje.value =
      data?.message || "¡Has ganado! Todos los demás fueron eliminados.";
  });

  //  Cuando la partida termina para todos (por ejemplo, último jugador en pie)
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
  });

  // Si hay palabras iniciales de props, se cargan en remainingWords
  if (Array.isArray(props.initialWords) && props.initialWords.length > 0) {
    remainingWords.value = props.initialWords.slice();
  }

  // Timer para revelar palabras periódicamente
  revealTimer = setInterval(() => {
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
        // Añadimos palabra al final
        estatDelJoc.value.paraules.push(newParaula);
      }
      if (
        estatDelJoc.value.paraules.length >= props.maxStack &&
        !perdedor.value
      ) {
        perdedor.value = true;
        JuegoTerminado.value = true;
        perdidoMensaje.value = "Has perdido: demasiadas palabras acumuladas.";
        communicationManager.reportPlayerLost();
      }
    } catch (e) {
      console.error("Error en revealTimer:", e);
    }
  }, props.intervalMs || 3000);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  if (revealTimer) clearInterval(revealTimer);
});

function calculateProgress(completedWords) {
  return (completedWords / estatDelJoc.value.paraules.length) * 100;
}
</script>

<template>
  <div class="game-engine">
    <div class="paraules-container">
      <!-- Iteramos sobre la lista de palabras -->
      <div
        v-for="(paraula, index) in estatDelJoc.paraules"
        :key="paraula.id"
        class="paraula"
        :class="{
          'paraula-activa': index === estatDelJoc.indexParaulaActiva,
          'completada-correcta':
            paraula.estat === 'completada' && paraula.errors === 0,
          'completada-incorrecta':
            paraula.estat === 'completada' && paraula.errors > 0,
        }"
      >
        <!-- Mostrar letras solo en palabra activa -->
        <template v-if="index === estatDelJoc.indexParaulaActiva">
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
    </div>

    <input
      type="text"
      class="text-input"
      v-model="estatDelJoc.textEntrat"
      @input="validarProgres"
      placeholder="Comença a escriure..."
    />

    <div class="teclat">
      <div v-for="(fila, fIndex) in filesDelTeclat" :key="fIndex" class="fila">
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

    <!-- Sidebar jugadores -->
    <aside class="players-sidebar">
      <h3>Jugadors</h3>
      <ul>
        <li v-for="p in props.players" :key="p.id" class="player-name-inline">
          <span class="player-name-text">{{ p.name }}</span>
          <span class="completed-count"
            >Paraules fetes: {{ p.completedWords || 0 }}</span
          >
        </li>
      </ul>
    </aside>
    <GameResult
      v-if="JuegoTerminado"
      :winner="ganador"
      :loser="perdedor"
      :message="perdidoMensaje"
    />
  </div>
</template>

<style scoped>
/* Aquí van tus estilos originales sin cambios */

/* Container, letras, clases correctas/incorrectas, teclado, sidebar, etc */

.estadisticas {
  margin-top: 20px;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
}

.stat-item {
  margin: 10px 0;
  padding: 10px;
  background-color: #000000;
  border-radius: 4px;
}

.stat-item p {
  margin: 0;
  line-height: 1.5;
}
.correcte {
  color: green;
  font-weight: bold;
}
.incorrecte {
  color: red;
  text-decoration: underline;
}
.teclat {
  margin-top: 20px;
  text-align: center;
}
.fila {
  margin-bottom: 5px;
}
.tecla {
  display: inline-block;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid #ccc;
  width: 30px;
  height: 30px;
  margin: 2px;
}
.tecla-premuda {
  background-color: lightblue;
  border-color: #007bff;
}
.paraules-container {
  min-height: 300px;
  border: 1px solid #ccc;
  padding: 10px;
  display: flex;
  flex-direction: column-reverse;
  justify-content: flex-start;
}
.paraula {
  font-size: 1.5em;
  padding: 5px;
  text-align: center;
  border: 1px solid transparent;
  margin-bottom: 4px;
}
.paraula-activa {
  font-weight: bold;
  border-color: blue;
  background-color: #f0f8ff;
}
.text-input {
  width: 100%;
  padding: 10px;
  font-size: 1.2em;
  margin-top: 10px;
  box-sizing: border-box;
}
.player-progress {
  width: 100%;
  background-color: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  height: 10px;
}
.progress-bar {
  height: 100%;
  background-color: #76c7c0;
}
.words-completed {
  font-size: 12px;
  color: #555;
}
.players-inline {
  margin-top: 12px;
  padding: 4px;
}
.players-inline h3 {
  margin: 0 0 8px 0;
  font-size: 14px;
  text-align: left;
  color: #ddd;
}
.players-inline ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.player-name-inline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  margin-bottom: 6px;
  background: transparent;
  border-radius: 4px;
  box-shadow: none;
  border: none;
  color: #eee;
  font-weight: 600;
}
.player-name-text {
  font-weight: 600;
}
.completed-count {
  font-size: 12px;
  color: #bbb;
}
.game-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: nowrap;
  justify-content: center;
}
.game-main {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 720px;
}
.players-sidebar {
  position: fixed;
  right: 20px;
  width: 350px;
  background: transparent;
  border-radius: 6px;
  padding: 15px;
  box-shadow: none;
  align-self: flex-start;
  top: 20px;
  box-shadow: 0 2px 4px rgba(255, 255, 255, 1);
}
.players-sidebar h3 {
  margin: 0 0 15px 0;
  text-align: center;
  color: #ddd;
  font-weight: 750;
}
.sidebar ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.player {
  margin-bottom: 15px;
  padding: 10px;
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.player-name {
  font-weight: bold;
  margin-bottom: 8px;
}
.player-progress {
  width: 100%;
  background-color: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  height: 10px;
  margin-bottom: 5px;
}
.progress-bar {
  height: 100%;
  background-color: #76c7c0;
  transition: width 0.3s ease;
}
.words-completed {
  font-size: 12px;
  color: #555;
}
</style>
