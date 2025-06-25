const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const app = next({ dev });
const handler = app.getRequestHandler();

const userSocketMap = {};

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONT_END,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

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
  console.log(`> Ready on port ${port}`);
});
});
