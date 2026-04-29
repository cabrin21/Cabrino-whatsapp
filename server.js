const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const multer = require("multer");
const path = require("path");

const app = express();
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
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
  console.log("⚠️ reset messages.json");
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

// 📂 UPLOAD CONFIG (SECURE)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/", "audio/"];
    if (allowed.some(type => file.mimetype.startsWith(type))) {
      cb(null, true);
    } else {
      cb(new Error("Type non autorisé"));
    }
  }
});

// ROUTE UPLOAD
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });

  res.json({ url: "/uploads/" + req.file.filename });
});

// SOCKET
io.on("connection", (socket) => {

  console.log("🔌 connecté");

  // JOIN
  socket.on("join", (user) => {
    if (!user) return;

    users[user] = socket.id;
    socket.user = user;

    io.emit("online", Object.keys(users));
  });

  // MESSAGE
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
        time: Date.now(),
        seen: false
      };

      messages[r].push(message);
      save();

      if (users[to]) io.to(users[to]).emit("private_message", message);
      socket.emit("private_message", message);

    } catch (e) {
      console.log("❌ erreur message");
    }
  });

  // SEEN
  socket.on("seen", (to) => {
    if (!socket.user || !to) return;

    const r = room(socket.user, to);
    if (!messages[r]) return;

    messages[r].forEach(m => {
      if (m.to === socket.user) m.seen = true;
    });

    save();

    if (users[to]) io.to(users[to]).emit("seen", socket.user);
  });

  // LOAD
  socket.on("load", (to) => {
    if (!socket.user || !to) return;

    const r = room(socket.user, to);
    socket.emit("history", messages[r] || []);
  });

  // CHAT LIST
  socket.on("get_chats", () => {
    if (!socket.user) return;

    const user = socket.user;
    let list = [];

    Object.keys(messages).forEach(r => {
      const [a, b] = r.split("_");

      if (a === user || b === user) {
        const last = messages[r][messages[r].length - 1];

        list.push({
          contact: a === user ? b : a,
          last
        });
      }
    });

    socket.emit("chat_list", list);
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    if (socket.user) {
      delete users[socket.user];
      io.emit("online", Object.keys(users));
      console.log("❌ déconnecté:", socket.user);
    }
  });

});

server.listen(3000, () => {
  console.log("🚀 http://localhost:3000");
});
