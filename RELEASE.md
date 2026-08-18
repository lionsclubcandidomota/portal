# Portal Lions v6.46.7

> Versão de consolidação do ciclo 6.46.x e ponto de partida para a refatoração técnica incremental do Portal.

## Objetivo

A versão 6.46.7 sincroniza a identificação do pacote com o código efetivamente distribuído e restabelece uma base de release verificável antes das próximas refatorações. Ela preserva a **estabilização do pacote** iniciada na v6.46.5, sem reabrir regras funcionais já consolidadas.

- sincroniza `package.json`, cache-busters `?v=`, CSS gerado e documentação para **6.46.7**;
- regenera `release-manifest.json` a partir do conteúdo real do pacote;
- preserva integralmente `data/dados.json` e `data/modelo.json`;
- mantém o esquema de dados na versão **12**;
- mantém o workflow próprio do GitHub Pages com Actions compatíveis com Node.js 24;
- mantém obrigatória a auditoria de mídia para impedir releases com miniaturas de associados ausentes;
- não altera regras financeiras, permissões, usuários, cargos, dirigentes, agenda, avisos ou publicação.

## Refatoração técnica concluída — etapa 4

Além da higiene de release e da consolidação CSS, esta base utiliza a auditoria corrigida do grafo JavaScript. O carregamento inicial passou de **378.503 bytes para 301.158 bytes** na métrica real, que inclui reexports estáticos.

Ficam fora do bootstrap e são carregados somente quando necessários: Central de Recuperação, interface completa do Painel de Publicação, interface do Histórico de Alterações, operações administrativas do GitHub, preparação de mídia para publicação e interface da revisão de alterações.

A etapa 4 encerra o ciclo com uma auditoria dedicada de lazy loading. O pipeline valida **19 imports dinâmicos/pontos de entrada** e protege **24 módulos** contra retorno acidental ao carregamento inicial, além de exigir o `?v=` sincronizado com a versão do pacote.

Os orçamentos oficiais finais são **315.000 bytes** para JavaScript estático, **435.000 bytes** para CSS e **785.000 bytes** para ativos críticos. A estabilização não altera o esquema 12 nem o conteúdo operacional dos arquivos oficiais de dados.

## Compatibilidade de dados

- Esquema atual: **12**.
- `data/dados.json`: preservado byte a byte nesta etapa.
- `data/modelo.json`: preservado byte a byte nesta etapa.
- Nenhuma movimentação, cobrança, grupo, usuário, cargo, dirigente, associado ou mídia é alterado pela higiene do release.

## Pipeline de release

O pipeline oficial continua sendo:

```cmd
npm run release:prepare
```

Ele executa backup local, migração idempotente, geração do CSS, portões de qualidade, manifesto, auditoria do release e verificação final do manifesto.

A validação direta do pacote pode ser executada por:

```cmd
npm run release:check
```

## Homologação

A auditoria visual automatizada permanece disponível por:

```cmd
npm run audit:visual:required
```

A revisão manual deve seguir `docs/homologation.md`, priorizando Tesouraria, Mútuas, Usuários e cargos, Dirigentes, Agenda inicial e Painel de Publicação em desktop e mobile.

## Política após a etapa 4

O ciclo de refatoração v6.46.7 fica encerrado nesta base. Evoluções posteriores devem ser incrementais e mensuráveis, preservando os orçamentos de CSS/JavaScript e os contratos de lazy loading. Qualquer ampliação de orçamento deve ser justificada por uma necessidade funcional concreta e acompanhada de testes de regressão.

### Refatoração pós-movimentações — etapa 2

A Tesouraria passa a usar um domínio único para Entrada, Saída e Transferência. Transferências são exibidas e contabilizadas como uma operação lógica, preservando os dois lançamentos internos necessários ao saldo das contas sem inflar receitas/despesas do clube.

### Refatoração pós-movimentações — etapa 3

O ciclo de consolidação da Tesouraria é encerrado com regressões específicas de Entrada, Saída e Transferência. A construção e a remoção do par contábil da transferência passam a usar contratos únicos, a exclusão possui rollback em caso de falha de persistência e o módulo administrativo lazy é validado por import direto. A operação continua alterando apenas os saldos das contas envolvidas, sem compor receita, despesa ou resultado financeiro geral. O esquema permanece na versão 12 e os arquivos oficiais de dados não são migrados.
