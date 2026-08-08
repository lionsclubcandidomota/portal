# Desempenho — v6.42.0

## Auditoria do carregamento inicial

Execute:

```bash
npm run audit:performance
```

Linha de base da versão:

- 45 módulos JavaScript estáticos;
- 205.606 bytes de JavaScript inicial;
- 391.253 bytes de CSS;
- 37.814 bytes do logotipo da interface;
- 634.673 bytes de ativos críticos não comprimidos.

A inclusão da política central de permissões, normalização de cargos e estrutura do esquema 11 aumentou o grafo inicial em relação à v6.41.0. O gerenciador de acessos, os formulários e a rotina criptográfica de criação de senhas permanecem carregados sob demanda.

Mesmo após essa evolução, o JavaScript inicial continua aproximadamente 49% menor do que os 401.338 bytes medidos no início da refatoração.

## Menos trabalho de renderização

Aniversariantes, avisos, movimentações e gráficos não substituem o DOM quando o HTML calculado permanece igual. Isso evita recriação desnecessária de nós, nova vinculação de eventos e perda de foco.

## Fotografias e arte de aniversário

As listas usam miniaturas WebP de 96 e 192 px. O template WebP da homenagem continua fora do carregamento inicial e é solicitado somente ao criar a arte.

## Recursos sob demanda

Permanecem fora do carregamento inicial:

- arte de aniversário e geração de miniaturas;
- Agenda e calendário;
- controlador, tela e gráficos da Tesouraria;
- formulários e gerenciadores administrativos;
- controles de mensalidades e Mútuas;
- área administrativa e relatórios;
- Ajustes completos;
- revisão detalhada da publicação;
- gerenciamento de usuários e cargos;
- derivação de senha individual durante cadastro e login.

## Orçamentos

A auditoria falha acima de:

- 210.000 bytes de JavaScript inicial;
- 395.000 bytes de CSS;
- 60.000 bytes para o logotipo;
- 645.000 bytes de ativos críticos.

Esses limites mantêm pouca margem sobre a linha de base atual e evitam crescimento silencioso nas próximas etapas.

## Auditoria visual opcional

```bash
npm run audit:visual
```

A ferramenta depende de uma instalação funcional do Chrome ou Chromium. Na homologação oficial, use `npm run audit:visual:required`.

## v6.43.0 — histórico por Ano Leonístico

A política de vigência e normalização do esquema 12 adicionou um módulo central ao grafo inicial. O orçamento foi ajustado de forma controlada para 220 KB de JavaScript inicial e 655 KB de ativos críticos. O gerenciador visual do histórico continua carregado sob demanda.

## v6.44.0 — área pública de Dirigentes

A nova tela pública é carregada somente quando o visitante abre **Dirigentes**. O módulo `leaders.js`, a projeção pública e os cartões correspondentes permanecem fora do carregamento inicial.

Linha de base final desta etapa:

- 46 módulos JavaScript estáticos;
- 219.609 bytes de JavaScript inicial;
- 397.537 bytes de CSS;
- 37.814 bytes do logotipo da interface;
- 654.960 bytes de ativos críticos não comprimidos.

Os limites finais são 220 KB para JavaScript inicial, 400 KB para CSS e 655 KB para ativos críticos. A margem é pequena de propósito: novas funcionalidades públicas ou administrativas deverão preferir carregamento sob demanda.
