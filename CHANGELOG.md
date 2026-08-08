# Changelog

## 6.46.4 — Largura integral da prévia de participantes

- Faz o resumo e a lista de participantes ocuparem toda a largura disponível no registro de falecimento.
- Remove o espaço vazio lateral causado por alinhamentos herdados de uma regra antiga em flexbox.
- Mantém duas colunas equilibradas em telas amplas e uma coluna no celular.
- Mantém o esquema 12 e não altera grupos, ocorrências, cobranças ou demais dados.

## 6.46.3 — Estabilização visual dos formulários de Mútuas

- Faz os modais de grupos e falecimentos abrirem sempre no início do formulário.
- Separa a rolagem do conteúdo da rolagem do cartão e do fundo do modal.
- Impede que os cartões de participantes fiquem comprimidos ou com conteúdo cortado.
- Exibe todos os participantes na prévia da cobrança por falecimento.
- Faz a lista de participantes ocupar toda a largura disponível.
- Mantém o esquema 12 e não altera dados operacionais.


## 6.46.2 — Correções de Mútuas e Tesouraria móvel

- Corrige o erro ao abrir Gerenciar Mútuas causado por identificadores duplicados no DOM.
- Reorganiza o formulário de registro de falecimento e a lista de participantes.
- Diferencia associados e mutuários na prévia da cobrança eventual.
- Mostra Movimentações, Contas, Mensalidades e Mútuas em grade visível no celular.
- Remove a dependência de arraste horizontal oculto na navegação financeira.
- Corrige o fechamento antecipado do contêiner principal da Tesouraria.
- Mantém o esquema 12 e não altera dados operacionais.

## 6.46.1 — Histórico de dirigentes e seções recolhíveis

- Cargos, usuários e histórico podem ser expandidos ou recolhidos na área administrativa.
- Cada Ano Leonístico também possui controle próprio de expansão.
- Fotos dos dirigentes incluídas no histórico administrativo.
- Histórico público de Dirigentes ganhou navegação explícita por Ano Leonístico.
- Ex-dirigentes inativos permanecem visíveis nos períodos anteriores.
- Texto explicativo do filtro mensal de aniversariantes removido da área pública.

## 6.46.0 — Melhorias visuais e responsivas, etapa final

- Redesenha o Painel de Publicação com situação, progresso e fluxo em três etapas.
- Mantém a publicação minimizável e o usuário trabalhando no mesmo contexto.
- Cria uma camada responsiva dedicada à Tesouraria para celulares e tablets.
- Reorganiza navegação, indicadores, gráficos, filtros, movimentações e formulários financeiros em telas pequenas.
- Corrige o CSS dos participantes no cadastro de Mútuas.
- Diferencia associados e mutuários na seleção do grupo.
- Substitui emojis funcionais nas áreas financeiras e administrativas revisadas por ícones SVG locais.
- Mantém o esquema 12 e não altera dados, movimentações, usuários ou fotografias.
- Encerra o ciclo iniciado na v6.45.0.

# Histórico de versões

## 6.45.0 — Experiência pública e identidade institucional

- Move o botão Atualizar Portal para o rodapé do menu lateral.
- Reestrutura o banner inicial com logotipo maior e marca d’água institucional.
- Padroniza o banner público de Dirigentes com a mesma identidade visual.
- Adiciona consulta pública do histórico de dirigentes por Ano Leonístico.
- Limita os aniversariantes de visitantes ao mês atual, inclusive no Dashboard.
- Substitui emojis de estado nas telas públicas revisadas por ícones SVG locais.
- Mantém o esquema 12 e não altera dados operacionais.

## 6.44.1 — Correção de acesso e Ano Leonístico

