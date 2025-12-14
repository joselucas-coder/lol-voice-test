const { Server } = require("socket.io");
const mongoose = require("mongoose");

// O Render vai injetar a senha aqui automaticamente
// Se for rodar local, certifique-se de configurar essa variável ou colar a string aqui para teste
const MONGO_URI = process.env.MONGO_URI; 

const PORT = process.env.PORT || 3000;

// 1. CONEXÃO COM O MONGODB
if (!MONGO_URI) {
    console.error("❌ ERRO: Variável MONGO_URI não encontrada!");
} else {
    mongoose.connect(MONGO_URI)
        .then(() => console.log("🍃 MongoDB Conectado com Sucesso!"))
        .catch(err => console.error("❌ Erro ao conectar no MongoDB:", err));
}

// 2. MODELOS (SCHEMAS)
const UsuarioSchema = new mongoose.Schema({
    puuid: { type: String, required: true, unique: true },
    ultimoNome: String,
    ultimoIcone: Number,
    ultimoLogin: Date,
    championId: Number
});

const ReportSchema = new mongoose.Schema({
    denunciante: String,
    denunciado: String,
    motivo: String,
    data: { type: Date, default: Date.now },
    status: { type: String, default: "Pendente" }
});

const Usuario = mongoose.model("Usuario", UsuarioSchema);
const Report = mongoose.model("Report", ReportSchema);

// 3. SOCKET.IO SERVER
const io = new Server(PORT, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

console.log(`📡 Servidor VoIP (MongoDB Edition) rodando na porta ${PORT}...`);

let usuariosOnline = {}; // Memória rápida para o matchmaking

io.on("connection", (socket) => {
  console.log(`⚡ Conectado: ${socket.id}`);

  // PING
  socket.on("ping-medicao", (t) => socket.emit("pong-medicao", t));
  socket.on("publicar-ping", (ms) => {
      const puuid = Object.keys(usuariosOnline).find(k => usuariosOnline[k].socketId === socket.id);
      if(puuid) {
          const user = usuariosOnline[puuid];
          io.emit("atualizacao-ping", { peerId: user.peerId, ms: ms });
      }
  });

  // REGISTRO
  socket.on("registrar-usuario", async (dados) => {
    const { puuid, peerId, nome, iconId, championId } = dados;

    if (puuid && peerId) {
        // Memória RAM (Rápido)
        usuariosOnline[puuid] = {
            socketId: socket.id,
            peerId: peerId,
            nome: nome || "Invocador",
            iconId: iconId || 29,
            championId: championId || 0
        };

        console.log(`📝 Registrado: ${nome}`);

        // Banco de Dados (Seguro)
        try {
            await Usuario.findOneAndUpdate(
                { puuid: puuid },
                { 
                    ultimoNome: nome, 
                    ultimoIcone: iconId, 
                    championId: championId,
                    ultimoLogin: new Date() 
                },
                { upsert: true, new: true }
            );
        } catch(e) {
            console.error("Erro Mongo (Usuario):", e.message);
        }
    }
  });

  // REPORT
  socket.on("reportar-jogador", async (dadosReport) => {
      console.log("🚨 REPORT:", dadosReport);
      try {
          const novoReport = new Report({
              denunciante: dadosReport.denunciante,
              denunciado: dadosReport.denunciado,
              motivo: dadosReport.motivo
          });
          await novoReport.save();
          console.log("✅ Report salvo no banco!");
      } catch(e) {
          console.error("Erro Mongo (Report):", e.message);
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
              iconId: aliado.iconId,
              championId: aliado.championId
          });
      }
    });

    if (aliadosEncontrados.length > 0) {
      console.log(`🔥 Match! Enviando ${aliadosEncontrados.length} aliados.`);
      socket.emit("aliados-encontrados", aliadosEncontrados);
    }
  });

  socket.on("disconnect", () => {
      const puuid = Object.keys(usuariosOnline).find(k => usuariosOnline[k].socketId === socket.id);
      if(puuid) delete usuariosOnline[puuid];
  });
});