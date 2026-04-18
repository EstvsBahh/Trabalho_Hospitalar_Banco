--tabela escrita - Projeto 5
CREATE TABLE pacientes_triagem (
    id_atendimento SERIAL PRIMARY KEY,
    nome_completo VARCHAR(150) NOT NULL,
    cpf VARCHAR(11) UNIQUE NOT NULL,
    data_nascimento DATE NOT NULL,
    sintomas TEXT,
    sinais_vitais JSONB, 
    classificacao_risco VARCHAR(20) NOT NULL,
    consultorio_destino INT,
    status_atendimento VARCHAR(30) DEFAULT 'Aguardando',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO pacientes_triagem (nome_completo, cpf, data_nascimento, sintomas, classificacao_risco, consultorio_destino)
VALUES ('Bárbara', '12345678912', '2007-03-19', 'Dor de cabeça', 'Verde', 1);