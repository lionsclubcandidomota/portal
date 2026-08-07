# Histórico de versões

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
