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
            <div class="room-name">{{ r.name }}</div>
            <div class="room-meta">Jugadors: {{ r.count || 0 }}</div>
          </div>
          <div class="room-actions">
            <button @click="joinRoom(r.id)">Entrar</button>
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
</style>
