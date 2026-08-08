# Estabilização técnica — Portal v6.46.5

## Escopo

Esta versão saneia o pacote de distribuição sem alterar o comportamento operacional do Portal.

## Alterações controladas

- `data/modelo.json` migrado para o esquema 12.
- `data/dados.json` preservado byte a byte em relação ao backup-base.
- Manifesto regenerado a partir da árvore atual do projeto.
- Auditoria ampliada para validar ambos os arquivos de dados.
- Finalizador passou a mostrar a versão obtida do `package.json`.

## Arquitetura congelada

Até nova decisão explícita, ficam congelados:

- o esquema de módulos JavaScript;
- a composição geral do bundle CSS;
- o modelo de persistência em `data/dados.json`;
- o fluxo de publicação pelo GitHub;
- as regras de Tesouraria, Mútuas, usuários, cargos e dirigentes.

Novas correções devem preferir alterações locais, preservar compatibilidade e incluir teste de regressão.

## Homologação prioritária

- Tesouraria em 360 e 390 px;
- gerenciamento e registro de falecimento em Mútuas;
- Usuários e cargos;
- histórico e área pública de Dirigentes;
- Painel de Publicação.
