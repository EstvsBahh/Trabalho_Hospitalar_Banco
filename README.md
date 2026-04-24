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


----
