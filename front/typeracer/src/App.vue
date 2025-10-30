<script setup>
import { ref, onMounted } from "vue";
import comms from "./services/communicationManager.js";
import GameEngine from "./components/GameEngine.vue";

const playerName = ref("");
const nameSet = ref(false);
const isReady = ref(false);
const isHost = ref(false);
const inGame = ref(false);
const initialWords = ref([]);

const players = ref([]);
const ranking = ref([]);
const gameEnded = ref(false);

let rankingWindow = null;

function setName() {
  if (!playerName.value.trim()) return;
  comms.emit("setPlayerName", playerName.value.trim());
  nameSet.value = true;
}

function toggleReady() {
  isReady.value = !isReady.value;
  comms.emit("clientReady", { ready: isReady.value });
}

function startGame() {
  comms.emit("startGame");
}

function backToLobby() {
  inGame.value = false;
  gameEnded.value = false;
  initialWords.value = [];
  ranking.value = [];
  nameSet.value = false;
}

// Hacemos la función accesible desde otras pestañas
window.backToLobby = backToLobby;

// Mostrar ranking en una pestaña nueva
function showRankingInNewTab(rankingArray) {
  const rows = rankingArray
    .map(
      (p, i) => `
    <div style="display:flex;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #eee;">
      <div style="font-weight:700; width:40px">${i + 1}.</div>
      <div style="flex:1">${escapeHtml(p.name)}</div>
      <div style="width:80px;text-align:right;color:#333">${p.score} pts</div>
    </div>
  `
    )
    .join("");

  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Ranking - Type Racer Royale</title>
  </head>
  <body style="font-family:Arial,Helvetica,sans-serif;margin:0;background:#f6f7fb;">
    <div style="max-width:900px;margin:40px auto;background:#fff;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,0.12);overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid #eee;background:linear-gradient(90deg,#4b6cb7,#182848);color:#fff;">
        <h1 style="margin:0;font-size:20px;">Ranking final</h1>
      </div>
      <div style="padding:12px 0;max-height:70vh;overflow:auto;">
        ${rows}
      </div>
      <div style="padding:12px;text-align:center;border-top:1px solid #eee;">
        <button onclick="window.opener.backToLobby(); window.close();" style="padding:8px 14px;border-radius:6px;border:0;background:#2b6cb0;color:#fff;cursor:pointer;">Volver al lobby</button>
      </div>
    </div>
  </body>
  </html>`;

  try {
    if (rankingWindow && !rankingWindow.closed) {
      rankingWindow.document.open();
      rankingWindow.document.write(html);
      rankingWindow.document.close();
      rankingWindow.focus();
    } else {
      rankingWindow = window.open("", "_blank");
      if (rankingWindow) {
        rankingWindow.document.open();
        rankingWindow.document.write(html);
        rankingWindow.document.close();
        rankingWindow.focus();
      }
    }
  } catch (err) {
    console.warn("No se pudo abrir la pestaña del ranking:", err);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (s) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s])
  );
}

// Comunicación con backend
onMounted(() => {
  comms.on("updatePlayerList", ({ players: serverPlayers, hostId }) => {
    players.value = serverPlayers || [];
    isHost.value = comms.socket.id === hostId;
  });

  comms.on("gameStart", (gamePayload) => {
    initialWords.value = gamePayload.wordsByPlayer?.[comms.socket.id] || [];
    inGame.value = true;
  });

  comms.on("gameEnd", ({ ranking: finalRanking }) => {
    showRankingInNewTab(finalRanking);
    ranking.value = finalRanking;
    gameEnded.value = true;
    inGame.value = false;
  });

  comms.on("serverFull", () => {
    alert("El servidor está lleno. No puedes entrar.");
  });
});
</script>

<template>
  <div id="app">
    <h1>Type Racer Royale</h1>

    <!-- pantalla inicial -->
    <section v-if="!nameSet" class="center-card">
      <h2>Introduce tu nombre</h2>
      <input v-model="playerName" placeholder="Tu nombre" />
      <button @click="setName">Entrar</button>
    </section>

    <!-- lobby -->
    <section v-else-if="!inGame && !gameEnded" class="lobby-card">
      <h2>Lobby</h2>
      <div class="players-list">
        <div v-for="p in players" :key="p.id" class="player-row">
          <div class="player-name" v-if="p.name && p.name.trim() !== ''">{{ p.name }}</div>
          <div class="player-meta">
            <span>{{ p.ready ? "Ready" : "Not ready" }}</span>
          </div>
        </div>
      </div>
      <div class="controls">
        <button @click="toggleReady">{{ isReady ? "Cancelar Ready" : "Ready" }}</button>
        <button v-if="isHost" @click="startGame">Iniciar partida</button>
      </div>
    </section>

    <!-- juego -->
    <section v-else-if="inGame && !gameEnded" class="game-area">
      <GameEngine :initialWords="initialWords" />
    </section>
  </div>
</template>

<style scoped>
#app { max-width: 900px; margin:0 auto; text-align:center; font-family:Arial,sans-serif; padding:20px; }
.center-card, .lobby-card { border:1px solid #ddd; padding:16px; border-radius:8px; margin:12px 0; }
.players-list { max-height:250px; overflow-y:auto; text-align:left; margin-bottom:12px; }
.player-row { display:flex; justify-content:space-between; padding:6px 8px; border-bottom:1px solid #f0f0f0; }
.player-name { font-weight:600; }
.player-meta span { margin-left:8px; color:#555; }
.controls { margin-top:12px; }
.controls button { margin-right:8px; padding:6px 10px; }
.game-area { margin-top:12px; }
</style>
