const socket = io();
let user = null;
let current = null;

// LOGIN
function login() {
  user = document.getElementById("number").value.trim();

  if (!user) return alert("Entre un numéro");

  localStorage.setItem("user", user);

  socket.emit("join", user);
  socket.emit("get_chats");

  document.getElementById("login").style.display = "none";
  document.getElementById("app").style.display = "flex";
}

// OPEN CHAT
function openChat(contact) {
  current = contact || document.getElementById("contact").value;

  if (!current) return;

  document.getElementById("chat-name").innerText = current;
  document.getElementById("messages").innerHTML = "";

  socket.emit("load", current);
  socket.emit("seen", current);
}

// SEND MESSAGE
function send() {
  const input = document.getElementById("msg");
  const msg = input.value.trim();

  if (!msg || !current) return;

  socket.emit("private_message", {
    to: current,
    msg
  });

  input.value = "";
}

// RECEIVE MESSAGE
socket.on("private_message", add);

function add(data) {
  if (data.from !== current && data.to !== current) return;

  const div = document.createElement("div");
  div.className = "msg " + (data.from === user ? "me" : "other");

  if (data.image) {
    div.innerHTML = `<img src="${data.image}" width="120">`;
  } else {
    div.innerText = data.msg;
  }

  document.getElementById("messages").appendChild(div);

  // AUTO SCROLL
  const box = document.getElementById("messages");
  box.scrollTop = box.scrollHeight;
}

// CHAT LIST
socket.on("chat_list", list => {
  const box = document.getElementById("chat-list");
  box.innerHTML = "";

  list.forEach(c => {
    const div = document.createElement("div");
    div.className = "chat-item";
    div.innerText = c.contact;

    div.onclick = () => openChat(c.contact);

    box.appendChild(div);
  });
});

// FILE UPLOAD
document.getElementById("file").onchange = async function () {
  if (!this.files[0] || !current) return;

  const formData = new FormData();
  formData.append("file", this.files[0]);

  try {
    const res = await fetch("/upload", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    socket.emit("private_message", {
      to: current,
      image: data.url
    });

  } catch (err) {
    alert("Erreur upload");
  }
};
