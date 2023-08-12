const express = require("express");
const app = express();
const ejs = require("ejs");
const { Server } = require("socket.io");
const PORT = process.env.PORT || 8051;

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
let userData = [];
app.get("/", (req, res) => {
  res.render("index");
});

app.post("/", (req, res) => {
  let { nickname } = req.body;
  let nickname_exists = userData.find((user) => user.nickname === nickname);

  if (!nickname_exists) {
    res.render("chat", { nickname });
  } else {
    res.redirect("/");
  }
});

app.get("/chat", (req, res) => {
  let { nickname } = req.body;

  if (!nickname) {
    res.render("index");
  } else {
    res.render("chat", { nickname });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const io = new Server(server);

io.on("connection", (socket) => {
  console.log(socket.id);
  console.log("Socket connected");

  socket.on("connect-socket", (userId, nickname) => {
    userData.push({ userId, nickname });
    console.log(userData);
  });

  // socket.on("send-info", (nickname, userId) => {
  //   socket.nickname = nickname;
  //   socket.id = userId;
  // });

  socket.on("send-msg", (msg, userId, roomId, nickname) => {
    let room = io.sockets.adapter.rooms.get(roomId);
    console.log(room);
    console.log(msg);
    if (!room) {
      socket.emit("need-join-room", "需要加入房間，才能使用聊天功能。");
      return;
    } else if (msg === "") {
      return;
    }
    io.to(roomId).emit("sent-msg", msg, userId, nickname);
  });

  socket.on("create-room", (roomId, userId) => {
    if (io.sockets.adapter.rooms.get(roomId)) {
      console.log(socket.id);

      console.log("error: room already exists");
      socket.emit("room-already-exists", "房間名稱已被占用");
      return;
    }
    if (roomId == "") {
      socket.emit("roomId-cant-empty", "房間名稱不能為空");
      return;
    }
    /* 當創建房間後，不可再創建房間（判別方式：userId為socket.id) */

    for (let i = 0; i < userData.length; i++) {
      if (userData[i].userId === userId && userData[i].roomId) {
        socket.emit("cant-create-room", "進入房間後，不可創建房間");
        return;
      }
    }

    console.log("已創建房間成功");
    socket.join(roomId);

    for (let i = 0; i < userData.length; i++) {
      if (userData[i].userId === userId) {
        userData[i].roomId = roomId;
      }
    }

    socket.emit("room-created", roomId, userId);
  });

  socket.on("join-room", (roomId, userId) => {
    if (!io.sockets.adapter.rooms.get(roomId)) {
      socket.emit("room-not-found", roomId);
      return;
    }
    for (let i = 0; i < userData.length; i++) {
      if (userData[i].userId === userId && userData[i].roomId) {
        socket.emit("cant-create-room", "進入房間後，不可創建或者進入房間");
        return;
      }
    }
    console.log("join-room");
    socket.join(roomId);
    for (let i = 0; i < userData.length; i++) {
      if (userData[i].userId === userId) {
        userData[i].roomId = roomId;
        break;
      }
    }

    console.log(userData);
    socket.emit("joined-room", roomId, userId);
  });

  socket.on("leave-room", (roomId, userId) => {
    if (!io.sockets.adapter.rooms.get(roomId)) {
      socket.emit("not-leave-room", "需要加入房間才能使用離開房間功能");
      return;
    }
    socket.leave(roomId);
    for (let i = 0; i < userData.length; i++) {
      if (userData[i].userId === userId) {
        delete userData[i].roomId;
      }
    }

    socket.emit("leaved-room");
  });

  socket.on("get-online-people", () => {
    console.log(userData);
    socket.emit("got-online-people", userData);
  });
  socket.on("error", (error) => {
    console.log(error);
  });

  socket.on("get-room-people", (roomId) => {
    // console.log("-----room-people-----");
    let room_data = [];
    let room_people = io.sockets.adapter.rooms.get(roomId);
    if (!room_people) {
      return;
    } else {
      // console.log(userData);
      room_people.forEach((userId) => {
        room_data.push(userId);
      });

      socket.emit("got-room-people", userData, roomId);
    }
    // console.log("-----room-people-----");
  });

  socket.on("get-current-rooms", () => {
    socket.emit("got-current-rooms", userData);
  });

  socket.on("disconnect", () => {
    let _temp = userData.filter((value) => socket.id !== value.userId);
    userData = _temp;
    console.log("disconnect");
  });
});
