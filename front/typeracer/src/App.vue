<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import GameEngine from './components/GameEngine.vue';
import GameEngineMuerteSubita from './components/GameEngineMuerteSubita.vue';
import DarkModeToggle from './components/DarkModeToggle.vue';
import GameCountdown from './components/GameCountdown.vue';
import RoomSelector from './components/RoomSelector.vue';
import communicationManager from './services/communicationManager.js';
import { useSounds } from '@/composables/useSounds';
import GameEngineContrarellotge from './components/GameEngineContrarellotge.vue';
import DrAtomic from './components/DrAtomic.vue';
import LabBackground from './components/LabBackground.vue';

const { playSound, setVolume, playMenuMusic, playGameMusic, stopAllMusic } =
  useSounds();
// Control de vista
const vistaActual = ref('salaEspera');

// Estado de conexión
const tempsContrarellotge = ref(30);
const timeLeftGlobal = ref(30000); // 30s per defecte
const nomJugador = ref('');
const playersPayload = ref({ players: [], hostId: null, spectators: [] });
const socketId = ref(null);
const isReady = ref(false);
const isSpectator = ref(false);
const spectatorTargetId = ref(null);
const playerWords = ref([]);
const gameIntervalMs = ref(3000);
const gameMaxStack = ref(20); // Valor por defecto aumentado de 5 a 20
const modoJuego = ref('normal');
const currentRoom = ref(null);
const colorsDisponibles = ref([
  '#20ff20',
  '#a0ffa0',
  '#F0A000',
  '#E53935',
  '#1E88E5',
  '#D81B60',
  '#8E24AA',
  '#FB8C00',
]);
const colorJugador = ref(colorsDisponibles.value[0]);
const jugadors = computed(() => playersPayload.value.players || []);
const espectadors = computed(() => playersPayload.value.spectators || []);
const hostId = computed(() => playersPayload.value.hostId || null);
const isHost = computed(
  () => socketId.value && hostId.value === socketId.value,
);
const allReady = computed(() => {
  const p = playersPayload.value.players || [];
  return p.length > 0 && p.every((x) => x.ready === true);
});

watch(vistaActual, (newVista, oldVista) => {
  if (newVista === 'joc') {
    playGameMusic();
  } else if (
    newVista === 'lobby' ||
    newVista === 'rooms' ||
    newVista === 'salaEspera' ||
    newVista === 'preparados'
  ) {
    playMenuMusic();
  }
});

function saveStateToLocalStorage() {
  localStorage.setItem(
    'typeRacerUser',
    JSON.stringify({
      nomJugador: nomJugador.value,
      vistaActual: vistaActual.value,
      isReady: isReady.value,
    }),
  );
}
function loadStateFromLocalStorage() {
  const saved = localStorage.getItem('typeRacerUser');
  if (saved) {
    const data = JSON.parse(saved);
    if (data.nomJugador) nomJugador.value = data.nomJugador;
    if (data.vistaActual) vistaActual.value = data.vistaActual;
    if (typeof data.isReady === 'boolean') isReady.value = data.isReady;
  }
}

function volverInicio() {
  isReady.value = false;
  // If we were spectating, inform server we leave the room so the server
  // doesn't keep us listed as a spectator after returning to the rooms view.
  try {
    if (isSpectator.value || spectatorTargetId.value) {
      communicationManager.leaveRoom();
    }
  } catch (e) {
    // ignore errors if socket not connected
  }

  isSpectator.value = false;
  spectatorTargetId.value = null;
  // Navegar al selector de salas
  vistaActual.value = 'rooms';
  // Reset estado de jugadores locales y palabras de la partida
  playersPayload.value = { players: [], hostId: null, spectators: [] };
  playerWords.value = [];
  gameIntervalMs.value = 3000;
  gameMaxStack.value = 20;
  try {
    communicationManager.leaveRoom();
    communicationManager.setReady(false);
  } catch (e) {}
  stopAllMusic();
}

