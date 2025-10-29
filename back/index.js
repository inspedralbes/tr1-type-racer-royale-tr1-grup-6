// servidor.js
import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Estado de jugadores: { [socketId]: { id, name, ready, eliminated } }
const jugadors = {};
let hostId = null;

console.log("Servidor Socket.IO listo en el puerto 3000");
// Función para emitir la lista actualizada de jugadores a todos
function broadcastPlayerList() {
  const players = Object.values(jugadors);
  io.emit("updatePlayerList", { players, hostId });
}

function assignNewHost() {
  const ids = Object.keys(jugadors);
  hostId = ids.length > 0 ? ids[0] : null;
}

// Devuelve true si todos los jugadores (no eliminados) están ready
function allPlayersReady() {
  const players = Object.values(jugadors);
  if (players.length === 0) return false;
  return players.every((p) => p.ready === true);
}

// Crea un payload simple de palabras para cada jugador (mismo set para todos por ahora)
function createGamePayload() {
  const sampleWords = [
    "component",
    "reactivitat",
    "javascript",
    "framework",
    "template",
  ];

  const wordsByPlayer = {};
  for (const id of Object.keys(jugadors)) {
    wordsByPlayer[id] = [...sampleWords];
  }

  return {
    wordsByPlayer,
    maxStack: 5,
    startAt: Date.now(),
  };
}

io.on("connection", (socket) => {
  console.log(`Usuario conectado: ${socket.id}`);

  // Inicializamos el jugador con valores por defecto
  jugadors[socket.id] = {
    id: socket.id,
    name: `Jugador-${socket.id.slice(0, 4)}`,
    ready: false,
    eliminated: false,
    completedWords: 0,
  };

  // Si no hay host, este será el host (primer usuario)
  if (!hostId) {
    hostId = socket.id;
  }

  // Enviar la lista actualizada
  broadcastPlayerList();

  socket.on("disconnect", () => {
    console.log(`Usuario desconectado: ${socket.id}`);
    delete jugadors[socket.id];
    // Si el host se desconecta, reasignar
    if (hostId === socket.id) {
      assignNewHost();
    }
    broadcastPlayerList();
  });

  socket.on("setPlayerName", (name) => {
    if (jugadors[socket.id]) {
      jugadors[socket.id].name = name;
      console.log(`Jugador ${socket.id} se llama: ${name}`);
      broadcastPlayerList();
    }
  });

  socket.on("clientReady", (payload) => {
    const ready = !!payload?.ready;
    if (jugadors[socket.id]) {
      jugadors[socket.id].ready = ready;
      console.log(`Jugador ${socket.id} ready=${ready}`);
      broadcastPlayerList();
    }
  });

  // Actualizaciones de progreso desde clientes: { completedWords } o número
  socket.on("updatePlayerProgress", (payload) => {
    let completed = 0;
    if (typeof payload === "number") completed = payload;
    else if (payload && typeof payload.completedWords === "number")
      completed = payload.completedWords;

    if (jugadors[socket.id]) {
      jugadors[socket.id].completedWords = completed;
      // Emitimos la lista actualizada para que todos vean los nuevos contadores
      broadcastPlayerList();
    }
  });

  // Handler por si el host pulsa un botón para iniciar la partida
  socket.on("startGame", () => {
    if (socket.id !== hostId) {
      console.log(
        `Usuario ${socket.id} intentó iniciar la partida pero no es host`
      );
      return;
    }

    if (!allPlayersReady()) {
      console.log(
        "El host intentó iniciar la partida pero no todos están listos"
      );
      return;
    }

    const gamePayload = createGamePayload();
    io.emit("gameStart", gamePayload);
    console.log("gameStart emitido por el host");
  });

  socket.on("completeWord", (word) => {
    if (jugadors[socket.id]) {
      jugadors[socket.id].completedWords += 1;
      console.log(`Jugador ${socket.id} completó la palabra: ${word}`);
      broadcastPlayerList();
    }
  });
});

server.listen(3000);
