<script setup>
import { ref, computed, onMounted, watch } from "vue";
import GameEngine from "./components/GameEngine.vue";
import GameEngineMuerteSubita from "./components/GameEngineMuerteSubita.vue";
import DarkModeToggle from "./components/DarkModeToggle.vue";
import RoomSelector from "./components/RoomSelector.vue";
import communicationManager from "./services/communicationManager.js";
import { useSounds } from "@/composables/useSounds";

const { playSound, setVolume, playMenuMusic, playGameMusic, stopAllMusic } =
  useSounds();
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
const modoJuego = ref("normal");
const currentRoom = ref(null);
const colorsDisponibles = ref([
  "#20ff20",
  "#a0ffa0",
  "#F0A000",
  "#E53935",
  "#1E88E5",
  "#D81B60",
  "#8E24AA",
  "#FB8C00",
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

watch(vistaActual, (newVista, oldVista) => {
  if (newVista === "joc") {
    playGameMusic();
  } else if (
    newVista === "lobby" ||
    newVista === "rooms" ||
    newVista === "salaEspera"
  ) {
    playMenuMusic();
  }
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

function volverInicio() {
  localStorage.removeItem("typeRacerUser");
  communicationManager.disconnect();
  nomJugador.value = "";
  isReady.value = false;
  vistaActual.value = "salaEspera";
  playersPayload.value = { players: [], hostId: null };
  socketId.value = null;
  playerWords.value = [];
  gameIntervalMs.value = 3000;
  gameMaxStack.value = 5;
  stopAllMusic();
}

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

    nomJugador.value = "";
    isReady.value = false;
    communicationManager.disconnect();
    vistaActual.value = "salaEspera";
  } else if (nomJugador.value) {
    connectarAlServidor();
    communicationManager.setReady(isReady.value);
  }

  if (justStarted) {
    sessionStorage.removeItem("justStartedGame");
  }
});

function connectarAlServidor() {
  if (nomJugador.value.trim() === "") {
    alert("Si us plau, introdueix un nom vàlid.");
    return;
  }
  setVolume(0.5);

  playMenuMusic();

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
    // If the server sends the room mode, update local modoJuego for non-hosts
    if (payload && payload.modo) {
      // Only overwrite local modo if you're not the host (host controls it)
      if (!isHost.value) {
        modoJuego.value = payload.modo;
      }
    }
  });
  // Listen explicitly to mode change events
  communicationManager.onRoomModeUpdated((data) => {
    if (data && data.modo) {
      modoJuego.value = data.modo;
    }
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

  communicationManager.connect({
    name: nomJugador.value,
    color: colorJugador.value,
  });
  if (vistaActual.value === "salaEspera") {
    vistaActual.value = "rooms";
  }
}

function toggleReady() {
  isReady.value = !isReady.value;
  communicationManager.setReady(isReady.value);
}
function startGameByHost() {
  communicationManager.requestStart(modoJuego.value);
}

// When the host changes the selected mode in the lobby, notify server
watch(modoJuego, (newModo, oldModo) => {
  if (!newModo || newModo === oldModo) return;
  if (isHost.value && playersPayload.value && playersPayload.value.hostId) {
    communicationManager.setRoomMode(newModo);
  }
});

function onRoomJoined(room) {
  currentRoom.value = room;
  vistaActual.value = "lobby";
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
        placeholder="Introdueix el teu nom (Refugiat)"
        @input="saveStateToLocalStorage"
      />
      <div class="color-picker-container">
        <label>Tria el teu color (Pip-Boy):</label>
        <div class="color-picker">
          <span
            v-for="color in colorsDisponibles"
            :key="color"
            class="color-swatch"
            :class="{ selected: color === colorJugador }"
            :style="{
              backgroundColor: color,
              filter:
                color === colorJugador
                  ? `brightness(1.5) drop-shadow(0 0 5px ${color})`
                  : 'none',
            }"
            @click="colorJugador = color"
          ></span>
        </div>
      </div>
      <button @click="connectarAlServidor">Entra al Refugi</button>
    </div>

    <div v-else-if="vistaActual === 'rooms'" class="vista-container-lobby">
      <RoomSelector @joined="onRoomJoined" />
    </div>

    <div v-else-if="vistaActual === 'lobby'" class="vista-container-lobby">
      <h2>Refugiats Connectats</h2>
      <div class="lobby-header" v-if="!isHost">
        <div class="game-mode-display">
          Mode actual:
          <span
            class="mode-badge"
            :class="{ 'muerte-subita': modoJuego === 'muerteSubita' }"
          >
            {{ modoJuego === "muerteSubita" ? "Muerte Súbita" : "Normal" }}
          </span>
        </div>
      </div>
      <ul>
        <li v-for="jugador in jugadors" :key="jugador.id">
          <span
            class="color-dot"
            :style="{
              backgroundColor: jugador.color,
              filter: `brightness(1.5) drop-shadow(0 0 5px ${jugador.color})`,
            }"
            aria-hidden="true"
          ></span>
          {{ jugador.name }}
          <span v-if="jugador.ready" class="ready-status">[PREPARAT]</span>
          <span v-if="jugador.id === hostId" class="host-status">
            — [Supervisor]
          </span>
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
        <button @click="volverInicio">Tornar a l'Inici</button>
        <div v-if="isHost && vistaActual === 'lobby'" class="modo-selector">
          <h3>Selecciona el modo de juego</h3>
          <div class="modo-buttons">
            <label class="modo-btn" :class="{ active: modoJuego === 'normal' }">
              <input type="radio" value="normal" v-model="modoJuego" />
              <span>Normal</span>
            </label>

            <label
              class="modo-btn muerte"
              :class="{ active: modoJuego === 'muerteSubita' }"
            >
              <input type="radio" value="muerteSubita" v-model="modoJuego" />
              <span>Muerte Súbita</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="vistaActual === 'joc'" class="vista-container-joc">
      <component
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
  max-width: 600px;
  margin: 70px auto;
  padding: 20px;
  border: 1px solid var(--color-border, #ccc);
  background: var(--color-background-soft);
  border-radius: 8px;
  text-align: center;
  align-items: center;
}
.vista-container-lobby {
  max-width: 700px; /* Ancho aumentado */
  margin: 100px auto;
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
  font-family: var(--font-main);
  font-size: 1.5rem;
  text-shadow: 0 0 5px var(--color-heading);

  width: auto;
}

