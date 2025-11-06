<script setup>
import { ref, computed, onMounted, watch } from "vue";
import GameEngine from "./components/GameEngine.vue";
import GameEngineMuerteSubita from "./components/GameEngineMuerteSubita.vue";
import DarkModeToggle from "./components/DarkModeToggle.vue";
import RoomSelector from "./components/RoomSelector.vue";
import communicationManager from "./services/communicationManager.js"; // Importem el gestor

// Control de vista
const vistaActual = ref("salaEspera");

// Estado de conexión
const nomJugador = ref("");
const playersPayload = ref({ players: [], hostId: null });
const socketId = ref(null);
const isReady = ref(false);
const playerWords = ref([]);
const gameIntervalMs = ref(3000);
const gameMaxStack = ref(5);
const modoJuego = ref("normal");
const currentRoom = ref(null);

const jugadors = computed(() => playersPayload.value.players || []);
const hostId = computed(() => playersPayload.value.hostId || null);
const isHost = computed(
  () => socketId.value && hostId.value === socketId.value
);
const allReady = computed(() => {
  const p = playersPayload.value.players || [];
  return p.length > 0 && p.every((x) => x.ready === true);
});

function saveStateToLocalStorage() {
  localStorage.setItem(
    "typeRacerUser",
    JSON.stringify({
      nomJugador: nomJugador.value,
      vistaActual: vistaActual.value,
      isReady: isReady.value,
    })
  );
}
// Al cargar, solo actualiza esas refs locales
function loadStateFromLocalStorage() {
  const saved = localStorage.getItem("typeRacerUser");
  if (saved) {
    const data = JSON.parse(saved);
    if (data.nomJugador) nomJugador.value = data.nomJugador;
    if (data.vistaActual) vistaActual.value = data.vistaActual;
    if (typeof data.isReady === "boolean") isReady.value = data.isReady;
  }
}
// Nunca guardes ni restaures playersPayload de localStorage

function volverInicio() {
  localStorage.removeItem("typeRacerUser");
  communicationManager.disconnect();
  // Reestablece todos los estados importantes
  nomJugador.value = "";
  isReady.value = false;
  vistaActual.value = "salaEspera";
  playersPayload.value = { players: [], hostId: null };
  socketId.value = null;
  playerWords.value = [];
  gameIntervalMs.value = 3000;
  gameMaxStack.value = 5;
}

// <<< IMPORTANTE >>>
// Esta lógica permite reconectar sin cambiar la vista si ya estás en partida
onMounted(() => {
  loadStateFromLocalStorage();
  const entries = performance.getEntriesByType("navigation");
  const justStarted = sessionStorage.getItem("justStartedGame") === "true";

  if (
    entries.length > 0 &&
    entries[0].type === "reload" &&
    vistaActual.value === "joc" &&
    !justStarted
  ) {
    localStorage.removeItem("typeRacerUser");

    // Cambia el estado inmediatamente
    vistaActual.value = "salaEspera";
    nomJugador.value = "";
    isReady.value = false;
    communicationManager.disconnect();
  } else if (nomJugador.value) {
    connectarAlServidor();
    communicationManager.setReady(isReady.value);
  }

  if (justStarted) {
    sessionStorage.removeItem("justStartedGame");
  }
});

watch([nomJugador, vistaActual, isReady], () => {
  saveStateToLocalStorage();
});

// Modificado para NO forzar vista "lobby" si ya estás en "joc"
function connectarAlServidor() {
  if (nomJugador.value.trim() === "") {
    alert("Si us plau, introdueix un nom vàlid.");
    return;
  }

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
      modoJuego.value = payload.modo || "normal";
    } else {
      playerWords.value = [];
      modoJuego.value = payload.modo || "normal";
    }
    sessionStorage.setItem("justStartedGame", "true");
    vistaActual.value = "joc";
  });

  communicationManager.connect(nomJugador.value);

  // Canvia la vista al lobby
  vistaActual.value = "rooms";
}

function onRoomJoined(payload) {
  // payload may contain roomId and roomName
  currentRoom.value = payload?.roomId || payload?.id || null;
  // after joining a room, navigate to lobby where player list will be shown
  vistaActual.value = "lobby";
}

