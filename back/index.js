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

// Estado de rooms y jugadores
const rooms = new Map(); // Map to store rooms: { id, name, players: Map<socketId, playerData>, hostId }
const playerNames = new Map(); // Map to store player names by socket ID

// Genera un ID único para una room
function generateRoomId() {
  return Math.random().toString(36).substr(2, 9);
}

// Función para emitir la lista actualizada de jugadores de una room específica
function broadcastRoomPlayerList(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const players = Array.from(room.players.values());
  io.to(roomId).emit("updatePlayerList", { players, hostId: room.hostId });
}

console.log("Servidor Socket.IO listo en el puerto 3000");

// Devuelve true si todos los jugadores (no eliminados) están ready
function allPlayersReadyInRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.players.size === 0) return false;
  return Array.from(room.players.values()).every((p) => p.ready === true);
}
function createGamePayload(room) {
  let words = [];
  try {
    const wordsPath = path.join(__dirname, "data", "words.json");
    const raw = fs.readFileSync(wordsPath, "utf8").replace(/^\uFEFF/, "");
    words = JSON.parse(raw.trim());
    if (!Array.isArray(words)) words = [];
  } catch (err) {
    console.error("No se pudo leer words.json:", err.message);
    words = ["palabra", "ejemplo", "prueba", "texto", "vite"];
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const wordsPerPlayer = Math.max(
    20,
    Math.floor(words.length / Math.max(1, room.players.size))
  );

  const wordsByPlayer = {};
  const shuffled = shuffle(words);
  const players = Array.from(room.players.keys());

  for (let i = 0; i < players.length; i++) {
    const playerId = players[i];
    const playerWords = [];
    for (let j = 0; j < wordsPerPlayer; j++) {
      playerWords.push(shuffled[(j + i) % shuffled.length]);
    }
    wordsByPlayer[playerId] = playerWords;
  }

  return {
    wordsByPlayer,
    maxStack: 20,
    intervalMs: 2000,
    startAt: Date.now() + 1500,
  };
}
// modo de juego se guarda por sala en room.gameState.modo
io.on("connection", (socket) => {
  console.log(`Usuario conectado: ${socket.id}`);

  // Room management events
  socket.on("listRooms", () => {
    const roomsList = Array.from(rooms.values()).map((room) => ({
      id: room.id,
      name: room.name,
      count: room.players.size,
    }));
    socket.emit("roomList", roomsList);
  });

  socket.on("createRoom", (data) => {
    if (!data.name) return;
    const roomId = generateRoomId();
    const room = {
      id: roomId,
      name: data.name,
      players: new Map(),
      hostId: socket.id,
      gameState: {
        started: false,
        wordsByPlayer: {},
        maxStack: 20,
        intervalMs: 2000,
      },
    };

    room.players.set(socket.id, {
      id: socket.id,
      name: playerNames.get(socket.id) || `Player-${socket.id.slice(0, 4)}`,
      color: '#9E9E9E', 
      ready: false,
      eliminated: false,
      completedWords: 0,
      totalErrors: 0, // contador total de errores
    });

    rooms.set(roomId, room);
    console.log(`Room created: ${room.name} (${roomId})`);

    socket.join(roomId);
    socket.emit("joinedRoom", { success: true, roomId: roomId });

    io.emit(
      "roomList",
      Array.from(rooms.values()).map((r) => ({
        id: r.id,
        name: r.name,
        count: r.players.size,
      }))
    );

    broadcastRoomPlayerList(roomId);
  });

  socket.on("joinRoom", (data) => {
    const room = rooms.get(data.roomId);
    if (room) {
      // No permitir unirse si el juego ya comenzó
      if (room.gameState.started) {
        socket.emit("joinedRoom", {
          success: false,
          error: "Game already started",
        });
        return;
      }

      // Añadir jugador a la room
      room.players.set(socket.id, {
        id: socket.id,
        name: playerNames.get(socket.id) || `Player-${socket.id.slice(0, 4)}`,
        ready: false,
        eliminated: false,
        completedWords: 0,
        totalErrors: 0,
      });

      socket.join(data.roomId);
      socket.emit("joinedRoom", { success: true, roomId: data.roomId });
      console.log(`Player ${socket.id} joined room ${data.roomId}`);

      // Update room list for all clients
      io.emit(
        "roomList",
        Array.from(rooms.values()).map((r) => ({
          id: r.id,
          name: r.name,
          count: r.players.size,
        }))
      );

      // Broadcast updated player list to room
      broadcastRoomPlayerList(data.roomId);
    } else {
      socket.emit("joinedRoom", { success: false, error: "Room not found" });
    }
  });

  socket.on("leaveRoom", () => {
    // Find and leave any room the player is in
    for (const [roomId, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        socket.leave(roomId);

        // Si el host se va, asignar nuevo host al siguiente jugador
        if (room.hostId === socket.id && room.players.size > 0) {
          room.hostId = Array.from(room.players.keys())[0];
        }

        // If room is empty, remove it
        if (room.players.size === 0) {
          rooms.delete(roomId);
        } else {
          // Si la room sigue existiendo, actualizar la lista de jugadores
          broadcastRoomPlayerList(roomId);
        }

        socket.emit("leftRoom", { success: true });

        // Update room list for all clients
        io.emit(
          "roomList",
          Array.from(rooms.values()).map((r) => ({
            id: r.id,
            name: r.name,
            count: r.players.size,
          }))
        );
        break;
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`Usuario desconectado: ${socket.id}`);

    // Clean up room membership: remove player from any room they were in
    for (const [roomId, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        socket.leave(roomId);

        // >>> Aquí añade el fix de host <<<
        if (room.hostId === socket.id && room.players.size > 0) {
          // El nuevo host es el primero que queda en la sala
          room.hostId = Array.from(room.players.keys())[0];
        }
        // <<< fin del fix host >>>

        // If room empty, delete it; otherwise notify remaining players
        if (room.players.size === 0) {
          rooms.delete(roomId);
        } else {
          broadcastRoomPlayerList(roomId);
        }
      }
    }

    // Update room list for all clients
    io.emit(
      "roomList",
      Array.from(rooms.values()).map((r) => ({
        id: r.id,
        name: r.name,
        count: r.players.size,
      }))
    );
  });
  // 🎨 CAMBIO: Acepta nombre y color en el evento 'join'
  socket.on("join", (playerData) => {
    if (jugadors[socket.id] && playerData) {
      jugadors[socket.id].name = playerData.name || `Jugador-${socket.id.slice(0, 4)}`;
      jugadors[socket.id].color = playerData.color || '#9E9E9E'; // Asigna el color
      console.log(`Jugador ${socket.id} s'ha unit: ${jugadors[socket.id].name} (${jugadors[socket.id].color})`);
      broadcastPlayerList();
    }
  });
  socket.on("setPlayerName", (name) => {
    // Store the player name globally
    playerNames.set(socket.id, name);
    console.log(`Jugador ${socket.id} se llama: ${name}`);

    // Also update name in any room they're currently in
    for (const [roomId, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        const player = room.players.get(socket.id);
        player.name = name;
        broadcastRoomPlayerList(roomId);
      }
    }
  });

  socket.on("clientReady", (payload) => {
    const ready = !!payload?.ready;
    const roomId = payload?.roomId; // Necesitamos que el cliente envíe el roomId

    // Buscar la sala del jugador si no se proporcionó
    let targetRoomId = roomId;
    if (!targetRoomId) {
      for (const [rid, room] of rooms.entries()) {
        if (room.players.has(socket.id)) {
          targetRoomId = rid;
          break;
        }
      }
    }

    if (!targetRoomId) {
      console.log(
        `Player ${socket.id} tried to set ready but is not in any room`
      );
      return;
    }

    const room = rooms.get(targetRoomId);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (player) {
      player.ready = ready;
      console.log(
        `Jugador ${socket.id} ready=${ready} en room ${targetRoomId}`
      );
      broadcastRoomPlayerList(targetRoomId);
    }
  });

  // Actualizaciones de progreso desde clientes: { completedWords, totalErrors }
  socket.on("updatePlayerProgress", (payload) => {
    if (!payload) return;

    for (const [roomId, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        const player = room.players.get(socket.id);
        if (typeof payload.completedWords === "number") {
          player.completedWords = payload.completedWords;
        }
        if (typeof payload.totalErrors === "number") {
          player.totalErrors = payload.totalErrors;
        }
        // Si el cliente manda playTime (ms), lo guardamos para mostrar WPM
        if (typeof payload.playTime === "number") {
          player.playTime = payload.playTime;
        }
        broadcastRoomPlayerList(roomId);
        break; // updated the room containing this player
      }
    }
  });

  // Handler por si el host pulsa un botón para iniciar la partida
  socket.on("startGame", (payload) => {
    const roomId = payload?.roomId;
    if (!roomId) {
      console.log("No room ID provided for start game");
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      console.log(`Room ${roomId} not found`);
      return;
    }
    if (socket.id !== room.hostId) {
      console.log(
        `Usuario ${socket.id} intentó iniciar la partida en room ${roomId} pero no es host`
      );
      return;
    }

    if (room.players.size < 2) {
      console.log(
        `Room ${roomId}: No hay suficientes jugadores para iniciar. Mínimo 2 requeridos.`
      );
      socket.emit("notEnoughPlayers", {
        message: "Se requieren al menos 2 jugadores para iniciar.",
      });
      return;
    }

    if (!allPlayersReadyInRoom(roomId)) {
      console.log(
        `Room ${roomId}: El host intentó iniciar la partida pero no todos están listos`
      );
      return;
    }
    const modo = payload?.modo || "normal";
    console.log(`Starting game in mode: ${modo}`);

    const gamePayload = createGamePayload(room);
    gamePayload.modo = modo;

    // Marcar la sala como iniciada
    room.gameState.started = true;
    room.gameState.modo = modo;
    room.gameState.wordsByPlayer = gamePayload.wordsByPlayer;

    // Emitir solo a los jugadores de esta sala
    io.to(roomId).emit("gameStart", gamePayload);
    console.log(`gameStart emitido para room ${roomId}`);
  });

  socket.on("completeWord", (word) => {
    for (const [roomId, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        const player = room.players.get(socket.id);
        player.completedWords = (player.completedWords || 0) + 1;
        console.log(`Jugador ${socket.id} completó la palabra: ${word}`);
        broadcastRoomPlayerList(roomId);
        break;
      }
    }
  });
  // Cuando un jugador pierde (por acumular maxStack palabras) - por room
  socket.on("playerLost", () => {
    for (const [roomId, room] of rooms.entries()) {
      if (!room.players.has(socket.id)) continue;

      const player = room.players.get(socket.id);
      if (!player || player.eliminated) return;

      player.eliminated = true;
      console.log(
        `Jugador ${player.name} ha sido eliminado por acumulación de palabras.`
      );
      socket.emit("playerEliminated", {
        message: "Has perdido: demasiadas palabras acumuladas.",
      });

      // Actualizar la lista de la room
      broadcastRoomPlayerList(roomId);

      // Comprobamos si queda solo un jugador no eliminado → ese gana
      const activos = Array.from(room.players.values()).filter(
        (p) => !p.eliminated
      );

      if (activos.length === 1) {
        const ganador = activos[0];

        // Enviamos mensaje de victoria al ganador
        io.to(ganador.id).emit("playerWon", {
          message: "¡Enhorabuena! Has ganado a todos los jugadores.",
        });

        // Enviamos mensaje de derrota a los demás
        Array.from(room.players.values()).forEach((j) => {
          if (j.id !== ganador.id) {
            io.to(j.id).emit("playerEliminated", {
              message: `Has perdido. El ganador es ${ganador.name}.`,
            });
          }
        });
        io.to(roomId).emit("gameOver", {
          winnerId: ganador.id,
          winnerName: ganador.name,
          message: `${ganador.name} ha ganado la partida.`,
        });
        // Emitimos evento de fin de partida SOLO a la room
      }

      break;
    }
  });
  socket.on("muerteSubitaElimination", (payload) => {
    const roomId = payload?.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room || room.gameState.modo !== "muerteSubita") return;

    const player = room.players.get(socket.id);
    if (!player || player.eliminated) return;

    // Marcar al jugador como eliminado
    player.eliminated = true;
    console.log(`Jugador ${player.name} eliminado en muerte súbita por error`);

    // Notificar al jugador que ha sido eliminado
    socket.emit("playerEliminated", {
      playerId: player.id,
      playerName: player.name,
      message: "¡Te has equivocado! En muerte súbita, estás eliminado.",
    });

    // Actualizar la lista de jugadores en la sala
    broadcastRoomPlayerList(roomId);

    // Comprobar si solo queda un jugador activo
    const activos = Array.from(room.players.values()).filter(
      (p) => !p.eliminated
    );

    if (activos.length === 1) {
      const ganador = activos[0];

      // Notificar al ganador
      io.to(ganador.id).emit("playerWon", {
        message: "¡Eres el último jugador en pie!",
      });

      // Notificar a los demás jugadores
      Array.from(room.players.values()).forEach((j) => {
        if (j.id !== ganador.id) {
          io.to(j.id).emit("playerEliminated", {
            message: `Has perdido. El ganador es ${ganador.name}.`,
          });
        }
      });

      // Notificar el fin del juego a toda la sala
      io.to(roomId).emit("gameOver", {
        winnerId: ganador.id,
        winnerName: ganador.name,
        message: `${ganador.name} ha ganado la partida en modo muerte súbita.`,
      });
    }
  });
});
server.listen(3000);