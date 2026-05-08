const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");
const { dbEscrita, dbLeitura } = require("./database");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

app.get("/", (req, res) => {
    res.send("API funcionando");
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const response = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
            {
                email,
                password,
                returnSecureToken: true
            }
        );

        res.json({
            token: response.data.idToken
        });

    } catch (error) {
        res.status(401).json({
            error: "Login inválido"
        });
    }
});

async function verificarToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            error: "Token não enviado"
        });
    }

    const token = authHeader.replace("Bearer ", "");

    try {
        await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
            {
                idToken: token
            }
        );

        next();

    } catch (error) {
        return res.status(401).json({
            error: "Token inválido"
        });
    }
}

app.post("/pacientes", verificarToken, (req, res) => {
    const { nome, data_nascimento } = req.body;

    const sql = `
        INSERT INTO nome_paciente 
        (nome, data_nascimento) 
        VALUES (?, ?)
    `;

    dbEscrita.query(sql, [nome, data_nascimento], (erro, resultado) => {
        if (erro) {
            return res.status(500).json({
                error: "Erro ao cadastrar paciente"
            });
        }

        res.json({
            mensagem: "Paciente cadastrado com sucesso",
            id: resultado.insertId
        });
    });
});

app.get("/painel", (req, res) => {
    const sql = `
        SELECT nome_paciente, senha, consultorio, status, atualizado_em
        FROM painel_chamada
        ORDER BY atualizado_em DESC
    `;

    dbLeitura.query(sql, (erro, resultados) => {
        if (erro) {
            return res.status(500).json({
                error: "Erro ao buscar painel"
            });
        }

        res.json(resultados);
    });
});

console.log("ROTAS ATUALIZADAS: /pacientes e /painel carregadas");

app.listen(PORT, () => {
    console.log(`Rodando em http://localhost:${PORT}`);
});
