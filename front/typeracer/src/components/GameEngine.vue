<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import communicationManager from "../services/communicationManager.js";

const props = defineProps({
  initialWords: { type: Array, default: () => [] },
  players: { type: Array, default: () => [] },
});
const filesDelTeclat = ref([
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
]);
const teclaPremuda = ref("");
const JuegoTerminado = ref(false);
const estatDelJoc = ref({
  paraules: [
    { id: 1, text: "component", estat: "pendent", errors: 0 },
    { id: 2, text: "reactivitat", estat: "pendent", errors: 0 },
    { id: 3, text: "javascript", estat: "pendent", errors: 0 },
    { id: 4, text: "framework", estat: "pendent", errors: 0 },
    { id: 5, text: "template", estat: "pendent", errors: 0 },
  ],
  indexParaulaActiva: 0,
  textEntrat: "",
  estadistiques: [],
});

const progresJuagdor = ref(0);

let tempsIniciParaula = 0;

function handleKeyDown(event) {
  teclaPremuda.value = event.key.toUpperCase();
  setTimeout(() => {
    teclaPremuda.value = "";
  }, 100);
}
onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);

  // actualizaciones de progreso pueden venir por socket; si queremos usarlas
  // podemos escucharlas aquí, pero por ahora preferimos recibir `players`
  // desde el padre (App.vue) y usar `props.players` para mostrar nombres.

  // Si el servidor ha passat paraules inicials, les usem
  if (Array.isArray(props.initialWords) && props.initialWords.length > 0) {
    estatDelJoc.value.paraules = props.initialWords.map((w, i) => ({
      id: i + 1,
      text: w,
      estat: "pendent",
      errors: 0,
    }));
    estatDelJoc.value.indexParaulaActiva = 0;
  }

  estatDelJoc.value.paraules.forEach((p) => {
    if (
      !Array.isArray(p.letterErrors) ||
      p.letterErrors.length !== p.text.length
    ) {
      p.letterErrors = Array.from({ length: p.text.length }, () => false);
      p.errors = p.errors || 0;
    }
  });
});
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
});
function iniciarCronometreParaula() {
  tempsIniciParaula = Date.now();
}

function validarProgres() {
  if (estatDelJoc.value.textEntrat.length === 1 && tempsIniciParaula === 0) {
    iniciarCronometreParaula();
  }

  const typed = estatDelJoc.value.textEntrat;
  const target = paraulaActiva.value.text;

  for (let i = 0; i < typed.length && i < target.length; i++) {
    if (typed[i] !== target[i]) {
      paraulaActiva.value.letterErrors[i] = true;
    }
  }

  const totalErrors = (paraulaActiva.value.letterErrors || []).reduce(
    (acc, cur) => acc + (cur ? 1 : 0),
    0
  );
  paraulaActiva.value.errors = totalErrors;
  console.log(
    `Errors en la paraula "${paraulaActiva.value.text}": ${totalErrors}`
  );

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

    if (
      estatDelJoc.value.indexParaulaActiva < estatDelJoc.value.paraules.length
    ) {
      const next =
        estatDelJoc.value.paraules[estatDelJoc.value.indexParaulaActiva];
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
    } else {
      // Fin del juego: mostrar estadísticas deshabilitado
      // Si se desea volver a activar, descomentar las siguientes líneas
      // JuegoTerminado.value = true;
      // console.log("Joc acabat!", estatDelJoc.value.estadistiques);
    }
  }
}

function getClasseLletra(indexLletra) {
  if (
    indexLletra < estatDelJoc.value.textEntrat.length &&
    estatDelJoc.value.textEntrat[indexLletra] ===
      paraulaActiva.value.text[indexLletra]
  ) {
    return "correcte";
  }

  const hadError =
    paraulaActiva.value.letterErrors &&
    paraulaActiva.value.letterErrors[indexLletra];
  if (hadError) {
    return "incorrecte";
  }

  if (indexLletra >= estatDelJoc.value.textEntrat.length) {
    return "";
  } else if (
    estatDelJoc.value.textEntrat[indexLletra] ===
    paraulaActiva.value.text[indexLletra]
  ) {
    return "correcte";
  } else {
    return "incorrecte";
  }
}

const paraulaActiva = computed(() => {
  return estatDelJoc.value.paraules[estatDelJoc.value.indexParaulaActiva];
});

function calculateProgress(completedWords) {
  return (completedWords / estatDelJoc.value.paraules.length) * 100;
}
</script>
<template>
  <div class="game-engine">
    <div class="game-layout">
      <div class="game-main">
        <div class="paraules-container">
          <!-- Iterem sobre la llista de paraules -->
          <div
            v-for="(paraula, index) in estatDelJoc.paraules"
            :key="paraula.id"
            class="paraula"
            :class="{
              'paraula-activa': index === estatDelJoc.indexParaulaActiva,
            }"
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
        </div>
      </div>

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
/* Kept styles used by this component's template */
.correcte {
  color: green;
}
.incorrecte {
  color: red;
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

/* Layout: game main + sidebar */
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

/* Players sidebar (compact list) */
.players-sidebar {
  position: fixed;
  right: 100px;
  width: 350px;
  background: var(--color-background-soft);
  border-radius: 8px;
  padding: 12px 16px;
  align-self: flex-start;
  top: 20px;
  box-shadow: 0 6px 18px var(--shadow-color);
  border: 1px solid var(--color-border);
}
.players-sidebar h3 {
  margin: 0 0 12px 0;
  text-align: center;
  color: var(--color-heading);
  font-weight: 700;
  font-size: 1.1rem;
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
  color: var(--color-text);
  font-weight: 600;
}
.player-name-text {
  font-weight: 700;
  color: var(--color-heading);
}
.completed-count {
  font-size: 12px;
  color: var(--color-text);
  opacity: 0.9;
}
</style>
