# Changelog

## 6.46.0 — Sincronização automática por módulo no D1

- Cria a migração `0009_module_revisions.sql` e eleva o esquema D1 para a versão 8.
- Adiciona revisões independentes para referências, grupos, Tesouraria, Mensalidades, Mútuas e diretório de associados.
- Cria `GET /api/sync/revisions` para detectar alterações sem transferir coleções completas.
- Cria `GET /api/operational/reference` e `GET /api/operational/groups` para atualizar somente os módulos alterados.
- O Portal verifica novidades a cada 45 segundos, ao retornar para a aba, ao focar a janela e ao trocar de área.
- Movimentações, Mensalidades e Mútuas invalidam apenas seus caches paginados e consultam novamente o D1.
- Contas, categorias, configurações e grupos são incorporados ao estado atual sem recarregar a página inteira.
- A sincronização é adiada enquanto houver formulário aberto, salvamento privado ou publicação local pendente.
- Atualiza o Worker para 1.12.0 e o `/health` passa a informar `automaticSync` e esquema D1 8.
- Adiciona testes reais em SQLite para revisões por módulo, atualização seletiva e sincronização sem `F5`.

## 6.45.0 — Login privado reduzido e referências granulares no D1

- Cria a migração `0008_private_bootstrap_reference.sql` e eleva o esquema D1 para a versão 7.
- Adiciona `GET /api/private-state/bootstrap`, que carrega configurações, contas, categorias, grupos e somente o conjunto financeiro necessário para Mensalidades e Mútuas.
- O login administrativo deixa de reconstruir e transferir todas as movimentações ordinárias do banco para o navegador.
- Movimentações exibidas nas páginas operacionais são hidratadas sob demanda e incorporadas ao cache seguro da sessão para edição e exclusão.
- Adiciona `PUT /api/private-state/reference` para gravar configurações privadas, contas e categorias sem regravar grupos ou movimentações.
- O salvamento automático passa a cobrir granularmente Tesouraria, grupos e referências; sincronização completa fica restrita a importação, restauração e contingência.
- Mantém no conjunto inicial os pagamentos de Mensalidades e Mútuas necessários para validação de duplicidade e formulários de baixa.
- Preserva fallback para o estado privado completo durante a implantação enquanto o esquema 7 ainda não estiver ativo.
- Atualiza o Worker para 1.11.0 e o `/health` passa a informar `privateBootstrap`, `optimizedReads.privateBootstrap` e `granularWrites.reference`.
- Adiciona testes reais em SQLite para o bootstrap reduzido, preservação das tabelas não alteradas e gravação granular das referências.

## 6.44.0 — Mensalidades e Mútuas com leituras operacionais paginadas no D1

- Cria a migração `0007_operational_memberships_mutuals.sql` e eleva o esquema D1 para a versão 6.
- Adiciona a projeção relacional `portal_members` para associar os dados públicos dos associados às consultas financeiras privadas.
- Cria `GET /api/operational/memberships` com período, pesquisa, grupo familiar, situação, paginação e totais calculados no banco.
- Cria `GET /api/operational/mutuals` com grupo, período, pesquisa, situação e paginação por evento de falecimento.
- A tela de Mensalidades passa a identificar `D1 · consulta paginada` e carrega somente os associados da página atual.
- A tela de Mútuas passa a identificar `D1 · eventos paginados` e carrega somente os eventos necessários, preservando participantes e cobranças do recorte.
- O diretório de associados é atualizado após publicações públicas e possui sincronização diária/fallback protegido pelo Worker.
- Mantém fallback local automático quando uma consulta operacional estiver temporariamente indisponível.
- Preserva a seleção de cobranças somente dentro do recorte válido e limpa seleções ao mudar a página de eventos.
- Adiciona índices restritos às consultas reais de mensalidades, eventos e pagamentos de Mútuas e executa `PRAGMA optimize`.
- Atualiza o Worker para 1.10.0 e o `/health` passa a informar leituras operacionais de Mensalidades, Mútuas e estado do diretório de associados.
- Adiciona testes reais em SQLite para paginação, totais, filtros, eventos, pagamentos e cliente autenticado.