- Corrige a autorização das rotas restritas quando a navegação recebe o resumo da sessão autenticada.
- Restaura o acesso à Tesouraria e aos Ajustes para o Administrador.
- Mantém a Tesouraria disponível para a Diretoria em modo de consulta.
- Corrige a validação HTML do campo Ano Leonístico para aceitar valores como `2026/2027`.
- Adiciona instrução de formato no próprio campo e teste de regressão para as rotas restritas.
- Mantém o esquema 12 e não altera dados operacionais.

## 6.44.0 — Dirigentes públicos e estabilização final

- Cria a área pública **Dirigentes** para o Ano Leonístico vigente.
- Reutiliza associados, cargos e designações sem duplicar cadastros.
- Oculta credenciais, permissões, números e observações internas.
- Adiciona navegação pública própria para Dirigentes.
- Amplia a auditoria visual para seis telas em cinco resoluções.
- Adiciona homologação integrada de esquema, vínculos e períodos.
- Integra a verificação ao iniciador local de homologação.
- Mantém o esquema 12 e todos os dados operacionais existentes.
- Encerra as oito etapas do ciclo funcional.

## 6.43.0 — Histórico de cargos por Ano Leonístico

- Atualiza o esquema de dados para a versão 12.
- Vincula cargos a associados por Ano Leonístico e período de vigência.
- Preserva cargos anteriores sem sobrescrever o histórico.
- Encerra automaticamente permissões quando a designação deixa de vigorar.
- Ativa permissões do novo cargo quando a nova designação entra em vigor.
- Migra usuários existentes para uma designação no AL atual.
- Bloqueia períodos ativos sobrepostos para o mesmo associado.
- Adiciona gerenciamento e visualização do histórico por AL.
- Mantém Tesouraria, Mútuas, mensalidades, famílias, agenda, avisos e mídias.

## 6.42.0 — Evolução funcional etapa 6

- Adiciona usuários e senhas individuais vinculados aos associados.
- Cria cargos padrão e permite cargos personalizados.
- Centraliza permissões de consulta e edição por cargo.
- Adiciona entrada específica para Usuário na Área administrativa.
- Protege publicação, backups, importação, recuperação e gestão de acessos para o Administrador.
- Armazena somente derivação PBKDF2-SHA-256 das senhas, com salt individual.
- Atualiza o esquema para a versão 11 sem alterar dados operacionais.
- Mantém alterações de usuários pendentes até a publicação pelo Administrador no mesmo navegador.

## 6.40.0 — Evolução funcional etapa 4

- Moderniza a interface da Tesouraria e reduz o peso visual das movimentações.
- Permite expandir gráficos clicando diretamente no cartão ou usando o teclado.
- Torna a seção de movimentações programadas recolhível.
- Preserva filtro, pesquisa, paginação e rolagem após editar uma movimentação.
- Adiciona cobrança somente ao associado ou para toda a família.
- Mantém o esquema 10 e não altera dados operacionais.

# Changelog

## 6.39.0 — Evolução funcional etapa 3

- Permite cadastrar eventos e reuniões on-line antes da disponibilização do link.
- Identifica compromissos on-line sem link em Agenda, Dashboard, calendário e relatórios.
- Remove o texto automático do compartilhamento de aniversários.
- Remove a confirmação automática após gerar ou baixar a homenagem.
- Disponibiliza no computador opções públicas para copiar, baixar e abrir o WhatsApp.
- Simplifica a entrada administrativa para solicitar somente a credencial de acesso.
- Substitui mensagens técnicas de token por linguagem mais clara.
- Mantém esquema 10 e todos os dados e regras existentes.

## 6.38.0 — Evolução funcional etapa 2

- Preserva tela, seção, rolagem e foco após salvar ou atualizar informações.
- Impede que a atualização remota redirecione o usuário para o Início.
- Mantém filtros, paginação e estados internos durante novas renderizações.
- Moderniza a central de publicação com linguagem simples e fluxo Conferir, Salvar e Publicar.
- Reorganiza Ajustes em Identidade, Visual, Mensalidades e Acesso.
- Adiciona prévia ao vivo, atalhos internos e barra de salvamento responsiva.
- Mantém esquema 10 e todos os dados e regras existentes.

