// servidor.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  let words = [];
  try {
    // Ruta al archivo words.json relativa a este archivo
    const wordsPath = path.join(__dirname, "data", "words.json");
    console.log("Intentando leer words.json desde:", wordsPath);
    const raw = fs.readFileSync(wordsPath, "utf8").replace(/^\uFEFF/, ""); // Eliminar BOM si existe
    words = JSON.parse(raw.trim());
    console.log(`Leídas ${words.length} palabras de words.json`);
    if (!Array.isArray(words)) words = [];
  } catch (err) {
    console.error("No se pudo leer words.json:", err.message);
    words = ["palabra", "ejemplo", "prueba", "texto", "vite"];
  }
  // Mezcla (Fisher-Yates)
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Configuración del juego
  const maxStack = 20; // cuantas palabras visibles a la vez
  const intervalMs = 2000; // cada cuánto aparecen palabras
  const wordsPerPlayer = Math.max(
    20,
    Math.floor(words.length / Math.max(1, Object.keys(jugadors).length))
  );

  const wordsByPlayer = {};
  const shuffled = shuffle(words);
  for (const id of Object.keys(jugadors)) {
    // Asignamos un bloque de palabras para cada jugador (puede repetirse si hay pocos)
    const playerWords = [];
    for (let i = 0; i < wordsPerPlayer; i++) {
      playerWords.push(
        shuffled[(i + Object.keys(jugadors).indexOf(id)) % shuffled.length]
      );
    }
    wordsByPlayer[id] = playerWords;
  }

  return {
    wordsByPlayer,
    maxStack,
    intervalMs,
    // startAt da un pequeño margen para que clientes preparen la UI
    startAt: Date.now() + 1500,
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
});

server.listen(3000);
