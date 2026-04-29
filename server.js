const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const mongoose = require("mongoose");

app.use(express.json());
app.use(express.static("public"));

// ✅ MongoDB (avec sécurité)
mongoose.connect(process.env.MONGO_URL)
.then(() => console.log("Mongo connecté"))
.catch(err => console.log("Erreur Mongo:", err));

// test route (IMPORTANT pour éviter Not Found)
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

// socket
io.on("connection", (socket) => {
    console.log("User connecté");
});

// ✅ PORT RENDER (OBLIGATOIRE)
const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