## 6.37.0 — Evolução funcional etapa 1

- Reestrutura a imagem de boas-vindas e centraliza o logotipo do clube.
- Cria card semântico e centralizado para o horário.
- Agrupa sessão, atualização e sincronização no cabeçalho autenticado.
- Padroniza tipografia e pesos visuais da interface.
- Adiciona escolha de fonte em Ajustes, sem dependência externa.
- Mantém esquema 10 e todos os dados e regras existentes.

## 6.36.0 — Refatoração etapa 8 e estabilização final

- Remove dois módulos comprovadamente fora do grafo real da aplicação.
- Adiciona auditoria de módulos órfãos, imports ausentes e dependências circulares.
- Valida os contratos da Tesouraria diretamente nos módulos usados em produção.
- Cria backup local automático dos arquivos de dados antes da atualização.
- Mantém somente os 10 backups locais mais recentes e registra SHA-256.
- Consolida testes, auditorias e manifesto em um único pipeline de release.
- Corrige o `.gitignore` para permitir a publicação do iniciador de homologação.
- Encerra as oito etapas da refatoração sem alterar dados ou regras de negócio.

## 6.35.0 — Refatoração etapa 7

- Homologa cinco telas principais em cinco resoluções, totalizando 25 cenários visuais.
- Simplifica o cabeçalho em celulares pequenos para evitar corte do título.
- Organiza os resumos do Dashboard em duas colunas no tablet.
- Reestrutura os controles da Agenda em grupos proporcionais e acessíveis.
- Simplifica o rótulo lateral para **Aniversários** e evita truncamento no notebook.
- Amplia a auditoria automática de estouro, carregamento e navegação responsiva.
- Mantém o esquema 10 e todos os dados e regras existentes.

## 6.34.0 — Refatoração etapa 6

- Evita substituir HTML idêntico nas listas de aniversariantes, avisos e movimentações.
- Evita reconstruir gráficos financeiros quando os dados renderizados não mudaram.
- Religa eventos somente após uma alteração real do conteúdo.
- Amplia o sprite SVG local para a Área administrativa, relatórios, backups e Tesouraria.
- Move os estilos de carregamento para a camada de interação responsável.
- Adiciona testes de regressão para renderização incremental, ícones e organização CSS.
- Mantém o esquema 10, os dados e todas as regras atuais de Tesouraria, mensalidades e Mútuas.

## 6.33.0 — Refatoração etapa 5

- Cria miniaturas WebP de 96 e 192 px para as fotos dos associados.
- Faz os avatares usarem `srcset`, carregamento tardio e fallback para o original.
- Gera original e miniaturas no mesmo commit ao publicar novas fotos.
- Converte o template de aniversário de aproximadamente 2,85 MB para 264 KB.
- Adiciona auditoria automática de mídia aos controles oficiais.
- Mantém os originais, o esquema 10 e todas as regras de Tesouraria, mensalidades e Mútuas.

## 6.32.0 — Refatoração etapa 4

- Retira o controlador completo da Tesouraria do grafo inicial.
- Mantém a seção financeira escolhida durante o carregamento sob demanda.
- Cria modelo leve e testável para o resumo financeiro do Dashboard.
- Reduz o JavaScript inicial de 189.625 para 177.177 bytes.
- Reduz os ativos críticos de 581.107 para 569.143 bytes.
- Padroniza os ícones dos cards principais do Dashboard com SVG local.
- Adiciona testes de regressão para resumo financeiro e carregamento tardio.
- Mantém o esquema 10 e todas as regras atuais de Tesouraria, mensalidades e Mútuas.

## 6.31.0 — Refatoração etapa 3