## 6.43.0 — Tabelas relacionais como fonte operacional e paginação no D1

- Cria a migração `0006_relational_operational_source.sql` e eleva o esquema D1 para a versão 5.
- Tabelas relacionais passam a ser a fonte principal do estado privado carregado após o login.
- Reconstrói grupos familiares, vínculos de Mútuas, eventos, participantes e anexos a partir de seus relacionamentos no banco.
- Cria `GET /api/operational/treasury` com pesquisa, filtros, somatórias e páginas independentes para programados e realizados.
- A tela de Movimentações passa a consultar somente a página necessária e identifica a origem `D1 · consulta paginada`.
- Mantém fallback local automático quando a consulta operacional estiver temporariamente indisponível.
- Gravações granulares deixam de atualizar `portal_state_snapshot` e o espelho JSON do R2 a cada operação.
- O snapshot passa a ter política `recovery-only` e é marcado como desatualizado após mutações granulares.
- Backups, restauração, sincronização completa e rollback continuam materializando o estado atual com segurança.
- Worker 1.9.0 mantém compatibilidade temporária com os esquemas 3 e 4 durante a implantação.
- Adiciona testes reais em SQLite para paginação, pesquisa, somatórias, fonte relacional e preservação do snapshot de recuperação.

## 6.42.0 — Dashboard e relatórios com leituras SQL no D1

- Cria a migração `0005_analytics_read_models.sql` e eleva o esquema D1 para a versão 4.
- Adiciona índices compostos para período, categoria, status, valores e vínculos de Mútuas.
- Cria `GET /api/analytics/dashboard` com somatórias de entradas, saídas, saldo, realizados e programados por período.
- Cria `GET /api/analytics/report` para recortes privados de Movimentações, Mensalidades e Mútuas.
- Dashboard Administrativo passa a identificar quando os valores foram calculados diretamente no D1.
- Relatórios privados carregam somente as coleções necessárias e mantêm Aniversariantes, Agenda e Avisos no fluxo público local.
- Mantém fallback automático para os cálculos locais quando o endpoint otimizado estiver indisponível.
- Worker 1.8.0 aceita temporariamente o esquema operacional 3 durante a implantação e habilita analytics após a migração 0005.
- `/health` passa a informar `optimizedReads.dashboard` e `optimizedReads.reports`.
- Adiciona testes reais em SQLite para agregações, filtros por período, recortes de relatórios e cliente autenticado.

## 6.41.0 — Gravação granular de grupos familiares e Mútuas no D1

- Cria a migração `0004_group_granular_writes.sql` e eleva o esquema operacional do D1 para a versão 3.
- Adiciona o endpoint autenticado `PUT /api/private-state/groups` para grupos familiares e grupos de Mútuas.
- Atualiza somente os grupos alterados e suas tabelas dependentes, sem reconstruir movimentações, anexos, contas, categorias ou grupos não afetados.
- Trata cada grupo de Mútuas como unidade transacional, incluindo vínculos, eventos de falecimento e participantes congelados.
- Mantém grupos familiares e seus participantes sincronizados por `UPSERT` e exclusões em cascata controladas.
- Adiciona índices para ordenação de grupos, vínculos ativos, eventos por data e participantes por evento.
- Preserva revisão otimista, idempotência, histórico limitado de mutações, snapshot no D1 e espelho de contingência no R2.
- Mantém sincronização completa como fallback para alterações mistas, identificadores inválidos ou mais de 40 grupos na mesma operação.
- Atualiza o Worker para 1.7.0 e o `/health` passa a informar `privateAutosave: granular-treasury-groups` e `granularWrites.groups: true`.
- Adiciona testes reais em SQLite para grupos familiares, vínculos de Mútuas, eventos, participantes, idempotência e preservação das movimentações.

