const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

let users = {}; 
let messages = {};

// LOAD SAFE
try {
  if (fs.existsSync("messages.json")) {
    const data = fs.readFileSync("messages.json", "utf-8");
    messages = data ? JSON.parse(data) : {};
  }
} catch (e) {
  console.log("⚠️ erreur lecture JSON, reset");
  messages = {};
}

// SAVE SAFE
function save() {
  try {
    fs.writeFileSync("messages.json", JSON.stringify(messages, null, 2));
  } catch (e) {
    console.log("❌ erreur sauvegarde");
  }
}

// ROOM
function room(a, b) {
  if (!a || !b) return null;
  return [a, b].sort().join("_");
}

io.on("connection", (socket) => {

  console.log("🔌 nouveau client");

  // JOIN
  socket.on("join", (user) => {
    if (!user) return;

    users[user] = socket.id;
    socket.user = user;

    console.log("✅ connecté :", user);

    io.emit("online", Object.keys(users));
  });

  // MESSAGE PRIVÉ
  socket.on("private_message", (data) => {
    try {
      if (!socket.user) return;

      const { to, msg, image, audio } = data;
      if (!to) return;

      const from = socket.user;
      const r = room(from, to);
      if (!r) return;

      if (!messages[r]) messages[r] = [];

      const message = {
        from,
        to,
        msg: msg || null,
        image: image || null,
        audio: audio || null,
        time: Date.now()
      };

      messages[r].push(message);
      save();

      // envoyer au destinataire
      if (users[to]) {
        io.to(users[to]).emit("private_message", message);
      }

      // renvoyer à l'envoyeur
      socket.emit("private_message", message);

    } catch (e) {
      console.log("❌ erreur message");
    }
  });

  // CHARGER HISTORIQUE
  socket.on("load", (to) => {
    if (!socket.user || !to) return;

    const r = room(socket.user, to);
    socket.emit("history", messages[r] || []);
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    if (socket.user) {
      delete users[socket.user];
      console.log("❌ déconnecté :", socket.user);
      io.emit("online", Object.keys(users));
    }
  });

});

server.listen(3000, () => {
  console.log("🚀 http://localhost:3000");
});
