const { Server } = require("socket.io");

// Configuração da porta para o Render (ou 3000 local)
const PORT = process.env.PORT || 3000;

const io = new Server(PORT, {
    cors: {
        origin: "*", // Permite conexão de qualquer lugar
        methods: ["GET", "POST"]
    }
});

console.log(`📡 Servidor VoIP rodando na porta ${PORT}...`);

// Banco de dados temporário
// Antes guardava só ID. Agora guarda: { socketId, peerId, nome }
let usuariosOnline = {};

io.on("connection", (socket) => {
  console.log(`⚡ Novo cliente conectado: ${socket.id}`);

  // 1. REGISTRO (Agora recebemos o NOME também)
  socket.on("registrar-usuario", (dados) => {
    // O app vai mandar: { puuid, peerId, nome }
    const { puuid, peerId, nome } = dados;

    if (puuid && peerId) {
        usuariosOnline[puuid] = {
            socketId: socket.id,
            peerId: peerId,
            nome: nome || "Invocador Desconhecido" // Se não vier nome, usa padrão
        };
        console.log(`📝 Registrado: ${nome} (PUUID: ${puuid.substring(0, 5)}...)`);
    }
  });

  // 2. BUSCA DE PARTIDA
  socket.on("procurar-partida", (listaDePuuidsDoTime) => {
    let aliadosEncontrados = [];

    // Varre a lista do time que veio do LoL
    listaDePuuidsDoTime.forEach((puuidDoAliado) => {
      
      const aliado = usuariosOnline[puuidDoAliado];

      // Se o aliado existe E não sou eu mesmo
      if (aliado && aliado.socketId !== socket.id) {
        
        // --- AQUI ESTÁ A MUDANÇA PRINCIPAL ---
        // Antes mandávamos só o ID string.
        // Agora mandamos um OBJETO com o nome para aparecer na tela.
        aliadosEncontrados.push({
            peerId: aliado.peerId,
            nome: aliado.nome, 
            puuid: puuidDoAliado
        });
      }
    });

    // Se achou alguém, devolve a lista
    if (aliadosEncontrados.length > 0) {
      console.log(`🔥 MATCH para ${socket.id}: Encontrou ${aliadosEncontrados.length} amigo(s). Enviando dados...`);
      socket.emit("aliados-encontrados", aliadosEncontrados);
    }
  });

  // 3. DESCONEXÃO
  socket.on("disconnect", () => {
    console.log(`❌ Cliente desconectou: ${socket.id}`);
  });
});