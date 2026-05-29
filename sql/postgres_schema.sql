-- =====================================================
-- BANCO 2: PostgreSQL (Escrita / Transacional)
-- Execute: psql -U postgres -f postgres_schema.sql
-- =====================================================

-- Criar banco
CREATE DATABASE triagem_write;
\c triagem_write;

-- Tabela de pacientes
CREATE TABLE pacientes (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(100) NOT NULL,
    cpf         VARCHAR(14),
    criado_em   TIMESTAMP DEFAULT NOW()
);

-- Tabela de atendimentos (prontuário completo)
CREATE TABLE atendimentos (
    id              SERIAL PRIMARY KEY,
    paciente_id     INT REFERENCES pacientes(id),
    sintomas        TEXT,
    pressao         VARCHAR(20),
    temperatura     DECIMAL(4,1),
    saturacao       INT,
    classificacao   VARCHAR(10) CHECK (classificacao IN ('vermelho','amarelo','verde')),
    consultorio     INT,
    status          VARCHAR(20) DEFAULT 'aguardando',
    criado_em       TIMESTAMP DEFAULT NOW(),
    atualizado_em   TIMESTAMP DEFAULT NOW()
);

-- Dados iniciais para teste
INSERT INTO pacientes (nome, cpf) VALUES
    ('João Silva', '111.111.111-11'),
    ('Maria Souza', '222.222.222-22'),
    ('Carlos Oliveira', '333.333.333-33');

INSERT INTO atendimentos (paciente_id, sintomas, pressao, temperatura, saturacao, classificacao, consultorio, status) VALUES
    (1, 'Dor no peito, falta de ar', '140/90', 38.5, 94, 'vermelho', 1, 'aguardando'),
    (2, 'Febre alta há 2 dias', '120/80', 39.2, 97, 'amarelo', 2, 'aguardando'),
    (3, 'Consulta de rotina', '110/70', 36.8, 99, 'verde', 3, 'aguardando');