## 6.40.0 — Gravação granular de movimentações e anexos no D1

- Cria a migração `0003_treasury_granular_writes.sql` e eleva o esquema operacional do D1 para a versão 2.
- Movimentações novas, editadas ou excluídas passam pelo endpoint granular `PUT /api/private-state/treasury`.
- Atualiza somente as linhas afetadas em `treasury_movements` e `treasury_attachments`, sem apagar e reconstruir contas, grupos familiares ou Mútuas.
- Mantém o snapshot canônico sincronizado como contingência, sem utilizá-lo para reconstruir todas as projeções em cada operação financeira.
- Adiciona revisão otimista por operação, identificador idempotente e histórico limitado das últimas mutações para impedir duplicações em novas tentativas.
- Preserva a sincronização completa como fallback quando contas, categorias, grupos, configurações ou muitas entidades mudam na mesma operação.
- Mantém os anexos binários no R2 e grava granularmente apenas seus metadados e referências no D1.
- Atualiza o Worker para 1.6.0 e o `/health` passa a informar `privateAutosave: granular-treasury`.
- Adiciona testes reais em SQLite para edição granular, anexos, idempotência e conflito de revisão.

## 6.39.1 — Correção do acesso temporário aos anexos

- restaura o cálculo de validade dos tickets temporários de anexos no Worker;
- corrige os botões **Visualizar** e **Baixar** para arquivos armazenados no R2;
- limita a validade entre 60 e 900 segundos, com padrão de 300 segundos;
- inclui teste de regressão para impedir nova remoção da função `downloadTtl`.

## 6.39.0 — Autenticação administrativa por usuário e senha no D1

- Substitui a entrada administrativa por token GitHub por login com usuário e senha validados pelo Cloudflare Worker.
- Cria as tabelas `portal_users`, `portal_auth_sessions` e `portal_auth_audit` na migração `0002_admin_auth.sql`.
- Armazena somente derivação PBKDF2-HMAC-SHA-256 com salt individual; a senha original nunca é persistida.
- Cria sessões opacas aleatórias e guarda no D1 apenas o hash SHA-256 do token de sessão.
- Bloqueia temporariamente a conta após cinco tentativas inválidas e registra login, logout, bootstrap e alterações de usuários na auditoria.
- Adiciona configuração protegida do primeiro Administrador por `ADMIN_BOOTSTRAP_KEY`.
- Move o `GITHUB_TOKEN` para segredo exclusivo do Worker e remove do frontend as rotas de autenticação e publicação direta no GitHub.
- Publicações públicas passam pelo endpoint autenticado `/api/publication`; o Worker atualiza JSON, mídias e manifesto no mesmo commit.
- Mantém o acesso legado por token desabilitado por padrão e disponível apenas como contingência temporária mediante variável explícita.
- Prepara rotas administrativas para listar, criar, desativar e redefinir senhas de usuários em uma etapa posterior da interface.
- Atualiza o Worker para 1.5.0 e adiciona testes reais com SQLite para bootstrap, login, sessão e logout.

## 6.38.0 — Salvamento privado automático no D1

- Separa definitivamente o salvamento dos dados privados da publicação do conteúdo público.
- Movimentações, contas, categorias, mensalidades, grupos familiares e Mútuas passam a ser gravados automaticamente pelo Worker no backend privado ativo.
- Quando o D1 está ativo, cada operação privada é confirmada no banco sem gerar commit no GitHub.
- Mantém o botão de publicação somente para avisos, agenda, associados, diretoria e demais conteúdos públicos.
- Adiciona fila serial de salvamento com consolidação de alterações rápidas, nova tentativa ao recuperar a conexão e bloqueio seguro de logout/publicação enquanto houver gravação privada pendente.
- Envia anexos privados ao R2 durante o salvamento automático e mantém no D1 somente seus metadados e referências.
- Preserva dados privados ao descartar ou atualizar conteúdo público.
- Adiciona indicador independente “Banco sincronizado / Salvando / Falha ao salvar” no cabeçalho administrativo.
- Auditoria diferencia alterações salvas no banco de publicações realizadas no GitHub.
- Worker 1.4.0 informa o backend utilizado em cada gravação e expõe `privateAutosave: available` no `/health`.
- Adiciona testes de regressão para alterações privadas, públicas, mistas e fila de sincronização.
- Ajusta o orçamento CSS para 338 KB para acomodar o indicador independente de sincronização, mantendo zero declarações substituídas.

