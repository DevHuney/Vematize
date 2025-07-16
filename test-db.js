// test-db.js
// Script para testar a conexão com o banco de dados Oracle de forma isolada.

// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;

// Verifica se a URI de conexão existe
if (!uri) {
  console.error("CRÍTICO: A variável MONGODB_URI não foi encontrada no arquivo .env.");
  process.exit(1);
}

console.log("Usando a URI:", uri);
const client = new MongoClient(uri);

async function runTest() {
  try {
    console.log("\nTentando conectar ao banco de dados...");
    await client.connect();
    console.log("**************************************************");
    console.log("✅ SUCESSO: Conexão com o banco de dados estabelecida!");
    console.log("**************************************************");

    // Tenta listar as coleções para confirmar que a conexão está funcional
    const db = client.db(); // Usa o banco de dados da string de conexão
    console.log(`\nListando coleções no banco de dados/schema '${db.databaseName}':`);
    const collections = await db.listCollections().toArray();
    
    if (collections.length === 0) {
        console.log("- Nenhuma coleção encontrada.");
    } else {
        collections.forEach(col => console.log(`- ${col.name}`));
    }

  } catch (error) {
    console.error("**************************************************");
    console.error("❌ FALHA: Não foi possível conectar ao banco de dados.");
    console.error("**************************************************");
    console.error("\nDetalhes do Erro:");
    console.error(error);
  } finally {
    // Garante que a conexão será fechada
    await client.close();
    console.log("\nConexão fechada.");
  }
}

runTest(); 