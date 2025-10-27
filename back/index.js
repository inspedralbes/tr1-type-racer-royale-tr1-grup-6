// servidor.js
import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Permet connexions des de qualsevol origen (per a desenvolupament)
  },
});

const jugadors = {};
console.log("Servidor Socket.IO escoltant al port 29845");

// Funció per enviar la llista de jugadors actualitzada a TOTHOM
function broadcastPlayerList() {
  io.emit("updatePlayerList", Object.values(jugadors));
}

// Lògica de connexió de Socket.IO
io.on("connection", (socket) => {
  console.log(`Un usuari s'ha connectat: ${socket.id}`);

  // Quan un usuari es desconnecta
  socket.on("disconnect", () => {
    console.log(`L'usuari ${socket.id} s'ha desconnectat`);
    delete jugadors[socket.id];
    broadcastPlayerList(); // Informem a la resta que algú ha marxat
  });

  // Quan un usuari ens envia el seu nom
  socket.on("setPlayerName", (name) => {
    jugadors[socket.id] = { id: socket.id, name: name };
    console.log(`L'usuari ${socket.id} ara es diu: ${name}`);
    broadcastPlayerList(); // Enviem la llista actualitzada a tothom
  });
});

server.listen(29845);