onMounted(() => {
  loadStateFromLocalStorage();
  const entries = performance.getEntriesByType('navigation');
  const justStarted = sessionStorage.getItem('justStartedGame') === 'true';

  if (
    entries.length > 0 &&
    entries[0].type === 'reload' &&
    vistaActual.value === 'joc' &&
    !justStarted
  ) {
    volverInicio();
  } else if (nomJugador.value) {
    connectarAlServidor();
    communicationManager.setReady(isReady.value);
  }

  if (justStarted) {
    sessionStorage.removeItem('justStartedGame');
  }
});

function connectarAlServidor() {
  if (nomJugador.value.trim() === '') {
    alert('Si us plau, introdueix un nom vàlid.');
    return;
  }
  setVolume(0.5);
  playMenuMusic();

  communicationManager.onEvent('timeLeftUpdate', (data) => {
    if (data && typeof data.timeLeft === 'number') {
      timeLeftGlobal.value = data.timeLeft;
    }
  });

  communicationManager.onConnect((id) => {
    socketId.value = id;
  });
  communicationManager.onEvent('notEnoughPlayers', (data) => {
    alert(
      data.message || 'Es requereix almenys 2 jugadors per iniciar la partida.',
    );
  });

  communicationManager.onUpdatePlayerList((payload) => {
    playersPayload.value = payload;
    if (payload && payload.modo) {
      if (!isHost.value) {
        modoJuego.value = payload.modo;
      }
    }
  });

  communicationManager.onRoomModeUpdated((data) => {
    if (data && data.modo) {
      modoJuego.value = data.modo;
    }
  });

  communicationManager.onGameStart((payload) => {
    if (payload.gameWords) {
      playerWords.value = payload.gameWords;
      gameIntervalMs.value = payload.intervalMs || payload.interval || 3000;
      gameMaxStack.value = payload.maxStack || 20; // Actualizado aquí
      modoJuego.value = payload.modo || 'normal';
    } else {
      console.error("No s'han rebut les paraules del servidor!");
      playerWords.value = [];
    }
    sessionStorage.setItem('justStartedGame', 'true');
    vistaActual.value = 'preparados';
  });

  communicationManager.onJoinedRoom((data) => {
    if (data.success && data.roomId) {
      currentRoom.value = data.roomId;
      isSpectator.value = false;
      console.log('Establecida sala actual (jugador):', currentRoom.value);
      onRoomJoined(data.roomId);
    } else if (data.error) {
      alert(data.error);
    }
  });

  communicationManager.onSpectateSuccess((data) => {
    if (data.success) {
      isSpectator.value = true;

      if (data.gameState?.started) {
        playerWords.value = data.gameState.gameWords;
        gameIntervalMs.value = data.gameState.intervalMs;
        gameMaxStack.value = data.gameState.maxStack;
        modoJuego.value = data.gameState.modo;
        spectatorTargetId.value = data.gameState.hostId;
        vistaActual.value = 'joc';
      } else {
        spectatorTargetId.value = data.gameState.hostId;
        onRoomJoined(data.roomId);
      }
    }
  });

  communicationManager.connect({
    name: nomJugador.value,
    color: colorJugador.value,
  });
  if (vistaActual.value === 'salaEspera') {
    vistaActual.value = 'rooms';
  }
}

function toggleReady() {
  isReady.value = !isReady.value;
  communicationManager.setReady(isReady.value);
}
function startGameByHost() {
  if (modoJuego.value === 'contrarellotge') {
    communicationManager.requestStart('contrarellotge', { duration: 30 });
  } else {
    communicationManager.requestStart(modoJuego.value);
  }
}

function onCountdownComplete() {
  vistaActual.value = 'joc';
}

watch(modoJuego, (newModo, oldModo) => {
  if (!newModo || newModo === oldModo) return;
  if (isHost.value && playersPayload.value && playersPayload.value.hostId) {
    communicationManager.setRoomMode(newModo);
  }
});