.vista-container button {
  width: 100%;
}

.lobby-actions {
  display: flex;
  gap: 16px;
  margin-top: 20px;
  flex-wrap: wrap;
}

.lobby-actions button {
  flex-grow: 1;
  flex-basis: 200px;
  margin-left: 0;
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

.color-dot {
  display: inline-block;
  width: 14px; /* Ancho del punto */
  height: 14px; /* Alto del punto */
  border-radius: 50%; /* Lo hace redondo */
  margin-right: 10px; /* Espacio a la derecha */
  vertical-align: middle; /* Se alinea con el texto */
  border: 1px solid rgba(0, 0, 0, 0.2); /* Borde sutil */
}

button.ready {
  background-color: #28a745;
}
button.btn-host {
  background-color: var(--color-success, #28a745);
}
.host-status {
  color: var(--color-text-muted);
  margin-left: 8px;
}

.lobby-header {
  margin-bottom: 20px;
  text-align: center;
}

.game-mode-display {
  font-size: 1.2rem;
  margin: 10px 0;
}

.mode-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  background: linear-gradient(120deg, #007bff, #00d4ff);
  color: white;
  font-weight: 600;
  margin-left: 8px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.mode-badge.muerte-subita {
  background: linear-gradient(120deg, #ff3b3b, #ff7e7e);
}

.modo-selector {
  margin-top: 20px;
  text-align: center;
  width: 100%;
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

.modo-btn.muerte::before {
  background: linear-gradient(120deg, #ff3b3b, #ff7e7e);
}
.modo-btn.muerte.active {
  color: white;
}

.modo-btn:active {
  transform: scale(0.98);
}
</style>
