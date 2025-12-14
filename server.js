const { Server } = require("socket.io");
const PORT = process.env.PORT || 3000;

const io = new Server(PORT, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

console.log(`📡 Servidor VoIP Premium rodando na porta ${PORT}...`);

let usuariosOnline = {};
let reports = []; // Banco de dados de reports (Simples)

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

  // REGISTRO (Agora com ChampionId)
  socket.on("registrar-usuario", (dados) => {
    // dados: { puuid, peerId, nome, iconId, championId }
    const { puuid, peerId, nome, iconId, championId } = dados;

    if (puuid && peerId) {
        usuariosOnline[puuid] = {
            socketId: socket.id,
            peerId: peerId,
            nome: nome || "Invocador",
            iconId: iconId || 29,
            championId: championId || 0 // 0 = Nenhum champ selecionado
        };
    }
  });

  // SISTEMA DE REPORT (NOVO)
  socket.on("reportar-jogador", (dadosReport) => {
      console.log("🚨 REPORT RECEBIDO:", dadosReport);
      reports.push(dadosReport);
      // Aqui futuramente você salvaria no MongoDB/Firebase
  });

  // MATCHMAKING
  socket.on("procurar-partida", (listaDePuuidsDoTime) => {
    let aliadosEncontrados = [];
    listaDePuuidsDoTime.forEach((puuid) => { // Aqui a variável se chama 'puuid'
      const aliado = usuariosOnline[puuid];
      if (aliado && aliado.socketId !== socket.id) {
          aliadosEncontrados.push({
              peerId: aliado.peerId,
              nome: aliado.nome,
              puuid: puuid, // Corrigido: usa 'puuid' em vez de 'puuidDoAliado'
              iconId: aliado.iconId,
              championId: aliado.championId // Manda o champ pro amigo ver
          });
      }
    });

    if (aliadosEncontrados.length > 0) {
      socket.emit("aliados-encontrados", aliadosEncontrados);
    }
  });
});