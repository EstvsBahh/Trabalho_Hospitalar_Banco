# Trabalho_Hospitalar_Banco

## Descrição

Projeto desenvolvido para a disciplina de Banco de Dados II.

A aplicação utiliza:

- Firebase Authentication
- API Node.js com Express
- PostgreSQL como banco de escrita
- MySQL como banco de leitura

---

## Arquitetura

Firebase → API Node.js → PostgreSQL → sincronização automática → MySQL

---

## Método de Sincronização

O método escolhido foi sincronização através da lógica da própria API.

Após o cadastro de um paciente no PostgreSQL, a API executa automaticamente um INSERT simplificado no MySQL.

Esse modelo foi escolhido por:

- simplicidade de implementação;
- baixa latência;
- facilidade de manutenção;
- demonstração clara da separação entre escrita e leitura.

---

## Fluxo da Aplicação

1. Usuário realiza login via Firebase
2. API valida o token JWT
3. Dados são salvos no PostgreSQL
4. API sincroniza automaticamente no MySQL
5. Painel realiza consultas apenas no banco de leitura

---

## Tecnologias Utilizadas

- Node.js
- Express
- Firebase Authentication
- PostgreSQL
- MySQL
- Thunder Client

---

## Demonstração

Durante a demonstração:

- o paciente é cadastrado via API;
- o dado é salvo no PostgreSQL;
- a sincronização automática ocorre;
- o dado aparece no MySQL.
