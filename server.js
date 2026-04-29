const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const multer = require("multer");

app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("public/uploads"));

// MongoDB
mongoose.connect(process.env.MONGO_URL)
.then(()=>console.log("Mongo connecté"))
.catch(err=>console.log(err));

// Models
const User = mongoose.model("User", {
    phone: String,
    password: String
});

const Message = mongoose.model("Message", {
    from: String,
    to: String,
    text: String,
    image: String,
    audio: String
});

// Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "public/uploads"),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// Routes
app.post("/register", async (req,res)=>{
    const { phone, password } = req.body;
    const exist = await User.findOne({ phone });
    if(exist) return res.json({ ok:false, msg:"Numéro existe" });

    const hash = await bcrypt.hash(password,10);
    await User.create({ phone, password:hash });

    res.json({ ok:true });
});

app.post("/login", async (req,res)=>{
    const { phone, password } = req.body;
    const user = await User.findOne({ phone });
    if(!user) return res.json({ ok:false, msg:"Introuvable" });

    const valid = await bcrypt.compare(password, user.password);
    if(!valid) return res.json({ ok:false, msg:"Erreur mdp" });

    res.json({ ok:true, phone });
});

app.get("/users", async (req,res)=>{
    const users = await User.find({}, "phone");
    res.json(users);
});

app.post("/upload", upload.single("image"), (req,res)=>{
    res.json({ url:"/uploads/"+req.file.filename });
});

app.post("/upload-audio", upload.single("audio"), (req,res)=>{
    res.json({ url:"/uploads/"+req.file.filename });
});

// Socket
io.on("connection", socket => {

    socket.on("private message", async data => {
        const msg = new Message(data);
        await msg.save();
        io.emit("private message", data);
    });

});

// PORT
const PORT = process.env.PORT || 3000;
http.listen(PORT, ()=>console.log("Server running "+PORT));