## 6.37.0 — Migração segura para Cloudflare D1

- Adicionado esquema D1 versionado para Tesouraria, contas, categorias, grupos familiares, mútuas, eventos e anexos.
- Worker 1.3.0 passa a alternar automaticamente entre R2 e D1 após migração autenticada.
- Central de Recuperação exibe preparação, migração, backend ativo e retorno temporário ao R2.
- Gravações D1 usam lote transacional e mantêm backup e espelho de contingência no R2.
- Snapshot canônico e projeções relacionais são atualizados atomicamente, preservando o JSON atual e preparando endpoints granulares.
- Inserções são compactadas com JSON SQL e limitadas a 40 consultas de escrita por sincronização para compatibilidade com o Workers Free.
- Criadas rotas de status, migração e rollback com revisão otimista.
- Adicionados testes de contrato, reconstrução do estado e interface de migração.


## 6.36.2 — Compartilhamento de aniversário somente com a imagem

- Remove o título e a mensagem automática enviados junto à arte de aniversário.
- Mantém no compartilhamento apenas o arquivo PNG gerado pelo Portal.
- Preserva o download da imagem como alternativa quando o navegador não suporta compartilhamento de arquivos.
- Adiciona teste de regressão para impedir o retorno de texto ou título no compartilhamento.

## 6.36.1 — Resumo financeiro dos lançamentos programados

- Exibe entradas, saídas e resultado previsto ao selecionar o filtro Programados em Movimentações.
- Mantém os valores programados separados do resultado realizado e informa que ainda não afetam o saldo atual.
- Oculta a seção de realizados durante o filtro Programados e a seção de programados durante o filtro Realizados.
- Adiciona destaque visual próprio para o resultado previsto.
- Inclui testes para garantir a soma correta de valores realizados e programados.

## 6.36.0 — Fluxo de Mútuas orientado por contexto

- Separa a composição do grupo das cobranças por falecimento em abas próprias, impedindo a repetição simultânea dos mesmos associados na tela.
- Abre a aba Participantes enquanto o grupo não possui eventos e direciona para Cobranças após gerar um falecimento.
- Agrupa cobranças por evento em cartões expansíveis, com totais, situação e seleção de pendências no contexto correto.
- Substitui os cartões financeiros repetitivos por linhas compactas, removendo grupo e data do falecimento de cada participante quando essas informações já aparecem no cabeçalho do evento.
- Reorganiza o modal de registro de falecimento em dados do evento e participantes, com resumo previsível antes da geração.
- Agrupa a baixa por falecimento e mostra o contexto apenas uma vez, reduzindo repetição no modal de recebimento.
- Preserva a aba e o grupo ativos após gerar cobranças ou registrar baixas.
- Adiciona testes para deduplicação, alternância entre Participantes e Cobranças e agrupamento da baixa.
- Ajusta o orçamento CSS para 336 KB, mantendo zero declarações superadas e os demais limites de qualidade.

## 6.35.1 — Correção visual e participantes dos grupos de Mútuas

- Corrige o grid da lista de participantes no formulário “Registrar falecimento e gerar cobrança”.
- Cria estilos próprios para a prévia dos participantes, sem reutilizar a coluna de checkbox da tela de baixa.
- Reinicia a rolagem do modal a cada abertura para que formulários longos sempre comecem pelo topo.
- Amplia o modal de falecimento em telas maiores e mantém cabeçalho, conteúdo rolável e ações responsivas.
- Exibe os associados e mutuários ativos ao expandir cada grupo de Mútuas, mesmo quando ainda não há falecimentos registrados.
- Mostra quantidade, nome, número do associado e tipo de participante dentro do grupo.
- Adiciona testes de regressão para o modal, o CSS e a lista de participantes do acordeão.

