import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const jugadors = {};
let hostId = null;
const MAX_STACK = 5;
const MAX_PLAYERS = 20;
const MIN_PLAYERS = 2;

console.log("Servidor Socket.IO listo en el puerto 3000");

// ---- Funciones auxiliares ----
function broadcastPlayerList() {
  const players = Object.values(jugadors);
  io.emit("updatePlayerList", { players, hostId });
}

function assignNewHost() {
  const ids = Object.keys(jugadors);
  hostId = ids.length > 0 ? ids[0] : null;
}

function allPlayersReady() {
  const players = Object.values(jugadors).filter(p => !p.eliminated);
  if (players.length < MIN_PLAYERS) return false;
  return players.every((p) => p.ready === true);
}

function createGamePayload() {
  const sampleWords = ["component", "reactivitat", "javascript", "framework", "template"];

  const wordsByPlayer = {};
  for (const id of Object.keys(jugadors)) {
    wordsByPlayer[id] = [...sampleWords];
    jugadors[id].score = 0;
    jugadors[id].stack = 0;
    jugadors[id].eliminated = false;
    jugadors[id].finished = false;
    jugadors[id].wordsRemaining = sampleWords.length;
  }

  return {
    wordsByPlayer,
    maxStack: MAX_STACK,
    startAt: Date.now(),
  };
}

// ---- Eliminación y fin de partida ----
function checkElimination(playerId) {
  const player = jugadors[playerId];
  if (!player || player.eliminated) return;

  if (player.stack >= MAX_STACK) {
    player.eliminated = true;
    io.emit("playerEliminated", { playerId, name: player.name });
    checkGameEnd();
  }
}

function checkGameEnd() {
  const activePlayers = Object.values(jugadors).filter(p => !p.eliminated);
  const unfinishedPlayers = Object.values(jugadors).filter(p => !p.finished && !p.eliminated);

  if (activePlayers.length <= 1 || unfinishedPlayers.length === 0) {
    const ranking = Object.values(jugadors)
      .sort((a, b) => b.score - a.score)
      .map(p => ({ id: p.id, name: p.name, score: p.score }));
    io.emit("gameEnd", { ranking });
  }
}

// ---- Socket.io ----
io.on("connection", (socket) => {
  console.log(`Usuario conectado: ${socket.id}`);

  if (Object.keys(jugadors).length >= MAX_PLAYERS) {
    socket.emit("serverFull");
    socket.disconnect();
    return;
  }

  jugadors[socket.id] = {
    id: socket.id,
    name: `Jugador-${socket.id.slice(0, 4)}`,
    ready: false,
    eliminated: false,
    finished: false,
    score: 0,
    stack: 0,
    wordsRemaining: 0,
  };

  if (!hostId) hostId = socket.id;
  broadcastPlayerList();

  // ---- Eventos existentes ----
  socket.on("disconnect", () => {
    console.log(`Usuario desconectado: ${socket.id}`);
    delete jugadors[socket.id];
    if (hostId === socket.id) assignNewHost();
    broadcastPlayerList();
  });

  socket.on("setPlayerName", (name) => {
    if (jugadors[socket.id]) {
      jugadors[socket.id].name = name;
      console.log(`jugador ${socket.id} se llama: ${name}`); 
      broadcastPlayerList();
    }
  });

  socket.on("clientReady", (payload) => {
    if (jugadors[socket.id]) {
      jugadors[socket.id].ready = !!payload?.ready;
      broadcastPlayerList();
    }
  });

  socket.on("startGame", () => {
    if (socket.id !== hostId) return;
    if (!allPlayersReady()) return;

    const gamePayload = createGamePayload();
    io.emit("gameStart", gamePayload);
  });

  // ---- Eventos nuevos ----
  socket.on("wordCompleted", () => {
    const player = jugadors[socket.id];
    if (!player || player.eliminated || player.finished) return;

    player.score += 1;
    player.wordsRemaining -= 1;

    if (player.wordsRemaining <= 0) {
      player.finished = true;
    }

    broadcastPlayerList();
    checkGameEnd();
  });

  socket.on("addPenalty", (amount = 1) => {
    const player = jugadors[socket.id];
    if (!player || player.eliminated) return;

    player.stack += amount;
    checkElimination(socket.id);
    broadcastPlayerList();
  });
});

server.listen(3000, () => console.log("Servidor escuchando en puerto 3000"));
