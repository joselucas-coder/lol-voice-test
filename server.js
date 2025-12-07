const { Server } = require("socket.io");

// CONFIGURAÇÃO DA PORTA (CRUCIAL PARA O RENDER)
// O Render define uma porta aleatória na variável process.env.PORT.
// Se não tiver (no seu PC), usa a 3000.
const PORT = process.env.PORT || 3000;

// Cria o servidor
const io = new Server(PORT, {
    cors: {
        origin: "*", // Permite conexão de qualquer lugar (seu app Electron)
        methods: ["GET", "POST"]
    }
});

console.log(`📡 Servidor rodando e escutando na porta ${PORT}...`);

// O BANCO DE DADOS TEMPORÁRIO
// Estrutura: { "PUUID": { socketId: "...", peerId: "..." } }
let usuariosOnline = {};

io.on("connection", (socket) => {
  console.log(`⚡ Novo cliente conectado: ${socket.id}`);

  // 1. REGISTRO (Quando você abre o app)
  socket.on("registrar-usuario", (dados) => {
    const { puuid, peerId } = dados;

    if (puuid && peerId) {
        usuariosOnline[puuid] = {
            socketId: socket.id,
            peerId: peerId
        };
        console.log(`📝 Usuário Registrado: ${puuid.substring(0, 8)}...`);
    }
  });

  // 2. BUSCA DE PARTIDA (Quando entra na seleção)
  socket.on("procurar-partida", (listaDePuuidsDoTime) => {
    console.log(`🔍 Socket ${socket.id} buscando aliados...`);
    
    let idsDeVozDosAliados = [];

    // Varre a lista do time que veio do LoL
    listaDePuuidsDoTime.forEach((puuidDoAliado) => {
      
      const aliadoEncontrado = usuariosOnline[puuidDoAliado];

      if (aliadoEncontrado) {
        // Verifica se o aliado NÃO sou eu mesmo
        if (aliadoEncontrado.socketId !== socket.id) {
            // Se achou um amigo diferente, guarda o ID de voz dele
            idsDeVozDosAliados.push(aliadoEncontrado.peerId);
        }
      }
    });

    // Se achou alguém, devolve a lista para o app ligar
    if (idsDeVozDosAliados.length > 0) {
      console.log(`🔥 MATCH! Encontramos ${idsDeVozDosAliados.length} aliado(s)! Enviando IDs...`);
      socket.emit("aliados-encontrados", idsDeVozDosAliados);
    } else {
      console.log("❄️ Nenhum aliado com o app encontrado nesta partida.");
    }
  });

  // 3. DESCONEXÃO
  socket.on("disconnect", () => {
    // (Opcional: aqui poderia limpar o usuário da lista, mas para teste pode deixar assim)
    console.log(`❌ Cliente desconectou: ${socket.id}`);
  });
});