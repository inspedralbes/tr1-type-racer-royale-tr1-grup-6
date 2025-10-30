<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import communicationManager from "../services/communicationManager.js";
const props = defineProps({
  initialWords: { type: Array, default: () => [] },
  intervalMs: { type: Number, default: 2000 },
  maxStack: { type: Number, default: 20 },
  players: { type: Array, default: () => [] },
});

// --- ESTADO DEL TECLADO ---
const filesDelTeclat = ref([
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
]);
const teclaPremuda = ref("");

// --- ESTADO DEL JUEGO ---
const JuegoTerminado = ref(false);
const estatDelJoc = ref({
  paraules: [], // La pila de palabras visibles
  textEntrat: "", // Lo que el usuario está tecleando
  estadistiques: [],
});
const progresJuagdor = ref(0);

const remainingWords = ref([]); // Palabras pendientes del servidor
let revealTimer = null;
let tempsIniciParaula = 0;

// --- COMPUTED: PALABRA ACTIVA ---
// Correcto: La palabra activa es la ÚLTIMA del array (la de más abajo)
const paraulaActiva = computed(() => {
  if (estatDelJoc.value.paraules.length === 0) {
    return null; // No hay palabras activas
  }
  return estatDelJoc.value.paraules[estatDelJoc.value.paraules.length - 1];
});

// --- MANEJO DEL TECLADO ---
function handleKeyDown(event) {
  if (event.key.length > 1 && event.key !== "Backspace") return;
  teclaPremuda.value = event.key.toUpperCase();
  setTimeout(() => {
    teclaPremuda.value = "";
  }, 100);
}

// --- CICLO DE VIDA ---
onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);

  // actualizaciones de progreso pueden venir por socket; si queremos usarlas
  // podemos escucharlas aquí, pero por ahora preferimos recibir `players`
  // desde el padre (App.vue) y usar `props.players` para mostrar nombres.

  // Si el servidor ha passat paraules inicials, les usem
  if (Array.isArray(props.initialWords) && props.initialWords.length > 0) {
    remainingWords.value = props.initialWords.slice();
  }

  // Timer para revelar palabras
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
        // LÓGICA DE CAÍDA: .unshift() añade la palabra nueva ARRIBA (índice 0)
        estatDelJoc.value.paraules.unshift(newParaula);
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

// --- LÓGICA DEL JUEGO ---
function iniciarCronometreParaula() {
  tempsIniciParaula = Date.now();
}

function validarProgres() {
  if (estatDelJoc.value.textEntrat.length === 1 && tempsIniciParaula === 0) {
    iniciarCronometreParaula();
  }

  const typed = estatDelJoc.value.textEntrat;

  if (!paraulaActiva.value) {
    estatDelJoc.value.textEntrat = "";
    return;
  }

  const target = paraulaActiva.value.text;

  // CORREGIDO: Lógica de errores DIRECTA
  paraulaActiva.value.letterErrors.fill(false);
  let errorCount = 0;
  for (let i = 0; i < typed.length; i++) {
    if (i >= target.length) break; // Se pasó de largo

    // Compara la letra tecleada (ej. typed[0] = 'v')
    // con la letra mostrada (ej. target[0] = 'v')
    if (typed[i] !== target[i]) {
      paraulaActiva.value.letterErrors[i] = true;
      errorCount++;
    }
  }
  paraulaActiva.value.errors = errorCount;

  // --- Comprobación de Victoria ---
  // CORREGIDO: Compara lo tecleado con el objetivo DIRECTO
  if (typed === target) {
    const tempsTrigat = Date.now() - tempsIniciParaula;

    // Registrado de estadísticas deshabilitado por petición del equipo
    // Descomentar si se desea registrar datos de cada palabra
    // estatDelJoc.value.estadistiques.push({
    //   paraula: paraulaActiva.value.text,
    //   temps: tempsTrigat,
    //   errors: paraulaActiva.value.errors,
    // });
    // número de palabras completadas (antes de incrementar index)
    const completedCount = estatDelJoc.value.indexParaulaActiva + 1;
    communicationManager.updatePlayerProgress(completedCount);

    paraulaActiva.value.estat = "completada";

    estatDelJoc.value.indexParaulaActiva++;

    estatDelJoc.value.textEntrat = "";
    tempsIniciParaula = 0;

    // Prepara la NUEVA palabra activa (si queda alguna)
    if (paraulaActiva.value) {
      // 'paraulaActiva' computed ya apunta a la nueva
      const next = paraulaActiva.value;
      if (
        !Array.isArray(next.letterErrors) ||
        next.letterErrors.length !== next.text.length
      ) {
        next.letterErrors = Array.from(
          { length: next.text.length },
          () => false
        );
        next.errors = 0;
      }
    }
  }
}