function toggleReady() {
  isReady.value = !isReady.value;
  communicationManager.setReady(isReady.value);
}
function startGameByHost() {
  // Sólo el host puede solicitar el inicio; el servidor validará que todos estén ready
  communicationManager.requestStart(modoJuego.value);
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
        @input="saveStateToLocalStorage"
      />
      <button @click="connectarAlServidor">Entra al Lobby</button>
    </div>

    <!-- VISTA 2: ROOMS -->
    <div v-else-if="vistaActual === 'rooms'" class="vista-container-lobby">
      <RoomSelector @joined="onRoomJoined" />
    </div>

    <!-- VISTA 3: LOBBY -->

    <div v-else-if="vistaActual === 'lobby'" class="vista-container-lobby">
      <h2>Jugadors Connectats</h2>
      <ul>
        <li v-for="jugador in jugadors" :key="jugador.id">
          {{ jugador.name }}
          <span v-if="jugador.ready">(ready)</span>
          <span v-if="jugador.id === hostId"> — host</span>
        </li>
      </ul>
      <div style="margin-top: 10px">
        <button @click="toggleReady" :class="{ ready: isReady }">
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
        <button @click="volverInicio" style="margin-left: 8px"></button>
        <div v-if="isHost && vistaActual === 'lobby'" class="modo-selector">
          <h3>Selecciona el modo de juego</h3>
          <div class="modo-buttons">
            <label class="modo-btn" :class="{ active: modoJuego === 'normal' }">
              <input type="radio" value="normal" v-model="modoJuego" />
              <span>🎯 Normal</span>
            </label>

            <label
              class="modo-btn muerte"
              :class="{ active: modoJuego === 'muerteSubita' }"
            >
              <input type="radio" value="muerteSubita" v-model="modoJuego" />
              <span>💀 Muerte Súbita</span>
            </label>
          </div>
        </div>

      </div>
    </div>

    <!-- VISTA 3: JOC -->
    <div v-else-if="vistaActual === 'joc'" class="vista-container-joc">
      <GameEngine
        :is="modoJuego === 'muerteSubita' ? GameEngineMuerteSubita : GameEngine"
        :initialWords="playerWords"
        :intervalMs="gameIntervalMs"
        :maxStack="gameMaxStack"
        :players="jugadors"
        @volverInicio="volverInicio"
        :modo="modoJuego"
      />
    </div>
  </main>
</template>
<style scoped>
.app {
  max-width: 1200px;
  margin: 20px auto;
  padding: 18px;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI",
    Roboto, "Helvetica Neue", Arial;
}
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
  display: flex;
  justify-content: center;
}

/* Reduce default margins inside the centered containers so they don't add extra offset */
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
button.ready {
  background-color: #28a745; /* Verde para estado ready */
}
button.btn-host {
  background-color: var(--color-success, #28a745);
  margin-left: 8px;
}
/* Modo selector styles */
.modo-selector {
  margin-top: 20px;
  text-align: center;
}

.modo-selector h3 {
  font-size: 1.2rem;
  margin-bottom: 12px;
  color: var(--color-heading, #333);
}

.modo-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.modo-btn {
  position: relative;
  padding: 12px 24px;
  border-radius: 12px;
  border: 2px solid transparent;
  background: linear-gradient(145deg, #e3e3e3, #f9f9f9);
  color: #333;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;
}

.modo-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
}

.modo-btn input {
  display: none;
}

.modo-btn span {
  position: relative;
  z-index: 2;
}

.modo-btn::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, #007bff, #00d4ff);
  opacity: 0;
  transition: opacity 0.3s ease;
  border-radius: 12px;
  z-index: 1;
}

.modo-btn.active::before {
  opacity: 1;
}

.modo-btn.active {
  color: white;
  transform: scale(1.05);
}

/* Colores específicos para muerte súbita */
.modo-btn.muerte::before {
  background: linear-gradient(120deg, #ff3b3b, #ff7e7e);
}
.modo-btn.muerte.active {
  color: white;
}

/* Animación sutil al hacer hover */
.modo-btn:active {
  transform: scale(0.98);
}
</style>