## 6.35.0 — Mútuas orientadas por eventos de falecimento

- Remove a geração automática de cobranças mensais para grupos de mutuários.
- Mantém grupos ativos sem data de baixa na criação.
- Exige data e motivo somente quando o grupo for efetivamente encerrado.
- Adiciona o fluxo “Registrar falecimento”, que cria um evento único e congela os participantes daquele momento.
- Gera uma cobrança por participante somente para o evento registrado, com valor próprio e vencimento opcional.
- Vincula pagamentos por grupo, evento e participante, eliminando a dependência de competências mensais.
- Atualiza dashboard, relatórios, movimentações, filtros e textos da interface para o modelo por evento.
- Migra o esquema para v11 e remove configurações mensais legadas sem criar cobranças retroativas.
- Adiciona testes de regressão para grupos sem recorrência, eventos, baixa e preservação do histórico.

## 6.34.2 — Manifesto sincronizado nas publicações do Portal

- Atualiza `release-manifest.json` no mesmo commit que altera `data/dados.json`.
- Recalcula automaticamente hash SHA-256, tamanho e totais do arquivo público publicado.
- Inclui no manifesto novas fotos de associados e o logotipo enviados pelo Portal.
- Remove do manifesto arquivos públicos excluídos durante a publicação.
- Usa a mesma revisão da branch para ler os dados e o manifesto, evitando sobrescritas concorrentes.
- Adiciona testes de regressão para publicação, inclusão de mídia e exclusão de arquivos.

## 6.34.1 — Correção definitiva da fronteira pública na publicação

- Remove a opção legada que permitia publicar o estado completo no GitHub.
- Faz o envelope público ser sanitizado depois da normalização do esquema, impedindo que categorias financeiras padrão retornem ao JSON público.
- Bloqueia a publicação antes do commit caso qualquer coleção privada ou campo sensível permaneça no payload final.
- Aplica a mesma fronteira ao cache público e à cópia sincronizada mantida no navegador.
- Adiciona teste de regressão que tenta forçar `publicOnly: false` com movimentações, contas, grupos e credenciais privadas.
- Mantém o estado financeiro e os anexos exclusivamente no Cloudflare R2.

## 6.34.0 — Backup e integridade do estado privado

- Cria backups versionados no Cloudflare R2 antes de cada substituição do estado privado e após cada publicação confirmada.
- Mantém automaticamente as 20 versões privadas mais recentes.
- Bloqueia gravações que removeriam de uma só vez todos os registros financeiros, anexos e a credencial derivada da Diretoria.
- Adiciona checksum SHA-256 ao estado principal e aos backups do R2.
- Inclui restauração remota com controle de revisão e backup de segurança criado antes da operação.
- Verifica se todos os anexos referenciados pelas movimentações existem no bucket.
- Identifica referências inválidas, duplicadas e objetos de comprovantes sem vínculo atual.
- Integra o diagnóstico e a linha do tempo remota à Central de Recuperação.
- Permite à Diretoria consultar a integridade e os backups, mantendo a restauração exclusiva do Administrador.
- Adiciona testes de contrato e integração para os endpoints de continuidade operacional.

## 6.33.0 — Modularização da composição principal

- Reduz `portal-app.js` de 492 para 312 linhas, mantendo-o como raiz de composição.
- Separa Tesouraria, Administração, Publicação e Navegação em inicializadores independentes.
- Move a montagem das dependências das páginas para um módulo dedicado.
- Mantém o estado, o runtime e as transições entre funcionalidades coordenados por contratos explícitos.
- Adiciona portões arquiteturais para limitar o bootstrap a 340 linhas e cada feature a 140 linhas.
- Atualiza os testes de interface para validar os módulos responsáveis, em vez de depender da localização anterior do código.
- Preserva o comportamento da interface, dos dados privados e dos anexos no R2.

