const { Pool } = require("pg");
const mysql = require("mysql2");

require("dotenv").config();

const dbEscrita = new Pool({
    host: process.env.DB_ESCRITA_HOST,
    port: process.env.DB_ESCRITA_PORT,
    user: process.env.DB_ESCRITA_USER,
    password: process.env.DB_ESCRITA_PASSWORD,
    database: process.env.DB_ESCRITA_DATABASE,
    ssl: {
        rejectUnauthorized: false
    }
});

const dbLeitura = mysql.createConnection({
    host: process.env.DB_LEITURA_HOST,
    port: process.env.DB_LEITURA_PORT,
    user: process.env.DB_LEITURA_USER,
    password: process.env.DB_LEITURA_PASSWORD,
    database: process.env.DB_LEITURA_DATABASE
});

dbEscrita.connect()
    .then(() => {
        console.log("Banco Escrita PostgreSQL conectado");
    })
    .catch((erro) => {
        console.log("Erro Banco Escrita PostgreSQL:", erro);
    });

dbLeitura.connect((erro) => {
    if (erro) {
        console.log("Erro Banco Leitura:", erro);
    } else {
        console.log("Banco Leitura conectado");
    }
});

module.exports = {
    dbEscrita,
    dbLeitura
};
