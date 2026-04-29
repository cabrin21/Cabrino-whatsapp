
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

app.use(express.json());
app.use(express.static("public"));

// 🔴 Remplace avec ton URL MongoDB Atlas si besoin
mongoose.connect("mongodb+srv://cabrinonsala32_db_user:099123@cluster0.prdzovd.mongodb.net/chatapp");

// Models
const User = mongoose.model("User", {
    username: { type: String, unique: true },
    password: String,
    online: { type: Boolean, default: false }
});

const Message = mongoose.model("Message", {
    from: String,
    to: String,
    text: String,
    createdAt: { type: Date, default: Date.now }
});

// Register
app.post("/register", async (req, res) => {
    try {
        const { username, password } = req.body;
        const exists = await User.findOne({ username });
        if (exists) return res.status(400).json({ ok:false, msg:"Username déjà pris" });
        const hash = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hash });
        await user.save();
        res.json({ ok:true });
    } catch (e) {
        res.status(500).json({ ok:false, msg:"Erreur serveur" });
    }
});

// Login
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ ok:false, msg:"Utilisateur non trouvé" });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(400).json({ ok:false, msg:"Mot de passe incorrect" });
        user.online = true;
        await user.save();
        res.json({ ok:true, username });
    } catch (e) {
        res.status(500).json({ ok:false, msg:"Erreur serveur" });
    }
});

// Contacts
app.get("/users", async (req, res) => {
    const users = await User.find({}, "username online");
    res.json(users);
});

// Messages between two users
app.get("/messages", async (req, res) => {
    const { u1, u2 } = req.query;
    const msgs = await Message.find({
        $or: [
            { from: u1, to: u2 },
            { from: u2, to: u1 }
        ]
    }).sort({ createdAt: 1 });
    res.json(msgs);
});

// Socket
const onlineMap = new Map(); // username -> socket.id

io.on("connection", (socket) => {

    socket.on("join", async (username) => {
        socket.username = username;
        onlineMap.set(username, socket.id);
        io.emit("presence", { username, online: true });
    });

    socket.on("private message", async (data) => {
        const msg = new Message(data);
        await msg.save();

        // send to sender
        socket.emit("private message", msg);

        // send to receiver if online
        const toSocketId = onlineMap.get(data.to);
        if (toSocketId) {
            io.to(toSocketId).emit("private message", msg);
        }
    });

    socket.on("disconnect", async () => {
        if (socket.username) {
            onlineMap.delete(socket.username);
            await User.updateOne({ username: socket.username }, { online: false });
            io.emit("presence", { username: socket.username, online: false });
        }
    });
});

http.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