- Carregamento sob demanda da tela de Ajustes e da revisão de publicação.
- Redução do JavaScript inicial de 226.741 para 189.625 bytes.
- Remoção segura de 64 regras CSS integralmente substituídas.
- Redução das sobrescritas CSS de 611 para 547.
- Sprite SVG local para menu, navegação móvel e cabeçalho.
- Novos testes de carregamento, ícones e orçamento CSS.
- Nenhuma alteração no esquema de dados ou nas regras de Tesouraria e Mútuas.

# Histórico de versões

## 6.30.0 — Carregamento sob demanda e redução do JavaScript inicial

- Retira Agenda, Tesouraria completa, formulários, gerenciadores administrativos, painel e relatórios do carregamento inicial.
- Adiciona prefetch por intenção na navegação lateral e móvel.
- Cria estados acessíveis de carregamento e erro para módulos dinâmicos.
- Reduz o JavaScript inicial de 401.338 para 226.741 bytes.
- Reduz o grafo estático de 61 para 41 módulos.
- Adiciona auditoria visual opcional para cinco resoluções.
- Mantém esquema 10, dados e todas as regras atuais.

## 6.29.0 — Otimização incremental e base de desempenho

- Remove arquivos CSS históricos e a pasta legacy que não participavam do bundle.
- Consolida uma fonte CSS e preserva o visual atual em uma camada moderna explicitamente identificada.
- Adota logotipo WebP leve na interface, mantendo o PNG original.
- Carrega a geração da arte de aniversário somente quando solicitada.
- Ativa carregamento tardio das fotos em listas.
- Cria orçamento automático para JavaScript inicial, CSS e ativos críticos.
- Restaura o iniciador de homologação do Windows.
- Mantém o esquema 10 e todos os dados existentes.

## 6.28.0 — Redesign Clean UI e correções responsivas

- Corrige os totais do filtro Programados na Tesouraria.
- Recalcula entradas, saídas, resultado e quantidade conforme o filtro ativo.
- Reestrutura o componente Agenda do Dashboard para notebooks, tablets e celulares.
- Moderniza a interface completa com nova hierarquia visual, espaçamentos, cards, botões, campos, tabelas e modais.
- Simplifica títulos, descrições e ações sem remover funcionalidades.
- Mantém o esquema 10 e todos os dados existentes.

## 6.27.2 — Cobranças de Mútua definitivas

- Substitui, nas cobranças em aberto, a informação “Falecimento em” por “Cobrança gerada em”.
- Usa a data local de criação da ocorrência (`createdDate`), mantendo `createdAt` como registro técnico para informar quando a cobrança foi gerada.
- Torna cada ocorrência de Mútua definitiva após a geração: não há edição nem exclusão.
- Preserva para sempre a fotografia dos participantes incluídos no momento do registro.
- Mantém a edição do grupo somente para definir participantes de cobranças futuras.

## 6.27.1 — Correção da geração de cobranças de Mútua

- Corrige a perda da ocorrência ao consultar os participantes antes da gravação.
- Preserva a referência do grupo de Mútua durante a normalização do estado.
- Reobtém e valida o grupo imediatamente antes de anexar o falecimento.
- Garante que cada participante incluído apareça como cobrança em aberto.
- Adiciona teste de regressão para o fluxo que apresentou o erro.
- Mantém todos os dados existentes e não altera a regra de cobrança somente por falecimento.

## 6.27.0 — Mútuas por ocorrência de falecimento

- Remove a geração mensal automática de cobranças de Mútua.
- Cria cobranças somente após o registro de um falecimento de associado do Distrito.
- Registra a pessoa falecida, a data, o valor individual e uma fotografia lógica dos participantes do grupo naquele momento.
- Preserva as movimentações financeiras históricas e os participantes já cadastrados.
- Permite baixa individual ou em lote, com um movimento financeiro por participante.
- Atualiza dashboard, relatórios, recuperação, revisão de publicação e testes para o novo fluxo.
- Mantém o Portal no modelo atual com dados em `data/dados.json`, sem migração para Cloudflare, D1 ou R2.
