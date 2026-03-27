const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  // Ping/Pong a nivel Engine.IO (automático)
  pingInterval: 25000,  // Envía ping cada 25s
  pingTimeout: 20000,   // Espera pong 20s antes de desconectar
});

// ============================================
// EVENTOS DEL SERVIDOR
// ============================================

io.on("connection", (socket) => {
  console.log(`✅ Cliente conectado: ${socket.id}`);

  // Notificar al cliente que se conectó exitosamente
  socket.emit("welcome", {
    message: "Bienvenido al servidor Socket.IO",
    socketId: socket.id,
    timestamp: Date.now(),
  });

  // ---- STREAM DE DATOS RANDOM (simula precio crypto) ----
  const priceInterval = setInterval(() => {
    socket.emit("price_update", {
      symbol: "BTC/COP",
      price: (150000000 + Math.random() * 10000000).toFixed(0),
      change: (Math.random() * 4 - 2).toFixed(2) + "%",
      timestamp: Date.now(),
    });
  }, 3000);

  // ---- STREAM DE UBICACIÓN (simula tracking GPS) ----
  let lat = 4.711;  // Bogotá
  let lng = -74.0721;
  const locationInterval = setInterval(() => {
    lat += (Math.random() - 0.5) * 0.001;
    lng += (Math.random() - 0.5) * 0.001;
    socket.emit("location_update", {
      driverId: "driver_001",
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
      speed: (Math.random() * 60).toFixed(1),
      timestamp: Date.now(),
    });
  }, 2000);

  // ---- ECHO: devuelve lo que recibe ----
  socket.on("message", (data) => {
    console.log(`📩 Mensaje recibido: ${JSON.stringify(data)}`);
    socket.emit("message_response", {
      echo: data,
      serverTime: Date.now(),
    });
  });

  // ---- PING/PONG a nivel aplicación ----
  socket.on("app_ping", (data) => {
    socket.emit("app_pong", {
      clientTime: data.clientTime,
      serverTime: Date.now(),
    });
  });

  // ---- ROOMS (unirse a un viaje) ----
  socket.on("join_trip", (data) => {
    const { tripId, userName } = data;
    socket.join(tripId);
    console.log(`🚗 ${userName} se unió al viaje: ${tripId}`);

    // Notificar a todos en la room
    io.to(tripId).emit("trip_notification", {
      message: `${userName} se unió al viaje`,
      tripId,
      participants: io.sockets.adapter.rooms.get(tripId)?.size || 0,
      timestamp: Date.now(),
    });
  });

  socket.on("send_to_trip", (data) => {
    const { tripId, message } = data;
    io.to(tripId).emit("trip_message", {
      from: socket.id,
      message,
      timestamp: Date.now(),
    });
  });

  // ---- DESCONEXIÓN ----
  socket.on("disconnect", (reason) => {
    clearInterval(priceInterval);
    clearInterval(locationInterval);
    console.log(`❌ Cliente desconectado: ${socket.id} | Razón: ${reason}`);
  });
});

// ============================================
// ENDPOINT HTTP DE SALUD
// ============================================
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Socket.IO server corriendo",
    connectedClients: io.engine.clientsCount,
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor Socket.IO corriendo en http://localhost:${PORT}`);
  console.log(`📡 Esperando conexiones...`);
});