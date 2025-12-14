const { Server } = require("socket.io");
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI; 
const PORT = process.env.PORT || 3000;

if (!MONGO_URI) {
    console.error("❌ ERRO: Variável MONGO_URI não encontrada!");
} else {
    mongoose.connect(MONGO_URI)
        .then(() => console.log("🍃 MongoDB Conectado!"))
        .catch(err => console.error("❌ Erro Mongo:", err));
}

// SCHEMAS
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

const io = new Server(PORT, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

console.log(`📡 Servidor VoIP rodando na porta ${PORT}...`);

let usuariosOnline = {}; 

io.on("connection", (socket) => {
  console.log(`⚡ Conectado: ${socket.id}`); // ESSE LOG TEM QUE APARECER

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
        usuariosOnline[puuid] = {
            socketId: socket.id,
            peerId: peerId,
            nome: nome || "Invocador",
            iconId: iconId || 29,
            championId: championId || 0 
        };

        // LOG DE DEBUG PARA CAMPEÃO
        if(championId && championId > 0) {
            console.log(`🦸 ${nome} selecionou CHAMP ID: ${championId}`);
        } else {
            console.log(`📝 Registrado: ${nome} (Sem Champ)`);
        }

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
            console.error("Erro Mongo:", e.message);
        }
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
              championId: aliado.championId // Manda o champ de volta
          });
      }
    });

    if (aliadosEncontrados.length > 0) {
      console.log(`🔥 Match! Enviando ${aliadosEncontrados.length} aliados.`);
      socket.emit("aliados-encontrados", aliadosEncontrados);
    }
  });

  // REPORT
  socket.on("reportar-jogador", async (dadosReport) => {
      console.log("🚨 REPORT:", dadosReport);
      try {
          const novoReport = new Report(dadosReport);
          await novoReport.save();
      } catch(e) {}
  });

  socket.on("disconnect", () => {
      const puuid = Object.keys(usuariosOnline).find(k => usuariosOnline[k].socketId === socket.id);
      if(puuid) delete usuariosOnline[puuid];
  });
});