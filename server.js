const express  = require("express");
const cors     = require("cors");
const dotenv   = require("dotenv");
const axios    = require("axios");
const { dbEscrita, dbLeitura } = require("./database");

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3000;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

app.use(cors());
app.use(express.json());

// ─── Health check ───
app.get("/", (req, res) => {
  res.json({ status: "online", api: "Triagem Hospitalar" });
});

// ─── POST /login ───
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      { email, password, returnSecureToken: true }
    );
    res.json({ token: response.data.idToken });
  } catch {
    res.status(401).json({ error: "Login inválido" });
  }
});

// ─── Middleware verificarToken ───
async function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Token não enviado" });
  const token = authHeader.replace("Bearer ", "");
  try {
    await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      { idToken: token }
    );
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

// ─── POST /pacientes (protegida) ───
app.post("/pacientes", verificarToken, (req, res) => {

  const { nome, data_nascimento } = req.body;

  const sqlEscrita = `
    INSERT INTO nome_paciente
    (nome, data_nascimento)
    VALUES (?, ?)
  `;

  dbEscrita.query(sqlEscrita, [nome, data_nascimento], (erro, resultado) => {

    if (erro) {
      console.log("Erro banco escrita:", erro);
      return res.status(500).json({ error: "Erro ao cadastrar paciente" });
    }

    console.log("Paciente salvo no banco de escrita");

    const idPaciente = resultado.insertId;
    const senha = `A00${idPaciente}`;

    const sqlLeitura = `
      INSERT INTO painel_chamada
      (id, nome_paciente, senha, consultorio, status)
      VALUES (?, ?, ?, ?, ?)
    `;

    dbLeitura.query(
      sqlLeitura,
      [idPaciente, nome, senha, 1, 'Chamado'],
      (erroLeitura) => {

        if (erroLeitura) {
          console.log("Erro sincronização:", erroLeitura);
          return res.status(500).json({ error: "Erro ao sincronizar banco leitura" });
        }

        console.log("Paciente sincronizado com banco de leitura");

        res.json({
          mensagem: "Paciente cadastrado e sincronizado",
          id: idPaciente
        });
      }
    );
  });
}); // ← fecha app.post("/pacientes")

// ─── POST /triagem (protegida) ───
app.post("/triagem", verificarToken, async (req, res) => {
  const {
    nome_completo, cpf, data_nascimento,
    sintomas, sinais_vitais,
    classificacao_risco, consultorio_destino
  } = req.body;

  if (!nome_completo || !cpf || !data_nascimento || !classificacao_risco) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes" });
  }

  try {
    const result = await dbEscrita.query(
      `INSERT INTO pacientes_triagem
         (nome_completo, cpf, data_nascimento, sintomas,
          sinais_vitais, classificacao_risco, consultorio_destino)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [nome_completo, cpf, data_nascimento, sintomas || null,
       sinais_vitais ? JSON.stringify(sinais_vitais) : null,
       classificacao_risco, consultorio_destino || null]
    );

    const paciente = result.rows[0];

    const senha = String(paciente.id_atendimento).padStart(4, "0");
    dbLeitura.query(
      `INSERT INTO painel_chamada (nome_paciente, senha, consultorio, status)
       VALUES (?, ?, ?, 'Aguardando')
       ON DUPLICATE KEY UPDATE consultorio=VALUES(consultorio), atualizado_em=NOW()`,
      [nome_completo.split(" ")[0], senha, consultorio_destino || null],
      (errSync) => {
        if (errSync) console.warn("[Sync MySQL] Falhou:", errSync.message);
        else console.log("[Sync MySQL] OK — senha", senha);
      }
    );

    res.status(201).json({ mensagem: "Paciente cadastrado", paciente });

  } catch (err) {
    console.error("[POST /triagem]", err.message);
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      return res.status(503).json({
        error: "Sistema de cadastro indisponível",
        modo: "somente_leitura"
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /triagem/:id (protegida) ───
app.put("/triagem/:id", verificarToken, async (req, res) => {
  const { id } = req.params;
  const { classificacao_risco, consultorio_destino, status_atendimento } = req.body;
  try {
    const result = await dbEscrita.query(
      `UPDATE pacientes_triagem SET
         classificacao_risco = COALESCE($1, classificacao_risco),
         consultorio_destino = COALESCE($2, consultorio_destino),
         status_atendimento  = COALESCE($3, status_atendimento)
       WHERE id_atendimento = $4 RETURNING *`,
      [classificacao_risco||null, consultorio_destino||null, status_atendimento||null, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Atendimento não encontrado" });
    res.json({ mensagem: "Atualizado", paciente: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /painel (aberta) — lê MySQL, fallback PostgreSQL ───
app.get("/painel", (req, res) => {
  dbLeitura.query(
    `SELECT p.nome_paciente, p.senha, p.consultorio,
            c.descricao AS consultorio_descricao,
            p.status, p.atualizado_em
     FROM painel_chamada p
     LEFT JOIN consultorio c ON c.numero = p.consultorio
     ORDER BY p.atualizado_em DESC`,
    async (errMySQL, rows) => {
      if (!errMySQL) {
        return res.json({ fonte: "mysql", degradado: false, dados: rows });
      }
      console.warn("[FALLBACK] MySQL indisponível — usando PostgreSQL");
      try {
        const { rows: pgRows } = await dbEscrita.query(
          `SELECT SPLIT_PART(nome_completo,' ',1) AS nome_paciente,
                  LPAD(id_atendimento::text,4,'0') AS senha,
                  consultorio_destino::text AS consultorio,
                  status_atendimento AS status,
                  criado_em AS atualizado_em
           FROM pacientes_triagem ORDER BY criado_em DESC LIMIT 20`
        );
        res.json({ fonte: "postgres_fallback", degradado: true, dados: pgRows });
      } catch {
        res.status(503).json({ error: "Todos os bancos indisponíveis" });
      }
    }
  );
});

// ─── GET /fila — só pacientes aguardando ───
app.get("/fila", (req, res) => {
  dbLeitura.query(
    `SELECT nome_paciente, senha, consultorio, atualizado_em
     FROM painel_chamada WHERE status = 'Aguardando'
     ORDER BY atualizado_em ASC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ total: rows.length, fila: rows });
    }
  );
});

