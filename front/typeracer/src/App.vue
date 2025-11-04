<script setup>
import { ref, computed } from "vue";
import GameEngine from "./components/GameEngine.vue";
import DarkModeToggle from "./components/DarkModeToggle.vue";
import communicationManager from "./services/communicationManager.js"; // Importem el gestor
import { useSounds } from '@/composables/useSounds'; // SONIDO: 1. Importar el gestor

// SONIDO: 2. Inicializar el gestor
const { playSound, setVolume } = useSounds();

// Control de vista
const vistaActual = ref("salaEspera"); // 'salaEspera', 'lobby', 'joc'

// Estado de conexión
const nomJugador = ref("");
const playersPayload = ref({ players: [], hostId: null });
const socketId = ref(null);
const isReady = ref(false);
const playerWords = ref([]);
const gameIntervalMs = ref(3000);
const gameMaxStack = ref(5);

const colorsDisponibles = ref([
  '#E53935', '#D81B60', '#8E24AA', '#5E35B1',
  '#3949AB', '#1E88E5', '#039BE5', '#00ACC1',
  '#00897B', '#43A047', '#7CB342', '#FDD835',
  '#FB8C00', '#F4511E', '#6D4C41', '#757575'
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
  
  playSound('newWord');
  setVolume(0.5);

  // Registrar callbacks
  communicationManager.onConnect((id) => {
    socketId.value = id;
  });

  communicationManager.onEvent("notEnoughPlayers", (data) => {
    alert(
      data.message || "Es requereix almenys 2 jugadors per iniciar la partida."
    );
  });

  communicationManager.onUpdatePlayerList((payload) => {
    // payload: { players: [...], hostId }
    playersPayload.value = payload;
  });

  communicationManager.onGameStart((payload) => {
    // payload: { wordsByPlayer: { [id]: [...] }, maxStack, startAt }
    const ownId = socketId.value;
    if (ownId && payload.wordsByPlayer && payload.wordsByPlayer[ownId]) {
      playerWords.value = payload.wordsByPlayer[ownId];
      gameIntervalMs.value = payload.intervalMs || payload.interval || 3000;
      gameMaxStack.value = payload.maxStack || 5;
    } else {
      playerWords.value = [];
    }
    // Cambiar a vista de juego
    vistaActual.value = "joc";
  });

  // Connecta i envia el nom
  communicationManager.connect({
    name: nomJugador.value,
    color: colorJugador.value 
  });

  // Canvia la vista al lobby
  vistaActual.value = "lobby";
}



function toggleReady() {
  isReady.value = !isReady.value;
  communicationManager.setReady(isReady.value);
}

function startGameByHost() {
  // Sólo el host puede solicitar el inicio; el servidor validará que todos estén ready
  communicationManager.requestStart();
}
</script>
<template>
  <main>
    <DarkModeToggle />

    <div v-if="vistaActual === 'salaEspera'" class="vista-container">
      <h1>Type Racer Royale</h1>
      <input
        type="text"
        v-model="nomJugador"
        placeholder="Introdueix el teu nom"
      />
      
      <div class="color-picker-container">
        <label>Tria el teu color:</label>
        <div class="color-picker">
          <span
            v-for="color in colorsDisponibles"
            :key="color"
            class="color-swatch"
            :class="{ 'selected': color === colorJugador }"
            :style="{ backgroundColor: color }"
            @click="colorJugador = color"
          ></span>
        </div>
      </div>
      
      <button @click="connectarAlServidor">Entra al Lobby</button>
    </div>

    <div v-else-if="vistaActual === 'lobby'" class="vista-container-lobby">
      <h2>Jugadors Connectats</h2>
      <ul>
        <li v-for="jugador in jugadors" :key="jugador.id">
          <span class="color-dot" :style="{ backgroundColor: jugador.color }"></span>
          {{ jugador.name }} 
          <span v-if="jugador.ready">(ready)</span>
          <span v-if="jugador.id === hostId"> — host</span>
        </li>
      </ul>
      <div style="margin-top: 10px">
        <button @click="toggleReady">
          {{ isReady ? "Unready" : "Ready" }}
        </button>
        <button
          v-if="isHost"
          @click="startGameByHost"
          :disabled="!allReady || jugadors.length < 2"
          style="margin-left: 8px"
          class="btn-host"
        >
          Start (host)
        </button>
      </div>
    </div>

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
.vista-container {
  max-width: 400px;
  margin: 40px auto;
  padding: 20px;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 8px;
  text-align: center;
  align-items: center;
}
.vista-container-lobby {
  max-width: 600px;
  margin: 40px auto;
  padding: 20px;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 8px;
  text-align: center;
}
.vista-container-joc {
  max-width: 800px;
  margin: 20px auto;
  padding: 20px;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 8px;
  text-align: center;
}

/* Stage wrapper centers entry views on wide screens */
.stage {
  width: 100%;
  /* make the stage take the full viewport so it centers regardless of parent layout */
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

/* Reduce default margins inside the centered containers so they don't add extra offset */
.vista-container,
.vista-container-lobby,
.vista-container-joc {
  margin: 0 auto;
}
input[type="text"] {
  width: 80%;
  padding: 8px;
  margin-bottom: 12px;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 4px;
}
button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: var(--color-primary, #007bff);
  color: white;
  cursor: pointer;
}
button.btn-host {
  background-color: var(--color-success, #28a745);
  margin-left: 8px;
}
.color-picker-container {
  margin: 16px 0;
  text-align: center;
}
.color-picker-container label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}
.color-picker {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  transition: transform 0.1s ease, border-color 0.1s ease;
}
.color-swatch:hover {
  transform: scale(1.1);
}
.color-swatch.selected {
  border-color: var(--color-primary, #007bff);
  transform: scale(1.15);
  box-shadow: 0 0 8px var(--color-primary, #007bff);
}
.color-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 8px;
  border: 1px solid rgba(0,0,0,0.2);
  vertical-align: middle;
}
li { /* Per assegurar que el punt s'alinea bé */
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}
</style>