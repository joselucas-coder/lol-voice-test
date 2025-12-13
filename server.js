const { Server } = require("socket.io");
const PORT = process.env.PORT || 3000;

const io = new Server(PORT, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

console.log(`📡 Servidor VoIP Premium rodando na porta ${PORT}...`);

let usuariosOnline = {};

io.on("connection", (socket) => {
  console.log(`⚡ Conectado: ${socket.id}`);

  // ========================================================
  // 4. SISTEMA DE PING (NOVO)
  // ========================================================
  
  // Passo 1: O Cliente manda um "Oi", o servidor responde "Oi" na hora.
  // Isso serve pro cliente calcular quanto tempo demorou a viagem.
  socket.on("ping-medicao", (timestamp) => {
      socket.emit("pong-medicao", timestamp);
  });

  // Passo 2: O Cliente calculou o tempo e avisou: "Meu ping é 30ms".
  // O servidor avisa TODO MUNDO: "O PeerId tal está com 30ms".
  socket.on("publicar-ping", (ms) => {
      // Procura quem é o dono desse socket
      const puuid = Object.keys(usuariosOnline).find(key => usuariosOnline[key].socketId === socket.id);
      
      if(puuid) {
          const user = usuariosOnline[puuid];
          // Manda pra geral
          io.emit("atualizacao-ping", { peerId: user.peerId, ms: ms });
      }
  });

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