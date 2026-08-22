# Registro técnico — Portal v6.46.7

## v6.49.1 — conta padrão para mensalidades

A configuração da conta de recebimento padrão foi incorporada ao próprio cadastro de `treasuryAccounts`, usando a propriedade opcional `membershipDefault`. Não foi criado estado paralelo: o controller resolve a conta padrão entre as contas ativas e mantém fallback para a primeira conta ativa em bases legadas. A propriedade também participa da revisão de publicação.

## v6.47.0 — consolidação do design system e refinamento global

Esta etapa é uma refatoração visual controlada, sem reescrita dos fluxos funcionais. A revisão identificou três camadas que voltavam a declarar os mesmos tokens e um volume relevante de regras antigas ainda presentes apenas para serem sobrescritas por estilos mais novos.

- `tokens.css` passa a ser a fonte única dos tokens globais de cor, superfície, tipografia, espaçamento estrutural, raios, sombras, foco, dimensões e z-index;
- `interaction-foundation.css` e `interface-polish.css` deixam de redeclarar tokens que já pertencem ao design system;
- `modern-interface.css` assume a linguagem visual consolidada para shell, navegação, topbar, heros, cards, KPIs, formulários, botões, tabelas, badges e estados vazios;
- declarações antigas totalmente sombreadas foram removidas de `application-shell.css`, `layout.css`, `core.css`, `responsive-workflows.css`, `interface-polish.css`, `responsive.css`, `responsive-guardrails.css`, `native-charts.css` e `memberships.css`;
- o Dashboard mantém duas colunas de KPIs nas larguras móveis intermediárias e volta para uma coluna somente em telas menores;
- nenhuma classe funcional, regra financeira, contrato JavaScript ou estrutura de dados foi reescrita.

### Métricas da consolidação

- regras CSS auditadas: 4.559 → 4.539;
- seletores redefinidos no mesmo contexto: 340 → 334;
- sobrescritas: 437 → 417;
- duplicatas exatas: 0 → 0;
- fontes legadas: 0 → 0;
- bundle CSS: 421.984 → aproximadamente 420.971 bytes;
- orçamento CSS: mantido em 422.000 bytes.

O objetivo desta etapa é reduzir a dívida de cascata e tornar as próximas evoluções visuais menores e previsíveis. O esquema permanece em 12 e os arquivos oficiais de dados devem permanecer byte a byte inalterados.

## Consolidação pós-movimentações — Etapa 1 (CSS)

- Removidas 700 declarações CSS totalmente sobrescritas pelo mesmo seletor/contexto/propriedade.
- Bundle CSS reduzido de 442.072 para 425.011 bytes sem alteração funcional.
- Orçamento preventivo reduzido para 430.000 bytes de CSS e 775.000 bytes de ativos críticos.
- Dados oficiais preservados byte a byte.


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



## v6.46.7 — novo ciclo de refatoração, etapa 1

### Higiene do release

- A versão declarada no `package.json`, nos cache-busters `?v=`, no CSS gerado e na documentação passa a ser 6.46.7.
- Os testes de contrato deixam de fixar uma versão histórica e passam a validar dinamicamente a versão declarada pelo pacote.
- O manifesto é regenerado a partir da árvore real da versão antes da validação final.
- `data/dados.json` e `data/modelo.json` são preservados byte a byte nesta etapa.
- Nenhuma regra funcional, permissão, coleção ou mídia é alterada.

### Próximas etapas

1. consolidar CSS redundante e recuperar margem no orçamento do bundle;
2. corrigir a auditoria de desempenho para seguir também reexports estáticos;
3. reduzir o grafo JavaScript inicial por carregamento sob demanda, sem quebrar os contratos existentes;
4. recalibrar os limites somente depois de medir a nova base.

## v6.46.7 — novo ciclo de refatoração, etapa 2

### Consolidação CSS conservadora

- Foram removidas somente regras integralmente substituídas por outra ocorrência posterior do mesmo seletor no mesmo contexto (`@media`, `@supports`, `@container` ou `@layer`).
- Nenhuma regra parcialmente complementar foi mesclada nesta etapa, reduzindo o risco de alteração visual da cascata.
- Regras CSS: 4.602 → 4.381.
- Seletores redefinidos: 438 → 330.
- Sobrescritas: 617 → 426.
- Bundle CSS: 445.734 → 428.408 bytes.
- A quantidade de fontes permanece em 33; a etapa reduz dívida técnica sem introduzir uma nova camada de estilos.
- Os novos limites do auditor impedem que o ganho obtido seja perdido silenciosamente em versões futuras.

### Próximas etapas

1. corrigir a auditoria de desempenho para seguir também reexports estáticos;
2. reduzir o grafo JavaScript inicial por carregamento sob demanda;
3. estabilizar e recalibrar os limites finais após a nova medição completa.

## v6.46.7 — novo ciclo de refatoração, etapa 3

### Auditoria real do JavaScript e carregamento sob demanda

- `performance-audit.mjs` passa a seguir tanto imports estáticos quanto reexports `export ... from`.
- A medição correta da base da etapa 2 revelou 71 módulos estáticos e 378.503 bytes de JavaScript no grafo inicial.
- A revisão de publicação foi separada em domínio (`publication-review-domain.js`) e interface (`publication-review.js`), preservando o cálculo no núcleo e deixando a interface sob demanda.
- A Central de Recuperação deixa o bootstrap e passa a ser inicializada quando a área administrativa é carregada ou quando uma operação crítica exige snapshot.
- O Painel de Publicação passa a usar um controlador lazy e só carrega sua implementação completa quando existe perfil com permissão de escrita.
- A interface do Histórico de Alterações passa a ser carregada somente ao abrir o histórico.
- A integração com GitHub foi separada em configuração, leitura pública e operações administrativas; autenticação/escrita permanecem fora do grafo inicial.
- A preparação de mídia para publicação também passa a ser carregada apenas no momento de publicar.
- Resultado: 66 módulos estáticos e 301.158 bytes no grafo inicial, redução de 77.345 bytes (aprox. 20,4%) sobre a medição correta.
- Ativos críticos passaram de 844.725 para 767.380 bytes mantendo o mesmo CSS e logotipo.
- O novo orçamento impede regressão acima de 315.000 bytes de JavaScript estático e 785.000 bytes de ativos críticos.

