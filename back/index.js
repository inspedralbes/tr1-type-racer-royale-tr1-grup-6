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
  const players = Object.values(jugadors).filter(p => !p.eliminated);
  if (players.length === 0) return false;
  return players.every((p) => p.ready === true);
}

function handlePlayerErrors(count) {
  const player = jugadors[this.id];
  if (!player || player.eliminated) return;

  if (count >= 5) {
    player.eliminated = true;
    console.log(`Jugador ${player.name} eliminado por errores`);
    this.emit("playerEliminated", {
      message: "Has sido eliminado por cometer demasiados errores."
    });
    broadcastPlayerList();
  }
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
  // Nuevo handler para eliminar jugador por errores
  socket.on("playerEliminated", (count) => {
    const player = jugadors[socket.id];
    if(player || player.eliminated) return;
    if (count>=5){
      player.eliminated = true;
      console.log(`Jugador ${player.name} eliminado por errores`);
      socket.emit("playerEliminated", {
        message: "Has sido eliminado por cometer demasiados errores."
      });
      broadcastPlayerList();

    }
  });

  // Aceptamos tanto "playerErrorCount" (frontend actual) como "playerEliminated"
  socket.on("playerErrorCount", handlePlayerErrors);
  socket.on("playerWon", () => {
    const player = jugadors[socket.id];
    if (!player || player.eliminated) return;

    console.log(`Jugador ${player.name} ha completado las palabras`);
    socket.emit("playerWon", {
      message: "Has completado las palabras."
    });

    //marcamos a los otros jugadores como eliminados y les avisamos
    for (const id of Object.keys(jugadors)) {
      if (id !== socket.id) {
        jugadors[id].eliminated = true; // “perdedor”
        io.to(id).emit("playerEliminated", {
          message: `Has perdido porque ${player.name} completó todas las palabras.`
        });
      }
    }

    io.emit("gameOver", {
      winnerId: socket.id,
      winnerName: player.name,
      message: `${player.name} ha completado las palabras`
    });
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
