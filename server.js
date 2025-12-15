const { Server } = require("socket.io");
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI; 
const PORT = process.env.PORT || 3000;

if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => console.log("🍃 MongoDB Conectado!"))
        .catch(err => console.error("❌ Erro Mongo:", err));
}

// Schemas
const UsuarioSchema = new mongoose.Schema({
    puuid: { type: String, required: true, unique: true },
    ultimoNome: String,
    ultimoIcone: Number,
    ultimoLogin: Date,
    championId: Number
});

const ReportSchema = new mongoose.Schema({
    denunciante: String, denunciado: String, motivo: String,
    data: { type: Date, default: Date.now }, status: { type: String, default: "Pendente" }
});

const Usuario = mongoose.model("Usuario", UsuarioSchema);
const Report = mongoose.model("Report", ReportSchema);

const io = new Server(PORT, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

console.log(`📡 Servidor VoIP rodando na porta ${PORT}...`);

let usuarios = {}; 
let salas = {};    

io.on("connection", (socket) => {
  
  // PING
  socket.on("ping-medicao", (t) => socket.emit("pong-medicao", t));
  socket.on("publicar-ping", (ms) => {
      const usuario = usuarios[socket.id];
      if(usuario) {
          const minhasSalas = Array.from(socket.rooms);
          minhasSalas.forEach(salaId => {
              if(salaId !== socket.id) io.to(salaId).emit("atualizacao-ping", { peerId: usuario.peerId, ms: ms });
          });
      }
  });

  // REGISTRO (CORRIGIDO PARA ATUALIZAR EM TEMPO REAL)
  socket.on("registrar-usuario", async (dados) => {
    const { puuid, peerId, nome, iconId, championId } = dados;

    if (puuid && peerId) {
        // 1. Atualiza RAM
        usuarios[socket.id] = {
            socketId: socket.id,
            peerId, puuid, nome,
            iconId: iconId || 29,
            championId: championId || 0
        };

        // 2. 🔥 AVISA A SALA QUE MUDEI DE CAMPEÃO 🔥
        // Pega as salas que estou conectado
        const minhasSalas = Array.from(socket.rooms);
        minhasSalas.forEach(salaId => {
            // Não manda pra mim mesmo (socket.id é uma sala automática)
            if(salaId !== socket.id) {
                // Reutiliza o evento 'usuario-entrou' pois o front já sabe atualizar cards existentes com ele
                io.to(salaId).emit("usuario-entrou", usuarios[socket.id]);
            }
        });

        // 3. Atualiza Mongo
        try {
            await Usuario.findOneAndUpdate(
                { puuid: puuid },
                { ultimoNome: nome, ultimoIcone: iconId, championId: championId, ultimoLogin: new Date() },
                { upsert: true, new: true }
            );
        } catch(e) {}
    }
  });

  // ENTRAR NA SALA
  socket.on("entrar-na-sala", (dados) => {
      const { idSala, meuPuuid, timePuuids } = dados;
      const usuario = usuarios[socket.id];
      if (!usuario) return;

      if (!salas[idSala]) {
          console.log(`🏠 Sala Criada: ${idSala.substring(0,8)}...`);
          salas[idSala] = { whitelist: timePuuids, criadaEm: Date.now() };
      }

      const sala = salas[idSala];
      if (sala.whitelist.includes(meuPuuid)) {
          socket.join(idSala);
          
          // Avisa os outros
          socket.to(idSala).emit("usuario-entrou", usuarios[socket.id]);

          // Pega quem tá lá
          const socketsNaSala = io.sockets.adapter.rooms.get(idSala);
          let listaPresentes = [];
          if (socketsNaSala) {
              socketsNaSala.forEach(sid => {
                  if (sid !== socket.id && usuarios[sid]) listaPresentes.push(usuarios[sid]);
              });
          }
          socket.emit("aliados-encontrados", listaPresentes);
      }
  });

  socket.on("reportar-jogador", async (d) => {
      try { await new Report(d).save(); } catch(e) {}
  });

  socket.on("disconnect", () => { delete usuarios[socket.id]; });
});
