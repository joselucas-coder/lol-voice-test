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

// 2. MODELOS
const UsuarioSchema = new mongoose.Schema({
    puuid: { type: String, required: true, unique: true },
    ultimoNome: String,
    ultimoIcone: Number,
    ultimoLogin: Date,
    championId: Number // 🔥 GARANTINDO QUE O CAMPEÃO EXISTE NO BANCO
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
  
  // PING
  socket.on("ping-medicao", (t) => socket.emit("pong-medicao", t));
  socket.on("publicar-ping", (ms) => {
      const puuid = Object.keys(usuariosOnline).find(k => usuariosOnline[k].socketId === socket.id);
      if(puuid) {
          const user = usuariosOnline[puuid];
          io.emit("atualizacao-ping", { peerId: user.peerId, ms: ms });
      }
  });

  // REGISTRO (AQUI ESTAVA O POSSÍVEL ERRO)
  socket.on("registrar-usuario", async (dados) => {
    // 🔥 IMPORTANTE: Pegando championId explicitamente
    const { puuid, peerId, nome, iconId, championId } = dados;

    if (puuid && peerId) {
        // Atualiza Memória RAM (Usada para resposta rápida no Lobby)
        usuariosOnline[puuid] = {
            socketId: socket.id,
            peerId: peerId,
            nome: nome || "Invocador",
            iconId: iconId || 29,
            championId: championId || 0 // 🔥 Salvando na memória
        };

        // Log para Debug no Render (Pra gente ver se está chegando)
        if (championId && championId > 0) {
            console.log(`🦸 ${nome} selecionou campeão ID: ${championId}`);
        }

        // Atualiza Banco de Dados
        try {
            await Usuario.findOneAndUpdate(
                { puuid: puuid },
                { 
                    ultimoNome: nome, 
                    ultimoIcone: iconId, 
                    championId: championId, // 🔥 Salvando no Mongo
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
      
      // Se achou alguém online (que não sou eu)
      if (aliado && aliado.socketId !== socket.id) {
          aliadosEncontrados.push({
              peerId: aliado.peerId,
              nome: aliado.nome,
              puuid: puuid,
              iconId: aliado.iconId,
              championId: aliado.championId // 🔥 ENVIANDO O CAMPEÃO DE VOLTA PRO APP
          });
      }
    });

    if (aliadosEncontrados.length > 0) {
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