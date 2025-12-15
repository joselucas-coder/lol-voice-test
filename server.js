const { Server } = require("socket.io");
const mongoose = require("mongoose");

// --- CONFIGURAÇÃO ---
const MONGO_URI = process.env.MONGO_URI; 
const PORT = process.env.PORT || 3000;

// Conexão com Banco de Dados (Histórico e Reports)
if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => console.log("🍃 MongoDB Conectado!"))
        .catch(err => console.error("❌ Erro Mongo:", err));
}

// --- MODELOS (BANCO) ---
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

// --- SERVIDOR SOCKET ---
const io = new Server(PORT, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

console.log(`📡 Servidor VoIP (Salas + Mongo) rodando na porta ${PORT}...`);

// Memória RAM (Rápida para salas)
let usuarios = {}; 
let salas = {};    

io.on("connection", (socket) => {
  
  // 1. PING OTIMIZADO (Envia apenas para quem está na mesma sala)
  socket.on("ping-medicao", (t) => socket.emit("pong-medicao", t));
  socket.on("publicar-ping", (ms) => {
      const usuario = usuarios[socket.id];
      if(usuario) {
          const minhasSalas = Array.from(socket.rooms);
          minhasSalas.forEach(salaId => {
              if(salaId !== socket.id) {
                  io.to(salaId).emit("atualizacao-ping", { peerId: usuario.peerId, ms: ms });
              }
          });
      }
  });

  // 2. REGISTRO GERAL
  socket.on("registrar-usuario", async (dados) => {
    const { puuid, peerId, nome, iconId, championId } = dados;

    if (puuid && peerId) {
        // Salva na RAM
        usuarios[socket.id] = {
            socketId: socket.id,
            peerId, puuid, nome,
            iconId: iconId || 29,
            championId: championId || 0
        };

        // Salva no Mongo
        try {
            await Usuario.findOneAndUpdate(
                { puuid: puuid },
                { ultimoNome: nome, ultimoIcone: iconId, championId: championId, ultimoLogin: new Date() },
                { upsert: true, new: true }
            );
        } catch(e) { console.error("Erro Mongo:", e.message); }
    }
  });

  // 3. SISTEMA DE SALAS (RECONEXÃO)
  socket.on("entrar-na-sala", (dados) => {
      const { idSala, meuPuuid, timePuuids } = dados;
      const usuario = usuarios[socket.id];

      if (!usuario) return;

      // Cria sala se não existir
      if (!salas[idSala]) {
          console.log(`🏠 Sala Criada: ${idSala.substring(0,8)}...`);
          salas[idSala] = {
              whitelist: timePuuids, // Lista de quem pode entrar (Baseado no time original)
              criadaEm: Date.now()
          };
      }

      // Verifica Whitelist (Segurança)
      const sala = salas[idSala];
      if (sala.whitelist.includes(meuPuuid)) {
          socket.join(idSala);
          console.log(`✅ ${usuario.nome} entrou na sala.`);

          // Avisa quem já está lá que eu entrei
          socket.to(idSala).emit("usuario-entrou", {
              peerId: usuario.peerId,
              nome: usuario.nome,
              puuid: usuario.puuid,
              iconId: usuario.iconId,
              championId: usuario.championId
          });

          // Pega quem já está lá e manda pra mim
          const socketsNaSala = io.sockets.adapter.rooms.get(idSala);
          let listaPresentes = [];
          if (socketsNaSala) {
              socketsNaSala.forEach(sid => {
                  if (sid !== socket.id && usuarios[sid]) {
                      listaPresentes.push(usuarios[sid]);
                  }
              });
          }
          socket.emit("aliados-encontrados", listaPresentes);

      } else {
          console.log(`⛔ Acesso negado: ${usuario.nome}`);
      }
  });

  // 4. REPORT
  socket.on("reportar-jogador", async (dadosReport) => {
      console.log("🚨 REPORT:", dadosReport);
      try {
          const novoReport = new Report(dadosReport);
          await novoReport.save();
      } catch(e) {}
  });

  socket.on("disconnect", () => {
      delete usuarios[socket.id];
  });
});