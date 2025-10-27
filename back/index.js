const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("TypeRacbackend is naadaing");
});

io.on("connection", (socket) => {
  console.log("a user connected:", socket.id);

  socket.on("typing", (data) => {
    socket.broadcast.emit("typing", data);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Serv listening on port ${PORT}`);
});
