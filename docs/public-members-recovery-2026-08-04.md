# Recuperação dos associados públicos — backup de 04/08/2026

## Fonte

A recuperação foi produzida a partir de um `dados.json` com atualização em `2026-08-04T15:02:49.013Z`, esquema público 11.

## Conteúdo usado

- 32 cadastros públicos;
- 29 com status Ativo;
- 3 com status Mútua.

Foram usados somente os campos públicos necessários ao Portal:

- `id`;
- `memberNumber`;
- `name`;
- `birthDate`;
- `photo`;
- `status`;
- `active`.

Observações financeiras ou administrativas do backup não foram incluídas na migração.

## Estratégia

A migração `0011_recover_public_members_20260804.sql` é aditiva:

- insere registros ausentes;
- preserva registros atuais com o mesmo ID;
- restaura nascimento e foto quando esses campos estão vazios;
- preserva campos adicionais já existentes no payload do D1;
- não executa exclusão do diretório;
- não consulta nem altera tabelas financeiras.

## Fotografias

O backup contém referências de caminhos, não os arquivos binários. Quando uma fotografia não estiver no R2, o Worker retorna um avatar neutro. A imagem original somente poderá ser recuperada de um backup que contenha o arquivo correspondente.