// --- LÓGICA VISUAL (PINTAR LETRAS) ---
function getClasseLletra(indexLletra) {
  // 'indexLletra' es el índice de la palabra MOSTRADA (ej. 0 para 'v' en "votar")
  const typed = estatDelJoc.value.textEntrat;

  if (!paraulaActiva.value) return "";

  const target = paraulaActiva.value.text;

  // CORREGIDO: Lógica de pintado DIRECTA

  // Si el usuario aún no ha tecleado esa letra
  if (indexLletra >= typed.length) {
    // Pintar si ya tuvo un error aquí (al borrar)
    if (paraulaActiva.value.letterErrors[indexLletra]) {
      return "incorrecte";
    }
    return ""; // Pendiente
  }

  // Compara la letra tecleada (directa) con la mostrada (directa)
  if (typed[indexLletra] === target[indexLletra]) {
    return "correcte";
  } else {
    return "incorrecte";
  }
}

function calculateProgress(completedWords) {
  return (completedWords / estatDelJoc.value.paraules.length) * 100;
}
</script>

<template>
  <div class="game-engine">
    <div class="paraules-container">
      <!-- Iterem sobre la llista de paraules -->
      <div
        v-for="(paraula, index) in estatDelJoc.paraules"
        :key="paraula.id"
        class="paraula"
        :class="{ 'paraula-activa': index === estatDelJoc.indexParaulaActiva }"
      >
        <!-- Més endavant mostrarem les lletres aquí -->
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
      <!-- Estadísticas al final del juego: comentadas por petición del equipo
      <div v-if="JuegoTerminado" class="estadisticas">
        <h2>¡Juego terminado! Estadísticas:</h2>
        <div
          v-for="(stat, index) in estatDelJoc.estadistiques"
          :key="index"
          class="stat-item"
        >
          <p>
            Palabra: <strong>{{ stat.paraula }}</strong
            ><br />
            Tiempo: <strong>{{ (stat.temps / 1000).toFixed(2) }}s</strong><br />
            Errores: <strong>{{ stat.errors }}</strong>
          </p>
        </div>
      </div>
      -->
      <!-- Lateral: lista compacta de jugadores -->
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
    </div>
  </div>
</template>

<style scoped>
/* Tus estilos originales */
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
/* Estilos para que la pila funcione de arriba a abajo */
.paraules-container {
  min-height: 300px;
  border: 1px solid #ccc;
  padding: 10px;
  display: flex;
  flex-direction: column; /* Dirección normal (arriba a abajo) */
  justify-content: flex-start; /* Palabras alineadas arriba */
}
.paraula {
  font-size: 1.5em;
  padding: 5px;
  text-align: center;
  border: 1px solid transparent;
  margin-bottom: 4px; /* Espacio entre palabras */
}
/* La palabra de abajo (la activa) se resalta */
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

/* Inline players list inside the GameEngine (simple) */
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

/* Layout: game main + sidebar */
.game-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: nowrap; /* evitar que la sidebar baje debajo del contenido */
  justify-content: center; /* centrar conjunto en pantallas grandes */
}
.game-main {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 720px; /* limitar ancho del área principal para dejar sitio a la sidebar */
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
  top: 20px; /* la hace visible al hacer scroll */
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