function onRoomJoined(room) {
  currentRoom.value = room;
  vistaActual.value = 'lobby';
}

function kickPlayer(playerId) {
  if (!currentRoom.value) return;
  if (confirm('Estàs segur que vols expulsar aquest jugador?')) {
    communicationManager.kickUser(currentRoom.value, playerId);
  }
}
function transferHost(newHostId) {
  if (!currentRoom.value) return;
  if (confirm('Estàs segur que vols transferir el rol de supervisor?')) {
    communicationManager.transferHost(currentRoom.value, newHostId);
  }
}
communicationManager.onHostTransferred(({ newHostId }) => {
  playersPayload.value.hostId = newHostId;
  if (newHostId === socketId.value) {
    alert('Ahora eres el nuevo supervisor de la sala');
  } else {
    alert('El rol de supervisor ha sido transferido a otro jugador.');
  }
});
communicationManager.onkicked(() => {
  alert('Has sido expulsado de la sala.');
  volverInicio();
});
</script>

<template>
  <LabBackground />
  <main>
    <DarkModeToggle />

    <DrAtomic v-if="vistaActual === 'salaEspera'" />

    <div v-if="vistaActual === 'salaEspera'" class="vista-container">
      <h1>Atomic Syntax</h1>
      <input
        type="text"
        v-model="nomJugador"
        placeholder="Introdueix el teu nom (Cientific)"
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
      <button @click="connectarAlServidor">Entra al laboratori</button>
    </div>

    <div v-else-if="vistaActual === 'rooms'" class="vista-container-lobby">
      <RoomSelector />
    </div>

    <div v-else-if="vistaActual === 'lobby'" class="vista-container-lobby">
      <h2>CIENTÍFICS CONNECTATS</h2>
      <div class="lobby-header" v-if="!isHost">
        <div class="game-mode-display">
          Mode actual:
          <span
            class="mode-badge"
            :class="{
              'muerte-subita': modoJuego === 'muerteSubita',
              contrarellotge: modoJuego === 'contrarellotge',
            }"
          >
            {{
              modoJuego === 'muerteSubita'
                ? 'Mort Súbita'
                : modoJuego === 'contrarellotge'
                ? 'Contrarellotge'
                : 'Normal'
            }}
          </span>
          <span
            class="mode-help"
            :class="{
              muerte: modoJuego === 'muerteSubita',
              contrarellotge: modoJuego === 'contrarellotge',
            }"
          >
            <span class="mode-help-icon">i</span>
            <span class="mode-help-tooltip">
              {{
                modoJuego === 'muerteSubita'
                  ? 'Si comets tres errors quedes eliminat.'
                  : modoJuego === 'contrarellotge'
                  ? "Fes tantes paraules com puguis abans que s'acabi el temps!"
                  : 'Completa paraules; acumula 20 per quedar eliminat.'
              }}
            </span>
          </span>
        </div>
      </div>
      <ul class="player-list-lobby">
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
          <template v-if="isHost && jugador.id !== socketId">
            <button @click="kickPlayer(jugador.id)" class="btn-kick">
              Elimninar
            </button>
            <button @click="transferHost(jugador.id)" class="btn-transfer">
              Transferir Supervisor
            </button>
          </template>
        </li>
      </ul>

      <div v-if="espectadors.length > 0" class="spectator-list">
        <h3>Espectadors (Mirones)</h3>
        <ul>
          <li v-for="espectador in espectadors" :key="espectador.id">
            <span
              class="color-dot"
              :style="{ backgroundColor: espectador.color, opacity: 0.6 }"
              aria-hidden="true"
            ></span>
            {{ espectador.name }}
          </li>
        </ul>
      </div>

      <div class="lobby-actions">
        <button v-if="!isSpectator" @click="toggleReady">
          {{ isReady ? '[CANCEL·LAR]' : '[PREPARAT]' }}
        </button>
        <button
          v-if="isHost"
          @click="startGameByHost"
          :disabled="!allReady || jugadors.length < 2"
          class="btn-host"
        >
          [INICIAR] (Supervisor)
        </button>
        <button @click="volverInicio">Tornar al laboratori</button>
        <div v-if="isHost && vistaActual === 'lobby'" class="modo-selector">
          <h3>Selecciona el mode de joc</h3>
          <div class="modo-buttons">
            <label class="modo-btn" :class="{ active: modoJuego === 'normal' }">
              <input type="radio" value="normal" v-model="modoJuego" />
              <span>Normal</span>
              <span class="tooltip"
                >Quedaràs eliminat si s'acumulen 20 paraules.</span
              >
            </label>

            <label
              class="modo-btn muerte"
              :class="{ active: modoJuego === 'muerteSubita' }"
            >
              <input type="radio" value="muerteSubita" v-model="modoJuego" />
              <span>Mort Súbita</span>
              <span class="tooltip"
                >Tens 3 vides — al 3n error quedes eliminat.</span
              >
            </label>
            <label
              class="modo-btn contrarellotge"
              :class="{ active: modoJuego === 'contrarellotge' }"
            >
              <input type="radio" value="contrarellotge" v-model="modoJuego" />
              <span>Contrarellotge</span>
              <span class="tooltip">
                Tens un temps límit per fer tantes paraules com puguis. Guanya
                qui n'escriu més!
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="vistaActual === 'preparados'"
      class="vista-container-preparados"
    >
      <GameCountdown
        :modo="modoJuego"
        @countdownComplete="onCountdownComplete"
      />
    </div>

    <div v-else-if="vistaActual === 'joc'" class="vista-container-joc">
      <component
        :is="
          modoJuego === 'muerteSubita'
            ? GameEngineMuerteSubita
            : modoJuego === 'contrarellotge'
            ? GameEngineContrarellotge
            : GameEngine
        "
        :initialWords="playerWords"
        :intervalMs="gameIntervalMs"
        :maxStack="gameMaxStack"
        :players="jugadors"
        @volverInicio="volverInicio"
        :modo="modoJuego"
        :isSpectator="isSpectator"
        :spectatorTargetId="spectatorTargetId"
        @switch-spectator-target="spectatorTargetId = $event"
        :timeLeft="modoJuego === 'contrarellotge' ? timeLeftGlobal : undefined"
      />
    </div>
  </main>