### Próxima etapa

1. estabilizar a base após as refatorações de CSS e JavaScript;
2. revisar contratos, documentação e limites finais;
3. executar a homologação completa e encerrar o ciclo sem alterar o esquema de dados.

## v6.46.7 — novo ciclo de refatoração, etapa 4

### Estabilização final e contratos de qualidade

- O parser de dependências JavaScript passa a ser compartilhado pelas auditorias de módulo e desempenho, evitando métricas divergentes para imports, reexports e imports dinâmicos.
- Os orçamentos de desempenho e as fronteiras de carregamento sob demanda ficam centralizados em `tools/quality-contracts.mjs`.
- A nova auditoria `audit:lazy` valida todos os imports dinâmicos locais, exige o cache-buster da versão atual e impede que módulos protegidos retornem ao bootstrap.
- A base final protege 19 entradas lazy e 24 módulos fora do carregamento inicial.
- Os orçamentos finais permanecem em 315.000 bytes de JavaScript estático, 435.000 bytes de CSS e 785.000 bytes de ativos críticos.
- O ciclo v6.46.7 é encerrado sem alterar o esquema 12, os arquivos oficiais de dados ou regras funcionais do Portal.

### Política após o encerramento

- Novas evoluções devem respeitar os portões de CSS, desempenho e lazy loading antes de ampliar qualquer orçamento.
- Um módulo pesado só deve voltar ao bootstrap quando houver necessidade funcional mensurável e justificativa registrada.
- Alterações estruturais futuras devem ser feitas em ciclos curtos, preservando os contratos definidos nesta estabilização.

## v6.46.7 — refatoração pós-movimentações, etapa 2

### Domínio unificado de Entrada, Saída e Transferência

- `treasury/movement-domain.js` passa a ser a fonte única para identificar o tipo lógico da operação, seu valor, rótulo, chave lógica e separação entre resultado financeiro e transferência interna.
- `treasury/movement-transfer-domain.js` concentra o pareamento dos dois lançamentos contábeis de uma transferência e sua consolidação em uma única operação de interface.
- Formulário, normalização, edição, exclusão, histórico e status passam a reutilizar essas regras em vez de inferências locais repetidas.
- Lançamentos antigos sem `movementKind` continuam classificados por `entry`/`exit`, preservando compatibilidade com o histórico existente.
- Transferências continuam movimentando corretamente o saldo de cada conta, porém deixam de inflar receitas, despesas, gráficos de fluxo e resultado financeiro geral.
- O Histórico Financeiro ganha filtro exclusivo de Transferências; filtros de Entradas e Saídas não incluem mais os lados contábeis internos da transferência.
- Paginação, indicadores e quantidade de operações tratam o par origem/destino como uma única movimentação lógica.
- O domínio básico permanece pequeno no bootstrap e o pareamento completo fica junto da Tesouraria carregada sob demanda.
- Novos testes protegem classificação, pareamento, neutralidade financeira e compatibilidade das três operações.

## v6.46.7 — refatoração pós-movimentações, etapa 3

### Estabilização e integridade das movimentações

- A etapa encerra o ciclo iniciado após a criação das três operações explícitas: Entrada, Saída e Transferência.
- `treasury/movement-transfer-domain.js` passa a construir o par contábil da transferência e a resolver todos os IDs físicos pertencentes à operação lógica.
- Edição de transferência preserva os IDs dos dois lados quando o par já existe; criação mantém IDs distintos e um mesmo `transferGroupId`.
- Exclusão reutiliza a mesma resolução lógica e remove origem/destino em conjunto. Se `persist()` falhar, o estado anterior é restaurado antes de informar o erro.
- `treasury-admin/domain.js` centraliza o status da transferência para diferenciar efetivada, programada e vencida sem tratar o débito/crédito interno como receita ou despesa.
- Foi corrigido o import de `transferEntriesFor` no módulo lazy `entity-forms.js`; uma regressão agora importa esse módulo diretamente para impedir falhas semelhantes fora do bootstrap.
- As regressões verificam conta de origem diferente da conta de destino, valor obrigatório, simetria do par, preservação de IDs, anexos, neutralidade financeira, saldos atuais e projetados e consolidação em uma única operação de interface.
- Nenhum orçamento de CSS ou JavaScript foi ampliado e não há migração de dados nesta etapa.

### Fechamento do ciclo

- Entrada, Saída e Transferência ficam estabilizadas como operações lógicas distintas.
- Novas evoluções na Tesouraria devem reutilizar `movement-domain.js` e `movement-transfer-domain.js`, evitando voltar a inferir tipos diretamente pelos campos `entry`/`exit` fora da camada de compatibilidade.
- Alterações futuras em transferências devem preservar a regra contábil: dois lançamentos internos para os saldos das contas, uma operação para a interface e zero impacto em receitas/despesas gerais.

## Complemento visual — 2026-08-21

- Ajustado o layout do extrato de mensalidades, compactando os blocos de saldo anterior e pagamentos vinculados.
- Reforçada a diferenciação visual entre os status Quitado, Pendente e Parcial na listagem de mensalidades e no extrato.
