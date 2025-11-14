<template>
  <div class="room-selector">
    <h2>Cambres d’Assaig</h2>

    <div class="rooms-list">
      <div v-if="rooms.length === 0" class="empty">
        No hi ha Sales d’Experimentació Actives
      </div>
      <ul>
        <li v-for="r in rooms" :key="r.id" class="room-item">
          <div class="room-info">
            <div class="room-name">
              {{ r.name }}
              <span v-if="r.inGame" class="in-game-badge">Fent proves</span>
            </div>
            <div class="room-meta">
              <span>Jugadors: {{ r.count || 0 }}</span>
              <span v-if="r.spectatorCount > 0"
                >Espectadors: {{ r.spectatorCount }}</span
              >
              <span class="mode-info"
                >Mode:
                {{
                  r.modo === 'muerteSubita'
                    ? 'Muerte Súbita'
                    : r.modo === 'contrarellotge'
                    ? 'Contrarellotge'
                    : 'Normal'
                }}</span
              >
            </div>
          </div>
          <div class="room-actions">
            <button
              @click="joinRoom(r.id)"
              :disabled="r.inGame && !r.gameOver"
              :class="{ disabled: r.inGame && !r.gameOver }"
              :title="r.inGame && !r.gameOver ? 'No puedes unirte a una partida en curso' : ''"
            >
              {{ r.inGame && !r.gameOver ? 'Fent proves' : 'Entrar' }}
            </button>

            <button
              v-if="r.inGame"
              @click="spectateRoom(r.id)"
              class="btn-spectate"
              :title="r.gameOver ? 'La partida ha acabat' : 'Entrar como espectador'"
              :disabled="r.gameOver"
            >
              Espiar
            </button>
          </div>
        </li>
      </ul>
    </div>

    <div class="create-room-container">
      <h3>Crear Nova Cambra d'Assaig</h3>
      <div class="create-room-controls">
        <input v-model="newRoomName" placeholder="Introdueix el nom..." />
      </div>
      <div class="create-room-buttons">
        <button @click="createRoom">Crear Cambra</button>
        <button @click="changeNameAndPipBoy">Canviar de Nom i Pip-Boy</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import communicationManager from '../services/communicationManager.js';

const emit = defineEmits(['joined']);

const rooms = ref([]);
const newRoomName = ref('');

let pollTimer = null;

function refreshRooms() {
  communicationManager.listRooms();
}

function createRoom() {
  const name = (newRoomName.value || '').trim();
  if (!name) return;
  communicationManager.createRoom(name);
  newRoomName.value = '';
}

function joinRoom(id) {
  communicationManager.joinRoom(id);
}

function changeNameAndPipBoy() {
  localStorage.clear();
  window.location.reload();
}

// ===================================
// NOVA FUNCIÓ
// ===================================
function spectateRoom(id) {
  communicationManager.spectateRoom(id);
}
// ===================================

function onRoomList(payload) {
  if (Array.isArray(payload)) {
    rooms.value = payload;
  }
}

function onJoined(payload) {
  emit('joined', payload);
}

onMounted(() => {
  communicationManager.onRoomList(onRoomList);
  // NOTA: 'onJoinedRoom' s'escolta ara a App.vue per gestionar la navegació
  // communicationManager.onJoinedRoom(onJoined);

  // ===================================
  // NOU LISTENER D'ERROR
  // ===================================
  communicationManager.onSpectateError((data) => {
    alert(data.message || "No s'ha pogut entrar com a espectador");
  });
  // ===================================

  refreshRooms();
  pollTimer = setInterval(refreshRooms, 4000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<style scoped>
.room-selector {
  width: 100%;
  max-width: 660px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  padding: 18px;
  border-radius: 8px;
  text-align: left;
}
.rooms-list {
  margin-bottom: 12px;
}
.rooms-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.room-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  border-bottom: 1px dashed var(--color-border);
}
.room-name {
  font-weight: 800;
  font-size: 1.5rem;
}
.room-meta {
  font-size: 16px;
  color: var(--color-text);
  opacity: 0.8;
  display: flex;
  gap: 12px;
}

.mode-info {
  padding: 2px 6px;
  border-radius: 4px;
  background-color: var(--color-background);
  border: 1px solid var(--color-border);
}

.create-room-container {
  margin-top: 24px;
  padding: 16px;
  border: 2px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
}

.create-room-container h3 {
  margin: 0 0 12px;
  font-size: 1.5rem;
  color: var(--color-heading);
  text-align: center;
}

.create-room-controls {
  display: flex;
  gap: 12px;
}

.create-room-controls input {
  flex-grow: 1;
  font-family: var(--font-main);
  font-size: 1.5rem;
  padding: 10px 14px;
  background: var(--color-background-soft);
  border: 2px solid var(--color-border);
  color: var(--color-heading);
  border-radius: 6px;
  outline: none;
  transition: all 0.2s ease;
}

.create-room-controls input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 15px var(--shadow-color);
}

.create-room-buttons {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.create-room-buttons button {
  flex: 1; /* This will make them equal width */
  font-size: 1.3rem; /* A medium size for both */
  padding: 12px;
  text-align: center;
}

/* Style the primary button */
.create-room-buttons button:first-child {
  background-color: var(--color-primary);
  color: var(--color-background);
  border-color: var(--color-primary);
}

/* Style the secondary button */
.create-room-buttons button:last-child {
  background-color: var(--color-background-mute);
  color: var(--color-text);
  border-color: var(--color-border);
}
.empty {
  color: var(--color-text);
  opacity: 0.8;
  padding: 8px 0;
}

.in-game-badge {
  display: inline-block;
  font-size: 0.75em;
  padding: 2px 6px;
  margin-bottom: 6px;
  margin-left: 6px;
  border-radius: 12px;
  background-color: var(--color-warning, #ffc107);
  color: var(--color-text-dark, #000);
}

button.disabled {
  opacity: 0.7;
  cursor: not-allowed;
  background-color: var(--color-background-muted, #6c757d);
}

button.disabled:hover {
  opacity: 0.7;
  transform: none;
}
/* NOU ESTIL PER AL BOTÓ ESPIAR (opcional) */
.btn-spectate {
  background-color: var(--color-info, #17a2b8);
  margin-left: 1rem;
}
</style>
