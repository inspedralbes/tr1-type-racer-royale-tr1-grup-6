<template>
  <div class="room-selector">
    <h2>Rooms disponibles</h2>

    <div class="rooms-list">
      <div v-if="rooms.length === 0" class="empty">
        No hi ha rooms disponibles
      </div>
      <ul>
        <li v-for="r in rooms" :key="r.id" class="room-item">
          <div class="room-info">
            <div class="room-name">
              {{ r.name }}
              <span v-if="r.inGame" class="in-game-badge">En juego</span>
            </div>
            <div class="room-meta">
              <span>Jugadors: {{ r.count || 0 }}</span>
              <span class="mode-info"
                >Mode:
                {{
                  r.modo === "muerteSubita" ? "Muerte Súbita" : "Normal"
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
              {{ r.inGame ? "En juego" : "Entrar" }}
            </button>
          </div>
        </li>
      </ul>
    </div>

    <div class="create-room">
      <input v-model="newRoomName" placeholder="Nom de la room" />
      <button @click="createRoom">Crear room</button>
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
  // Ask server for the list of rooms; server should reply with 'roomList'
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

// Añadimos el manejador de errores al unirse a una sala
onMounted(() => {
  communicationManager.onEvent("joinedRoom", (data) => {
    if (!data.success && data.error) {
      alert(data.error);
    }
  });
});

function onRoomList(payload) {
  // payload expected: [{ id, name, count }]
  if (Array.isArray(payload)) {
    rooms.value = payload;
  }
}

function onJoined(payload) {
  // payload may contain roomId and success
  emit("joined", payload);
}

onMounted(() => {
  communicationManager.onRoomList(onRoomList);
  communicationManager.onJoinedRoom(onJoined);

  // initial fetch and periodic polling as fallback
  refreshRooms();
  pollTimer = setInterval(refreshRooms, 4000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
  // communicationManager doesn't expose off(), so server side listeners persist only in socket
});
</script>

<style scoped>
.room-selector {
  width: 100%;
  max-width: 560px;
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
  font-weight: 700;
}
.room-meta {
  font-size: 12px;
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
</style>
