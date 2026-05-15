const { Pool } = require("pg");
const mysql    = require("mysql2");
require("dotenv").config();
 
// ─── BANCO 2 — PostgreSQL Supabase (Escrita) ───
const dbEscrita = new Pool({
  host:     process.env.PG_HOST,
  port:     parseInt(process.env.PG_PORT),
  user:     process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: { rejectUnauthorized: false },
  options:  '--search_path=public'
});

 
dbEscrita.connect()
  .then(() => console.log("[PostgreSQL] Banco de Escrita conectado"))
  .catch((err) => console.error("[PostgreSQL] Erro:", err.message));
 
// ─── BANCO 3 — MySQL Railway (Leitura) ───
const dbLeitura = mysql.createConnection({
  host:     process.env.MYSQL_HOST,
  port:     process.env.MYSQL_PORT,
  user:     process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});
 
dbLeitura.connect((err) => {
  if (err) console.error("[MySQL] Erro:", err.message);
  else     console.log("[MySQL] Banco de Leitura conectado");
});
 
module.exports = { dbEscrita, dbLeitura };