</template>

<style scoped>
/* ... (TOTS ELS TEUS ESTILS ES QUEDEN EXACTAMENT IGUAL) ... */
.modo-btn .tooltip {
  position: absolute;
  bottom: 125%;
  left: 50%;
  transform: translateX(-50%) translateY(6px) scale(0.98);
  opacity: 0;
  visibility: hidden;
  background: linear-gradient(
    180deg,
    rgba(20, 20, 20, 0.95),
    rgba(40, 40, 40, 0.95)
  );
  color: #fff;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 0.95rem;
  line-height: 1.2;
  transition: opacity 180ms ease, transform 180ms ease,
    visibility 0s linear 180ms;
  z-index: 1200; /* definitely above everything */
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32);
  pointer-events: none; /* don't block hover */
  min-width: 180px;
  text-align: center;
  z-index: 9999;
}

.modo-btn:hover .tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0) scale(1);
  transition-delay: 40ms;
}

/* little arrow under the tooltip */
.modo-btn .tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 7px;
  border-style: solid;
  border-color: rgba(40, 40, 40, 0.95) transparent transparent transparent;
  z-index: 1201;
}

.modo-btn.contrarellotge .tooltip {
  background: linear-gradient(120deg, #4b016d, #7161ff);
}
.modo-btn.contrarellotge .tooltip::after {
  border-color: #7161ff transparent transparent transparent;
}

/* special color for Muerte Súbita tooltip to match danger style */
.modo-btn.muerte .tooltip {
  background: linear-gradient(
    180deg,
    rgba(200, 40, 40, 0.98),
    rgba(220, 70, 70, 0.98)
  );
  color: #fff;
}

.modo-btn.muerte .tooltip::after {
  border-color: rgba(220, 70, 70, 0.98) transparent transparent transparent;
}

/* non-host mode help icon + tooltip */
.mode-help {
  display: inline-block;
  position: relative;
  margin-left: 10px;
  cursor: pointer;
}
.mode-help-icon {
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(180deg, #ffffff, #f0f0f0);
  color: #222;
  font-weight: 700;
  font-size: 0.9rem;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}
.mode-help-tooltip {
  position: absolute;
  bottom: 125%;
  left: 50%;
  transform: translateX(-50%) translateY(6px) scale(0.98);
  opacity: 0;
  visibility: hidden;
  background: linear-gradient(
    180deg,
    rgba(20, 20, 20, 0.95),
    rgba(40, 40, 40, 0.95)
  );
  color: #fff;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
  line-height: 1.2;
  transition: opacity 160ms ease, transform 160ms ease;
  z-index: 1200;
  white-space: nowrap;
  pointer-events: none;
}
.mode-help:hover .mode-help-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0) scale(1);
}
.mode-help .mode-help-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 6px;
  border-style: solid;
  border-color: rgba(40, 40, 40, 0.95) transparent transparent transparent;
}
.mode-help.muerte .mode-help-tooltip {
  background: linear-gradient(
    180deg,
    rgba(200, 40, 40, 0.98),
    rgba(220, 70, 70, 0.98)
  );
}
.mode-help.muerte .mode-help-tooltip::after {
  border-color: rgba(220, 70, 70, 0.98) transparent transparent transparent;
}
.spectator-list {
  margin-top: 20px;
  border-top: 1px dashed var(--color-border);
  padding-top: 15px;
}
.spectator-list h3 {
  font-size: 1.2rem;
  color: var(--color-text-muted);
  margin-bottom: 10px;
}
.spectator-list ul {
  opacity: 0.7;
}
.app {
  max-width: 1200px;
  margin: 20px auto;
  padding: 18px;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI',
    Roboto, 'Helvetica Neue', Arial;
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
  max-width: 700px;
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
.vista-container-preparados {
  width: 100%;
  height: 100vh;
  padding: 0;
  margin: 0;
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
input[type='text'] {
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
  padding: 0.4rem;
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
  width: 14px;
  height: 14px;
  border-radius: 50%;
  margin-right: 10px;
  vertical-align: middle;
  border: 1px solid rgba(0, 0, 0, 0.2);
}
button.ready {
  background-color: #28a745;
}
button.btn-host {
  background-color: var(--color-success, #28a745);
}

.btn-kick {
  margin-top: 10px;
  background-color: var(--color-danger, #dc3545);
  margin-left: 10px;
  padding: 4px 10px;
  font-size: 18px;
  color: white;
}
.btn-kick:hover {
  background-color: #b71c1c;
}

.btn-transfer {
  padding: 4px 10px;
  font-size: 18px;
  background-color: var(--color-warning, #ffc107);
  margin-left: 10px;
  color: black;
}
.btn-transfer:hover {
  background-color: #e0a800;
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
  overflow: visible;
  z-index: 1;
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
  content: '';
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

.modo-btn.contrarellotge::before {
  background: linear-gradient(120deg, #4b016d, #7161ff);
}

.modo-btn.contrarellotge.active {
  color: white;
  transform: scale(1.05);
}

.mode-badge.contrarellotge {
  background: linear-gradient(120deg, #4b016d, #7161ff);
  color: white;
  font-weight: 700;
}

.mode-help.contrarellotge .mode-help-tooltip {
  background: linear-gradient(120deg, #4b016d, #7161ff) !important;
  color: #fff;
}

.mode-help.contrarellotge .mode-help-tooltip::after {
  border-color: #7161ff transparent transparent transparent !important;
}
</style>