// ─── GET /consultorios ───
app.get("/consultorios", (req, res) => {
  dbLeitura.query(
    `SELECT c.numero, c.descricao, m.nome AS medico, m.especialidade, m.status
     FROM consultorio c
     LEFT JOIN nome_medico m ON m.consultorio = c.numero
     ORDER BY c.numero`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ total: rows.length, consultorios: rows });
    }
  );
});

// ─── GET /resumo — contagem por status ───
app.get("/resumo", (req, res) => {
  dbLeitura.query(
    `SELECT status, COUNT(*) AS total FROM painel_chamada GROUP BY status`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ resumo: rows });
    }
  );
});

// ─── GET /consistencia — valida dados sincronizados ───
app.get("/consistencia", (req, res) => {
  dbLeitura.query(
    `SELECT p.nome_paciente, p.senha, p.consultorio AS consultorio_informado,
            c.numero AS consultorio_existe
     FROM painel_chamada p
     LEFT JOIN consultorio c ON c.numero = p.consultorio
     WHERE c.numero IS NULL`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        inconsistencias: rows.length,
        mensagem: rows.length === 0
          ? "Todos os dados estão consistentes"
          : `${rows.length} registro(s) com consultório inválido`,
        dados: rows
      });
    }
  );
});

// ─── GET /pacientes — lista PostgreSQL (conferência) ───
app.get("/pacientes", async (req, res) => {
  try {
    const { rows } = await dbEscrita.query(
      `SELECT id_atendimento, nome_completo, cpf, classificacao_risco,
              consultorio_destino, status_atendimento, criado_em
       FROM pacientes_triagem ORDER BY criado_em DESC LIMIT 50`
    );
    res.json({ total: rows.length, pacientes: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(` API rodando em http://localhost:${PORT}`);
  console.log(`========================================`);
  console.log(` POST /login          — autenticação`);
  console.log(` POST /pacientes      — cadastrar paciente`);
  console.log(` POST /triagem        — cadastrar (protegida)`);
  console.log(` PUT  /triagem/:id    — atualizar (protegida)`);
  console.log(` GET  /painel         — painel TV + fallback`);
  console.log(` GET  /fila           — pacientes aguardando`);
  console.log(` GET  /consultorios   — lista consultórios`);
  console.log(` GET  /resumo         — contagem por status`);
  console.log(` GET  /consistencia   — valida sync`);
  console.log(` GET  /pacientes      — listar PostgreSQL\n`);
});