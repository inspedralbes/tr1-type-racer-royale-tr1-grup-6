<script setup>
import { ref, computed } from "vue";
import GameEngine from "./components/GameEngine.vue";
import DarkModeToggle from "./components/DarkModeToggle.vue";
import communicationManager from "./services/communicationManager.js"; // Importem el gestor

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
  communicationManager.connect(nomJugador.value);

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
    <!-- VISTA 1: SALA D'ESPERA -->
    <div v-if="vistaActual === 'salaEspera'" class="vista-container">
      <h1>Type Racer Royale</h1>
      <input
        type="text"
        v-model="nomJugador"
        placeholder="Introdueix el teu nom"
      />
      <button @click="connectarAlServidor">Entra al Lobby</button>
    </div>

    <!-- VISTA 2: LOBBY -->
    <div v-else-if="vistaActual === 'lobby'" class="vista-container">
      <h2>Jugadors Connectats</h2>
      <ul>
        <li v-for="jugador in jugadors" :key="jugador.id">
          {{ jugador.name }} <span v-if="jugador.ready">(ready)</span>
          <span v-if="jugador.id === hostId"> — host</span>
        </li>
      </ul>

      <div style="margin-top: 10px">
        <button @click="toggleReady">
          {{ isReady ? "Unready" : "Ready" }}
        </button>

        <!-- Start visible only to host; server will check que todos estén ready -->
        <button
          v-if="isHost"
          @click="startGameByHost"
          :disabled="!allReady || jugadors.length < 2"
          style="margin-left: 8px"
        >
          Start (host)
        </button>
      </div>
    </div>

    <!-- VISTA 3: JOC -->
    <div v-else-if="vistaActual === 'joc'" class="vista-container">
      <GameEngine
        :initialWords="playerWords"
        :intervalMs="gameIntervalMs"
        :maxStack="gameMaxStack"
        :players="jugadors"
      />
    </div>
  </main>
</template>
