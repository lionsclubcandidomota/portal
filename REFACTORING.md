# Registro técnico — Portal v6.44.1

## Ciclos concluídos

A refatoração estrutural das versões 6.29.0 a 6.36.0 permanece concluída. O ciclo funcional das versões 6.37.0 a 6.44.0 também está encerrado, com todas as oito etapas entregues.

## Etapas 1 a 5

- **v6.37.0:** tela inicial, cabeçalho autenticado e tipografia configurável;
- **v6.38.0:** preservação de tela, rolagem, filtros e reorganização de Ajustes e publicação;
- **v6.39.0:** eventos on-line sem link obrigatório, parabenizações públicas e acesso administrativo simplificado;
- **v6.40.0:** modernização da Tesouraria, gráficos interativos, programados recolhíveis e cobrança familiar;
- **v6.41.0:** participantes das Mútuas e listas recolhidas no gerenciamento de famílias.

## Etapa 6 — usuários, cargos e permissões

A v6.42.0 criou `accessRoles` e `portalUsers`, vinculando acessos individuais aos associados. As senhas são derivadas por PBKDF2-SHA-256, nunca armazenadas em texto. A política central de autorização continua protegendo publicação, importação, recuperação e gerenciamento de acessos.

## Etapa 7 — histórico por Ano Leonístico

A v6.43.0 criou `leadershipAssignments`. Cada registro preserva associado, cargo, Ano Leonístico, início, fim e situação. O cargo efetivo é calculado pela vigência, e a troca de cargo não apaga o histórico anterior.

## v6.44.0 — Etapa 8

### Projeção pública

O módulo `leaders.js` cria uma projeção somente de leitura da diretoria vigente. Ele reutiliza:

- `birthdays` para nome e fotografia do associado;
- `accessRoles` para o nome do cargo;
- `leadershipAssignments` para Ano Leonístico e vigência.

A projeção não consulta `portalUsers` e não expõe credenciais, números de associado, permissões ou observações internas.

### Homologação integrada

O módulo `integrated-homologation.mjs` valida o esquema, referências, períodos, duplicidades e disponibilidade da rota pública. O relatório é gravado em `artifacts`, fora do Git. A auditoria visual inclui Dirigentes e passa a verificar os cartões da diretoria em 30 cenários responsivos.

### Estabilização

- esquema mantido em 12;
- nenhuma coleção operacional é migrada ou regravada nesta etapa;
- contratos públicos do módulo de Dirigentes são validados pelo pipeline;
- a finalização continua criando backup local antes de qualquer normalização;
- o pacote incremental continua excluindo `data` e `public`.

## v6.44.1 — correções pós-homologação

- A política de rotas passa a aceitar tanto o modelo de sessão (`accessRole`) quanto o snapshot consumido pela navegação (`role`).
- O formulário de designação usa um padrão HTML sem escapes ambíguos para o Ano Leonístico.
- Foram adicionados testes de regressão para navegação autenticada e para o formato `AAAA/AAAA`.
- O esquema permanece em 12 e os dados não são modificados.

## Planejamento atualizado

- etapas concluídas neste ciclo: 8 de 8;
- etapas pendentes: 0;
- ciclo funcional concluído.
