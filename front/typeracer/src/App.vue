<script setup>
import { ref, computed } from "vue";
import GameEngine from "./components/GameEngine.vue";
import DarkModeToggle from "./components/DarkModeToggle.vue";
import communicationManager from "./services/communicationManager.js";
import { useSounds } from '@/composables/useSounds';

const { playSound, setVolume } = useSounds();
const vistaActual = ref("salaEspera");
const nomJugador = ref("");
const playersPayload = ref({ players: [], hostId: null });
const socketId = ref(null);
const isReady = ref(false);
const playerWords = ref([]);
const gameIntervalMs = ref(3000);
const gameMaxStack = ref(5);

const colorsDisponibles = ref([
  '#20ff20', '#a0ffa0', '#F0A000', '#E53935', 
  '#1E88E5', '#D81B60', '#8E24AA', '#FB8C00'
]);
const colorJugador = ref(colorsDisponibles.value[0]);

const jugadors = computed(() => playersPayload.value.players || []);
const hostId = computed(() => playersPayload.value.hostId || null);
const isHost = computed(
  () => socketId.value && hostId.value === socketId.value
);
const allReady = computed(() => {
  const p = playersPayload.value.players || [];
  return p.length > 0 && p.every((x) => x.ready === true);
});

function connectarAlServidor() {
  if (nomJugador.value.trim() === "") {
    alert("Si us plau, introdueix un nom vàlid.");
    return;
  }
  setVolume(0.5);

  communicationManager.onConnect((id) => {
    socketId.value = id;
  });
  communicationManager.onEvent("notEnoughPlayers", (data) => {
    alert(
      data.message || "Es requereix almenys 2 jugadors per iniciar la partida."
    );
  });
  communicationManager.onUpdatePlayerList((payload) => {
    playersPayload.value = payload;
  });
  communicationManager.onGameStart((payload) => {
    const ownId = socketId.value;
    if (ownId && payload.wordsByPlayer && payload.wordsByPlayer[ownId]) {
      playerWords.value = payload.wordsByPlayer[ownId];
      gameIntervalMs.value = payload.intervalMs || payload.interval || 3000;
      gameMaxStack.value = payload.maxStack || 5;
    } else {
      playerWords.value = [];
    }
    vistaActual.value = "joc";
  });

  communicationManager.connect({
    name: nomJugador.value,
    color: colorJugador.value 
  });
  vistaActual.value = "lobby";
}

function toggleReady() {
  isReady.value = !isReady.value;
  communicationManager.setReady(isReady.value);
}

function startGameByHost() {
  communicationManager.requestStart();
}
</script>

<template>
  <main>
    <DarkModeToggle />

    <!-- VISTA 1: SALA D'ESPERA -->
    <div v-if="vistaActual === 'salaEspera'" class="vista-container">
      <h1>Type Racer Royale</h1>
      <input
        type="text"
        v-model="nomJugador"
        placeholder="Introdueix el teu nom (Refugiat)"
      />
      
      <div class="color-picker-container">
        <label>Tria el teu color (Pip-Boy):</label>
        <div class="color-picker">
          <span
            v-for="color in colorsDisponibles"
            :key="color"
            class="color-swatch"
            :class="{ 'selected': color === colorJugador }"
            :style="{ backgroundColor: color, filter: color === colorJugador ? `brightness(1.5) drop-shadow(0 0 5px ${color})` : 'none' }"
            @click="colorJugador = color"
          ></span>
        </div>
      </div>
      
      <button @click="connectarAlServidor">Entra al Refugi</button>
    </div>

    <!-- VISTA 2: LOBBY -->
    <div v-else-if="vistaActual === 'lobby'" class="vista-container-lobby">
      <h2>Refugiats Connectats</h2>
      <ul>
        <li v-for="jugador in jugadors" :key="jugador.id">
          <span class="color-dot" :style="{ backgroundColor: jugador.color, filter: `brightness(1.5) drop-shadow(0 0 5px ${jugador.color})` }"></span>
          {{ jugador.name }} 
          <span v-if="jugador.ready" class="ready-status">[PREPARAT]</span>
          <span v-if="jugador.id === hostId" class="host-status"> — [Supervisor]</span>
        </li>
      </ul>
      <div class="lobby-actions">
        <button @click="toggleReady">
          {{ isReady ? "[CANCEL·LAR]" : "[PREPARAT]" }}
        </button>
        <button
          v-if="isHost"
          @click="startGameByHost"
          :disabled="!allReady || jugadors.length < 2"
          class="btn-host"
        >
          [INICIAR] (Supervisor)
        </button>
      </div>
    </div>

    <!-- VISTA 3: JOC -->
    <div v-else-if="vistaActual === 'joc'" class="vista-container-joc">
      <GameEngine
        :initialWords="playerWords"
        :intervalMs="gameIntervalMs"
        :maxStack="gameMaxStack"
        :players="jugadors" 
      />
    </div>
  </main>
</template>

<style scoped>

.vista-container,
.vista-container-lobby {
  max-width: 550px;
  margin: 80px auto;
  padding: 24px;
  border: 2px solid var(--color-border);
  background: var(--color-background-soft);
  text-align: center;
  border-radius: 12px;
  box-shadow: 0 0 20px var(--shadow-color), inset 0 0 15px var(--shadow-color);
}

.vista-container-joc {
  max-width: 1200px;
  margin: 20px auto;
  padding: 0;
  border: none;
}

h1 {
  font-size: 3.5rem;
  margin-bottom: 24px;
}

h2 {
  font-size: 2.5rem;
  border-bottom: 2px solid var(--color-border);
  padding-bottom: 10px;
  margin-bottom: 20px;
}

input[type="text"] {
  width: 100%;
  padding: 12px;
  margin-bottom: 16px;
  box-sizing: border-box;
  font-size: 1.8rem;
  text-align: center;
}

button {
  width: 100%;
}

.lobby-actions {
  display: flex;
  gap: 16px;
  margin-top: 20px;
}

.color-picker-container {
  margin: 20px 0;
}
.color-picker-container label {
  display: block;
  margin-bottom: 12px;
  font-weight: 700;
  font-size: 1.5rem;
  color: var(--color-text);
}
.color-picker {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}
.color-swatch {
  width: 35px;
  height: 35px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid var(--color-text-muted);
  transition: all 0.1s ease;
}
.color-swatch:hover {
  transform: scale(1.1);
}
.color-swatch.selected {
  border-color: var(--color-heading);
  transform: scale(1.1);
}

/* Lista de jugadores */
li {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border-bottom: 1px dashed var(--color-border);
  font-size: 1.5rem;
}
.color-dot {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  margin-right: 12px;
  flex-shrink: 0;
  border: 1px solid var(--color-text-muted);
}
.ready-status {
  color: var(--color-success);
  margin-left: auto;
  font-weight: 700;
}
.host-status {
  color: var(--color-text-muted);
  margin-left: 8px;
}
</style>