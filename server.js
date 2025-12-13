const { Server } = require("socket.io");
const PORT = process.env.PORT || 3000;

const io = new Server(PORT, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

console.log(`📡 Servidor VoIP Premium rodando na porta ${PORT}...`);

let usuariosOnline = {};

io.on("connection", (socket) => {
  // PING SYSTEM
  socket.on("ping-medicao", (timestamp) => { socket.emit("pong-medicao", timestamp); });
  socket.on("publicar-ping", (ms) => {
      const puuid = Object.keys(usuariosOnline).find(key => usuariosOnline[key].socketId === socket.id);
      if(puuid) {
          const user = usuariosOnline[puuid];
          io.emit("atualizacao-ping", { peerId: user.peerId, ms: ms });
      }
  });

  // REGISTRO
  socket.on("registrar-usuario", (dados) => {
    const { puuid, peerId, nome, iconId } = dados;
    if (puuid && peerId) {
        usuariosOnline[puuid] = {
            socketId: socket.id,
            peerId: peerId,
            nome: nome || "Invocador",
            iconId: iconId || 29
        };
    }
  });

  // MATCHMAKING
  socket.on("procurar-partida", (listaDePuuidsDoTime) => {
    let aliadosEncontrados = [];
    listaDePuuidsDoTime.forEach((puuid) => {
      const aliado = usuariosOnline[puuid];
      if (aliado && aliado.socketId !== socket.id) {
          aliadosEncontrados.push({
              peerId: aliado.peerId,
              nome: aliado.nome,
              puuid: puuid,
              iconId: aliado.iconId
          });
      }
    });

    if (aliadosEncontrados.length > 0) {
      socket.emit("aliados-encontrados", aliadosEncontrados);
    }
  });
});