# Trabalho_Hospitalar_Banco

----Estrutura da Arquitetura----

Banco 1 (Firebase): Usado apenas para Autenticação. O enfermeiro faz login aqui para receber um token que permite salvar dados no Banco 2

Banco 2 (Escrita - Postgress): Onde os dados completos do paciente (sintomas, pressão, classificação de risco) são salvos.

Banco 3 (Leitura - MySQL): Um banco mais simples que contém apenas o necessário para a TV da sala de espera: Nome do paciente e número do consultório.


----Cronograma de Desenvolvimento----

Sprint 1: Modelagem e Login

Sprint 2: O CRUD

Sprint 3: Sincronização Automática

Sprint 4: Front-end e Resiliência


---- Por que PostgreSQL para escrita? ----

O PostgreSQL foi escolhido por suportar o tipo JSONB, que permite
armazenar sinais vitais (pressão, temperatura, SpO2) de forma
flexível sem criar colunas fixas. Também oferece suporte nativo
a transações ACID, essencial para dados hospitalares.

---- Por que MySQL para leitura? ----
O MySQL foi escolhido para o banco de leitura por ser leve e
rápido em operações SELECT simples. O painel de TV só precisa
exibir nome e consultório — não há necessidade de JSONB ou
transações complexas.

---- Sincronização (Consistência Eventual) ----

Método: sincronização direta na camada da API.
Após cada INSERT no PostgreSQL (Banco 2), a rota POST /triagem
executa automaticamente um INSERT no MySQL (Banco 3), replicando
apenas nome, senha e consultório.
Latência: próxima de zero — adequada para um painel hospitalar.

---- Estratégia de Fallback (Tolerância a Falhas) ----
- Se o MySQL (Banco 3) cair: o GET /painel detecta o erro e
  redireciona automaticamente para o PostgreSQL, retornando
  { degradado: true } para o frontend exibir um banner de aviso.
- Se o PostgreSQL (Banco 2) cair: o POST /triagem retorna 503
  e o frontend desabilita o botão de cadastro exibindo
  "Sistema de cadastro indisponível".

---- Rotas da API ----

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /login | Autenticação Firebase |
| POST | /triagem | Cadastrar paciente (protegida) |
| PUT | /triagem/:id | Atualizar atendimento (protegida) |
| GET | /painel | Painel TV com fallback |
| GET | /fila | Pacientes aguardando |
| GET | /consultorios | Lista consultórios |
| GET | /resumo | Contagem por status |
| GET | /consistencia | Validação dos dados sincronizados |
| GET | /pacientes | Listar PostgreSQL |
