<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import communicationManager from "../services/communicationManager.js";

const props = defineProps({
  initialWords: { type: Array, default: () => [] },
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
const jugadors = ref([]);

let tempsIniciParaula = 0;

function handleKeyDown(event) {
  teclaPremuda.value = event.key.toUpperCase();
  setTimeout(() => {
    teclaPremuda.value = "";
  }, 100);
}
onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);

  communicationManager.onPlayerProgressUpdate((updatedPlayers) => {
    jugadors.value = updatedPlayers;
  });

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

    // Actualitzar el progrés del jugador
    progresJuagdor.value =
      ((estatDelJoc.value.indexParaulaActiva + 1) /
        estatDelJoc.value.paraules.length) *
      100;

    communicationManager.updatePlayerProgress(progresJuagdor.value);

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
      <div class="sidebar">
        <h3>Jugadors</h3>
        <ul>
          <li
            v-for="(jugador, index) in jugadors"
            :key="jugador.id"
            class="player"
          >
            <div class="player-name">{{ jugador.name }}</div>
            <div class="player-progress">
              <div
                class="progress-bar"
                :style="{
                  width: calculateProgress(jugador.completedWords) + '%',
                }"
              ></div>
            </div>
            <div class="words-completed">
              {{ jugador.completedWords }} paraules
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
<style scoped>
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

.sidebar {
  position: fixed;
  right: 20px;
  top: 20px;
  width: 250px;
  background-color: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.sidebar h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
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
