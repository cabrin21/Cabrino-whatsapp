const socket = io({ reconnection: true });

let user = localStorage.getItem("user") || null;
let current = null;

// AUTO LOGIN
if (user) {
  startApp();
}

function login() {
  user = document.getElementById("number").value;
  if (!user) return alert("Numéro requis");

  localStorage.setItem("user", user);
  startApp();
}

function startApp() {
  socket.emit("join", user);

  document.getElementById("login").style.display = "none";
  document.getElementById("app").style.display = "flex";
}

// OUVRIR CHAT
function openChat() {
  current = document.getElementById("contact").value;

  if (!current) return alert("Entre un numéro");

  document.getElementById("messages").innerHTML = "";
  socket.emit("load", current);
}

// ENVOI MESSAGE
function send() {
  const msg = document.getElementById("msg").value;

  if (!msg || !current) return;

  socket.emit("private_message", {
    to: current,
    msg
  });

  document.getElementById("msg").value = "";
}

// HISTORIQUE
socket.on("history", list => {
  document.getElementById("messages").innerHTML = "";
  list.forEach(add);
});

// NOUVEAU MESSAGE
socket.on("private_message", add);

// AFFICHER MESSAGE
function add(data) {
  if (!current) return;

  if (data.from !== current && data.to !== current) return;

  const div = document.createElement("div");
  div.className = "msg " + (data.from === user ? "me" : "other");

  if (data.image) {
    div.innerHTML = `<img src="${data.image}" width="120">`;
  } else if (data.audio) {
    div.innerHTML = `<audio controls src="${data.audio}"></audio>`;
  } else {
    div.innerText = data.msg;
  }

  const box = document.getElementById("messages");
  box.appendChild(div);
  box.scrollTop = box.scrollHeight; // auto scroll
}

// IMAGE
document.getElementById("file").onchange = function () {
  if (!current) return alert("Ouvre un chat");

  const file = this.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    socket.emit("private_message", {
      to: current,
      image: reader.result
    });
  };

  reader.readAsDataURL(file);
};

// AUDIO
let rec, chunks = [], recording = false;

document.getElementById("record").onmousedown = async () => {
  if (!current) return alert("Ouvre un chat");

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  rec = new MediaRecorder(stream);

  rec.ondataavailable = e => chunks.push(e.data);

  rec.onstop = () => {
    if (!recording) {
      chunks = [];
      return;
    }

    const blob = new Blob(chunks);
    const url = URL.createObjectURL(blob);

    socket.emit("private_message", {
      to: current,
      audio: url
    });

    chunks = [];
  };

  recording = true;
  rec.start();
};

// STOP AUDIO
document.onmouseup = () => {
  if (rec) rec.stop();
};

// SLIDE CANCEL (style WhatsApp)
document.onmousemove = (e) => {
  if (recording && e.clientX < 50) {
    recording = false;
    chunks = [];
    console.log("❌ enregistrement annulé");
  }
};
