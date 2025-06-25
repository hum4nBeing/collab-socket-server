const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = createServer(app);

const port = process.env.PORT || 3001;
const FRONT_END = process.env.FRONT_END || "*";

const io = new Server(httpServer, {
  cors: {
    origin: FRONT_END,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.get("/", (req, res) => {
  res.send("✅ Collab Socket Server is running!");
});

const userSocketMap = {};

function getAllClients(id) {
  return Array.from(io.sockets.adapter.rooms.get(id) || []).map((socketId) => ({
    socketId,
    username: userSocketMap[socketId],
  }));
}

io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("join", ({ id, user }) => {
    userSocketMap[socket.id] = user.username;
    socket.join(id);
    const clients = getAllClients(id);
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit("joined", {
        clients,
        username: user.username,
        socketId: socket.id,
      });
    });
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.in(roomId).emit("disconnected", {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
      socket.leave(roomId);
    });
    delete userSocketMap[socket.id];
  });

  socket.on("codeChange", ({ id, code }) => {
    socket.to(id).emit("codeChange", code);
  });

  socket.on("syncCode", ({ socketId, code }) => {
    io.to(socketId).emit("codeChange", code);
  });

  socket.on("changeLanguage", ({ id, language }) => {
    socket.to(id).emit("changeLanguage", language);
  });
});

httpServer.listen(port, () => {
  console.log(`✅ Socket server running on port ${port}`);
});