## 6.32.0 — Consolidação da cascata CSS

- Remove 825 declarações que já eram substituídas posteriormente pelo mesmo seletor e contexto.
- Elimina 196 blocos CSS vazios ou integralmente superados sem alterar a aparência final.
- Reduz o bundle de 339.999 para aproximadamente 320 KB.
- Reduz seletores redefinidos de 329 para 254 e regras de sobrescrita de 487 para 325.
- Adiciona auditoria para bloquear declarações já substituídas entre regras equivalentes.
- Aperta os orçamentos máximos de tamanho e sobrescritas para impedir novo acúmulo.
- Valida equivalência da cascata e comparação visual em desktop, tablet e celular.

## 6.31.1 — Correção dos portões de CI

- Remove novamente os dados financeiros e a credencial derivada da Diretoria do JSON público.
- Preserva aniversariantes, agenda, reuniões e avisos no arquivo público sanitizado.
- Adiciona `wrangler.ci.toml` com nomes válidos exclusivamente para o bundle `--dry-run`.
- Mantém `wrangler.toml.example` como modelo de configuração para implantação manual.
- Faz a validação do Worker executar também `node --check` antes do bundle.
- Inclui a configuração de CI no pacote do Worker e adiciona teste para impedir placeholders inválidos.

## 6.31.0 — Integração contínua no GitHub

- Adiciona workflow de qualidade para pushes, pull requests e execução manual.
- Executa testes, auditorias, manifesto e validação de arquivos gerados no GitHub Actions.
- Instala as dependências bloqueadas e valida o bundle do Cloudflare Worker sem publicar.
- Adiciona workflow manual ou por tag para gerar os três ZIPs e os comprovantes de integridade.
- Mantém permissões somente de leitura e não utiliza segredos de produção.
- Inclui os workflows no pacote de código-fonte e os mantém fora do pacote público.
- Exclui caches locais do Wrangler do Git e dos artefatos.
- Adiciona testes de contrato específicos para a configuração de CI.

## 6.30.0 — Pipeline de release reproduzível

- Adiciona `npm run release:build` para gerar todos os pacotes em uma pasta `dist` limpa.
- Separa o artefato do site, o Worker Cloudflare e o código-fonte completo.
- Gera manifestos e hashes SHA-256 verificáveis para os artefatos.
- Torna os ZIPs determinísticos: o mesmo código gera os mesmos hashes em execuções consecutivas.
- Bloqueia `wrangler.toml`, `.env*`, `.dev.vars*`, `node_modules` e diretórios temporários.
- Remove a cópia financeira legada de `data/dados.json` e impede seu retorno nos portões de segurança.
- Exclui `data/modelo.json` do pacote público de implantação.
- Inclui os testes e a validação do CSS no comando principal `npm run check`.
- Corrige a sincronização de cache para detectar versões indevidas como `6.29.0.1`.
- Remove versões estáveis codificadas diretamente nos scripts de auditoria.

## 6.29.0 — Separação dos dados privados

- Separa o estado público do estado financeiro e administrativo.
- Adiciona armazenamento privado versionado no Cloudflare R2 por meio do Worker.
- Move a validação da senha da Diretoria para o estado privado após a migração.
- Adiciona controle otimista de concorrência para evitar sobrescritas entre sessões.
- Adiciona limitação temporária de tentativas de criação de sessão no Worker.
- Mantém dados privados somente no `sessionStorage`; o `localStorage` recebe uma cópia pública sanitizada.
- Remove arquivos CSS legados e duplicados do pacote.
- Restaura os documentos e o iniciador de homologação exigidos pelo contrato de release.

## 6.28.0

- Consolidação do dashboard administrativo, tesouraria, anexos privados e portões de qualidade.