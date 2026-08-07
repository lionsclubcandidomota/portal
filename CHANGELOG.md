# Changelog

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
