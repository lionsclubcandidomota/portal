# Registro técnico — Portal v6.46.4

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

## v6.45.0 — novo ciclo, etapa 1

- O controle de atualização foi deslocado para o rodapé da navegação sem alterar seu controlador.
- Dashboard e Dirigentes compartilham a classe `institutional-banner`, com marca d’água e composição responsiva.
- `public-leadership.js` agora oferece projeção pública por Ano Leonístico e lista somente anos atuais ou anteriores.
- A projeção histórica continua sem acesso a `portalUsers` ou permissões.
- A lista pública de aniversariantes fixa o mês corrente; administradores preservam os filtros completos.
- O sprite SVG local foi ampliado para evitar emojis funcionais nas telas revisadas.

## v6.46.0 — novo ciclo, etapa 2 final

- O Painel de Publicação passa a usar uma composição própria, com estado, contagem, progresso e etapas claramente separadas.
- `treasury-mobile.css` concentra as adaptações da Tesouraria para telas estreitas sem alterar a regra de negócio.
- `mutual-registration.css` estabiliza o seletor de participantes e diferencia associado de mutuário.
- O sprite local recebe os ícones adicionais usados por publicação, gráficos, anexos, famílias e privacidade financeira.
- Os módulos financeiros e administrativos revisados deixam de depender de emojis para ações e estados.
- Os limites de CSS e ativos críticos foram recalibrados para contemplar a camada responsiva, mantendo auditorias impeditivas.
- O esquema permanece em 12 e não existe migração de dados.

### Encerramento do ciclo

- etapas planejadas neste ciclo: 2;
- etapas concluídas: 2;
- etapas pendentes: 0.


## v6.46.1 — experiência de acesso e memória institucional

- O gerenciador de acessos passou a usar seções recolhíveis com estado preservado durante a sessão do modal.
- O histórico por Ano Leonístico ganhou accordions próprios e retratos responsivos dos associados.
- A consulta pública passou a preservar dirigentes históricos mesmo quando o cadastro atual está inativo.
- A navegação pública por períodos anteriores ficou explícita, sem expor credenciais ou permissões.
- A mensagem redundante sobre aniversariantes do mês foi removida, mantendo a regra funcional.

## v6.46.2 — estabilização de Mútuas e navegação financeira móvel

- O modal de grupos deixa de consultar `#mutualSelectedCount`, identificador já usado pela seleção de cobranças da Mútua. A nova referência é local ao formulário, evitando colisões no DOM.
- `view-shell.js` mantém o contêiner `.treasury-experience` aberto até o encerramento real da tela, permitindo que as regras responsivas atinjam todos os painéis.
- A navegação financeira móvel deixa de ser um carrossel horizontal e passa a exibir as quatro áreas em grade 2 × 2.
- O formulário de falecimento apresenta uma projeção responsiva dos participantes antes da confirmação.
- O orçamento de CSS foi ajustado de 440 KB para 445 KB, mantendo limite impeditivo e acomodando a correção responsiva.
- Esquema de dados preservado em 12; nenhuma migração operacional foi adicionada.
## v6.46.3 — correção estrutural dos modais de Mútuas

- `modal.js` normaliza a rolagem do modal, corpo e cartão sempre que o conteúdo é aberto ou substituído.
- O seletor de participantes passa a usar linhas com altura mínima estável, evitando compressão provocada por combinações de grid e overflow.
- A prévia do falecimento deixa de limitar a lista aos oito primeiros registros e passa a renderizar todos os participantes.
- A área de participantes força ocupação integral da grade e usa rolagem interna apenas quando necessária.
- As alterações são exclusivamente de interface e controle de estado; o esquema permanece em 12 e nenhum dado é migrado.
## v6.46.4 — largura integral da prévia de participantes

- Neutraliza `justify-content: space-between` e alinhamentos herdados da implementação antiga em flexbox.
- Define uma coluna estrutural de largura integral para o contêiner da prévia.
- Faz resumo e lista usarem `width: 100%`, sem limite máximo residual.
- Mantém duas colunas flexíveis no desktop e uma coluna em telas pequenas.
## v6.46.5 — estabilização do release

- `data/modelo.json` passa a acompanhar o esquema 12 usado pelo Portal.
- `release-audit.mjs` valida dados oficiais e modelo de instalação.
- O manifesto é regenerado a partir da árvore real do projeto, incluindo mídias e miniaturas atuais.
- O finalizador consulta a versão diretamente do `package.json`, evitando mensagens obsoletas.
- A arquitetura fica temporariamente congelada: novas alterações estruturais devem ser justificadas por uma necessidade funcional mensurável.
- Evoluções visuais devem preferir correções locais e remoção de regras antigas em vez de novas camadas globais de sobrescrita.

