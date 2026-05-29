# 🏥 Triagem Hospitalar — Projeto 5 (BD Distribuído CQRS)

## Arquitetura

| Banco | Tecnologia | Hospedagem | Função |
|-------|------------|------------|--------|
| Banco 1 | Firebase Auth | Firebase | Login de enfermeiros/médicos |
| Banco 2 | PostgreSQL | Supabase | Escrita — prontuário completo |
| Banco 3 | MySQL | Railway | Leitura — painel TV da sala de espera |

## Estrutura do Projeto

```
triagem/
├── api/
│   ├── app.py          ← API Flask (todas as rotas)
│   ├── database.py     ← conexões Supabase (PG) e Railway (MySQL)
│   ├── auth.py         ← login/verificação Firebase via REST
│   ├── sync.py         ← sincronização automática CRON PG→MySQL
│   └── requirements.txt
├── frontend/
│   ├── index.html      ← tela do enfermeiro (login + triagem)
│   └── painel.html     ← painel da TV da sala de espera
├── sql/
│   ├── postgres_schema.sql
│   └── mysql_schema.sql
└── README.md
```

## Rotas da API

| Método | Rota | Autenticação | Descrição |
|--------|------|-------------|-----------|
| GET | / | Não | Health check |
| GET | /health | Não | Status dos bancos |
| POST | /login | Não | Autentica Firebase |
| POST | /triagem | ✅ Token | Cadastra paciente (PG + MySQL) |
| PUT | /triagem/:id | ✅ Token | Atualiza status |
| GET | /painel | Não | Painel TV com fallback |
| GET | /fila | Não | Pacientes aguardando |
| GET | /consultorios | Não | Lista consultórios (MySQL) |
| GET | /resumo | Não | Contagem por status |
| GET | /consistencia | Não | Valida sincronização |
| GET | /pacientes | Não | Lista pacientes (PostgreSQL) |

## Instalação e execução

```bash
cd api

# 1. Copiar o .env
cp ../.env.example .env
# O .env já vem com todas as credenciais preenchidas

# 2. Instalar dependências
pip install -r requirements.txt

# 3. Rodar
python app.py
```

Abrir no navegador:
- `frontend/index.html` → tela do enfermeiro
- `frontend/painel.html` → painel TV (atualiza a cada 5s)

## Por que PostgreSQL para escrita?

O PostgreSQL foi escolhido por suportar o tipo JSONB, que permite
armazenar sinais vitais (pressão, temperatura, SpO2) de forma
flexível sem criar colunas fixas. Também oferece suporte nativo
a transações ACID, essencial para dados hospitalares.

## Por que MySQL para leitura?

O MySQL foi escolhido para o banco de leitura por ser leve e
rápido em operações SELECT simples. O painel de TV só precisa
exibir nome e consultório — não há necessidade de JSONB ou
transações complexas.

## Sincronização (Consistência Eventual)

M�todo: duplo — sincronização imediata na rota POST /triagem
+ CRON automático a cada 10 segundos.
Após cada INSERT no PostgreSQL, os dados são copiados
imediatamente para o MySQL. O CRON garante consistência em
caso de falha pontual na sincronização direta.
Latência: próxima de zero na inserção; máximo 10s no CRON.

## Estratégia de Fallback (Tolerância a Falhas)

- Se o MySQL (Banco 3) cair: GET /painel detecta o erro e
  redireciona automaticamente para o PostgreSQL, retornando
  `{ degradado: true }` para o frontend exibir um banner laranja.
- Se o PostgreSQL (Banco 2) cair: POST /triagem retorna 503
  e o frontend desabilita o botão de cadastro exibindo
  "Sistema de cadastro indisponível". Login e painel continuam.

## Simular queda dos bancos (Sprint 4)

Para testar o fallback em apresentação, desabilite temporariamente
a conexão no Railway ou Supabase painel, ou bloqueie a porta no
firewall local.
