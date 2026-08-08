# Portal Lions v6.46.5

> Versão de estabilização do pacote v6.46.4. Não adiciona funcionalidades nem altera as regras operacionais do Portal.

## Objetivo

A versão 6.46.5 corrige inconsistências do pacote de distribuição antes de novas evoluções:

- atualiza `data/modelo.json` do esquema 7 para o esquema 12;
- mantém `data/dados.json` integralmente preservado;
- regenera o manifesto com todos os arquivos atuais, inclusive imagens e miniaturas;
- torna a auditoria do release responsável por validar tanto os dados oficiais quanto o modelo de instalação;
- elimina a versão antiga fixa na mensagem do finalizador;
- documenta a homologação visual prioritária e o congelamento temporário da arquitetura.

## Compatibilidade de dados

- Esquema atual: **12**.
- `data/dados.json`: não modificado nesta versão.
- `data/modelo.json`: migrado de forma idempotente para o esquema 12.
- Nenhuma movimentação, cobrança, grupo, usuário, cargo, dirigente, associado ou mídia é alterado.

## Pacote incremental

A atualização incremental inclui `data/modelo.json`, pois esse é um dos arquivos corrigidos. Ela não inclui:

- `data/dados.json`;
- fotos, miniaturas ou outros arquivos da pasta `public`.

## Homologação

O pipeline executa testes, auditorias de módulos, integração, CSS, acessibilidade, segurança, desempenho, mídia, dados e manifesto.

A auditoria visual automatizada permanece disponível por:

```cmd
npm run audit:visual:required
```

Caso o navegador da estação não seja compatível, a revisão manual deve seguir `docs/homologation.md`, priorizando Tesouraria móvel, Mútuas, Usuários e cargos, Dirigentes e Painel de Publicação.

## Política após esta versão

A arquitetura fica congelada temporariamente. Novas versões devem priorizar correções pontuais e evitar novas camadas gerais de CSS ou reestruturações de módulos sem uma justificativa funcional e testes de regressão correspondentes.
