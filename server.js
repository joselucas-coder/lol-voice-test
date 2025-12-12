const { Server } = require("socket.io");
const PORT = process.env.PORT || 3000;

const io = new Server(PORT, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

console.log(`📡 Servidor VoIP Premium rodando na porta ${PORT}...`);

let usuariosOnline = {};

io.on("connection", (socket) => {
  console.log(`⚡ Conectado: ${socket.id}`);

  // Recebe: { puuid, peerId, nome, iconId }
  socket.on("registrar-usuario", (dados) => {
    const { puuid, peerId, nome, iconId } = dados;

    if (puuid && peerId) {
        usuariosOnline[puuid] = {
            socketId: socket.id,
            peerId: peerId,
            nome: nome || "Invocador",
            iconId: iconId || 29 // 29 é o icone do Poro padrão caso venha vazio
        };
        // Log para debug
        console.log(`📝 Registrado: ${nome} (Icone: ${iconId})`);
    }
  });

  socket.on("procurar-partida", (listaDePuuidsDoTime) => {
    let aliadosEncontrados = [];

    listaDePuuidsDoTime.forEach((puuidDoAliado) => {
      const aliado = usuariosOnline[puuidDoAliado];

      // Se o aliado existe E não sou eu mesmo
      if (aliado && aliado.socketId !== socket.id) {
          aliadosEncontrados.push({
              peerId: aliado.peerId,
              nome: aliado.nome,
              puuid: puuidDoAliado,
              iconId: aliado.iconId // Manda o icone pro amigo ver
          });
      }
    });

    if (aliadosEncontrados.length > 0) {
      console.log(`🔥 Match! Enviando ${aliadosEncontrados.length} aliados para ${socket.id}`);
      socket.emit("aliados-encontrados", aliadosEncontrados);
    }
  });

  socket.on("disconnect", () => {
      // Opcional: Limpar usuário desconectado
  });
});