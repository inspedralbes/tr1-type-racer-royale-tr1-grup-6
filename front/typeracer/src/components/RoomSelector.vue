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
                  r.modo === "muerteSubita" 
                    ? "Muerte Súbita" 
                    : r.modo === "contrarellotge"
                    ? "Contrarellotge"
                    : "Normal"
                }}</span
              >
            </div>
          </div>
          <div class="room-actions">
            <button
              @click="joinRoom(r.id)"
              :disabled="r.inGame"
              :class="{ disabled: r.inGame }"
              :title="r.inGame ? 'No puedes unirte a una partida en curso' : ''"
            >
              {{ r.inGame ? "Fent proves" : "Entrar" }}
            </button>
            
            <button
              v-if="r.inGame"
              @click="spectateRoom(r.id)"
              class="btn-spectate"
              title="Entrar como espectador"
            >
              Espiar
            </button>
          </div>
        </li>
      </ul>
    </div>

    <div class="create-room">
      <input v-model="newRoomName" placeholder="Nom de la sala" />
      <button @click="createRoom">Crear Cambra</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import communicationManager from "../services/communicationManager.js";

const emit = defineEmits(["joined"]);

const rooms = ref([]);
const newRoomName = ref("");

let pollTimer = null;

function refreshRooms() {
  communicationManager.listRooms();
}

function createRoom() {
  const name = (newRoomName.value || "").trim();
  if (!name) return;
  communicationManager.createRoom(name);
  newRoomName.value = "";
}

function joinRoom(id) {
  communicationManager.joinRoom(id);
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
  emit("joined", payload);
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

.create-room {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.create-room input {
  flex: 1;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
}
.create-room button {
  padding: 8px 12px;
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