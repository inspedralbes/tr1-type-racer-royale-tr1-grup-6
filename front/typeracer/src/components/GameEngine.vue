<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import comms from "../services/communicationManager.js";

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
  paraules: [],
  indexParaulaActiva: 0,
  textEntrat: "",
});

let tempsIniciParaula = 0;

const paraulaActiva = computed(() => {
  return estatDelJoc.value.paraules[estatDelJoc.value.indexParaulaActiva];
});

function handleKeyDown(event) {
  teclaPremuda.value = event.key.toUpperCase();
  setTimeout(() => {
    teclaPremuda.value = "";
  }, 100);
}

function iniciarCronometreParaula() {
  tempsIniciParaula = Date.now();
}

function validarProgres() {
  if (!paraulaActiva.value) return;

  if (estatDelJoc.value.textEntrat.length === 1 && tempsIniciParaula === 0) {
    iniciarCronometreParaula();
  }

  const typed = estatDelJoc.value.textEntrat;
  const target = paraulaActiva.value.text;

  paraulaActiva.value.letterErrors = paraulaActiva.value.letterErrors || [];
  for (let i = 0; i < typed.length && i < target.length; i++) {
    paraulaActiva.value.letterErrors[i] = typed[i] !== target[i];
  }

  paraulaActiva.value.errors = paraulaActiva.value.letterErrors.filter(Boolean).length;

  if (typed === target) {
    paraulaActiva.value.estat = "completada";
    estatDelJoc.value.indexParaulaActiva++;
    estatDelJoc.value.textEntrat = "";
    tempsIniciParaula = 0;

    // Emitir al backend
    comms.emit("wordCompleted");

    // Inicializar siguiente palabra
    const next = paraulaActiva.value;
    if (next) {
      next.letterErrors = Array.from({ length: next.text.length }, () => false);
      next.errors = 0;
    }
  }
}

function getClasseLletra(indexLletra) {
  if (!paraulaActiva.value) return "";
  if (
    indexLletra < estatDelJoc.value.textEntrat.length &&
    estatDelJoc.value.textEntrat[indexLletra] ===
      paraulaActiva.value.text[indexLletra]
  ) {
    return "correcte";
  }

  if (paraulaActiva.value.letterErrors && paraulaActiva.value.letterErrors[indexLletra]) {
    return "incorrecte";
  }

  return "";
}

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);

  // Iniciar palabras si vienen desde props
  if (props.initialWords.length > 0) {
    estatDelJoc.value.paraules = props.initialWords.map((w, i) => ({
      id: i + 1,
      text: w,
      estat: "pendent",
      errors: 0,
      letterErrors: Array.from({ length: w.length }, () => false),
    }));
  }

  // ---- Escuchar eventos del backend ----

  // Cuando la partida comienza
  comms.on("gameStart", (gamePayload) => {
    const myWords = gamePayload.wordsByPlayer[comms.socket.id] || [];

    estatDelJoc.value.paraules = myWords.map((w, i) => ({
      id: i + 1,
      text: w,
      estat: "pendent",
      errors: 0,
      letterErrors: Array.from({ length: w.length }, () => false),
    }));

    estatDelJoc.value.indexParaulaActiva = 0;
    estatDelJoc.value.textEntrat = "";
  });

  // Actualización de jugadores
  comms.on("updatePlayerList", ({ players }) => {
    players.forEach((p) => {
      const local = estatDelJoc.value.paraules.find((lp) => lp.id === p.id);
      if (local) {
        local.wordsRemaining = p.wordsRemaining;
        local.finished = p.finished;
        local.eliminated = p.eliminated;
      }
    });
  });

  // Fin de juego
  comms.on("gameEnd", ({ ranking }) => {
    JuegoTerminado.value = true;
    alert(
      "Juego terminado! Ranking:\n" +
        ranking.map((p, i) => `${i + 1}. ${p.name} - ${p.score}`).join("\n")
    );
  });
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  comms.off("gameStart");
  comms.off("updatePlayerList");
  comms.off("gameEnd");
});
</script>

<template>
  <div class="game-engine">
    <div class="paraules-container">
      <div
        v-for="(paraula, index) in estatDelJoc.paraules"
        :key="paraula.id"
        class="paraula"
        :class="{ 'paraula-activa': index === estatDelJoc.indexParaulaActiva }"
      >
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
      :disabled="JuegoTerminado || !paraulaActiva"
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
  </div>
</template>

<style scoped>
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
</style>
