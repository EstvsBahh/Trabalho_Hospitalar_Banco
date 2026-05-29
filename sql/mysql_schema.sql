-- =====================================================
-- BANCO 3: MySQL (Leitura / Painel TV)
-- Execute: mysql -u root -p < mysql_schema.sql
-- =====================================================

CREATE DATABASE IF NOT EXISTS triagem_read;
USE triagem_read;

-- Tabela simplificada apenas para o painel público
-- Recebe os dados copiados do PostgreSQL via sincronização
CREATE TABLE painel_chamadas (
    id              INT PRIMARY KEY,
    nome_paciente   VARCHAR(100),
    consultorio     INT,
    classificacao   VARCHAR(10),
    status          VARCHAR(20),
    atualizado_em   DATETIME
);

-- Nenhum dado inicial aqui - vem do sync automático
