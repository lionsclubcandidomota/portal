# Desempenho — v6.36.0

## Auditoria do carregamento inicial

Execute:

```bash
npm run audit:performance
```

Linha de base da versão:

- 42 módulos JavaScript estáticos;
- 179.918 bytes de JavaScript inicial;
- 355.260 bytes de CSS;
- 37.814 bytes do logotipo da interface;
- 572.992 bytes de ativos críticos não comprimidos.

## Menos trabalho de renderização

Além do tamanho transferido, a versão reduz trabalho no navegador. Aniversariantes, avisos, movimentações e gráficos não substituem mais o DOM quando o HTML calculado permanece igual. Isso evita:

- recriação desnecessária de nós;
- nova vinculação de eventos sem mudança visual;
- recalculação de layout evitável;
- perda de foco em atualizações repetidas.

O helper foi integrado a `visual-helpers.js`, portanto não acrescentou um módulo ao grafo inicial.

## Fotografias responsivas

As fotos originais permanecem disponíveis para alta resolução. As listas usam miniaturas WebP de 96 e 192 px, selecionadas pelo navegador com `srcset` e fallback para o original.

## Arte de aniversário

O template WebP de 263.740 bytes continua fora do carregamento inicial e só é solicitado ao criar a homenagem.

## Recursos sob demanda

Permanecem fora do carregamento inicial:

- arte de aniversário e geração de miniaturas;
- Agenda e calendário;
- controlador, tela e gráficos da Tesouraria;
- formulários e gerenciadores administrativos;
- controles de mensalidades e Mútuas;
- área administrativa e relatórios;
- Ajustes completos;
- revisão detalhada da publicação.

## Orçamentos

A auditoria falha acima de:

- 185.000 bytes de JavaScript inicial;
- 365.000 bytes de CSS;
- 60.000 bytes para o logotipo;
- 580.000 bytes de ativos críticos.

A auditoria de mídia também controla presença e peso das miniaturas e do template.

## Auditoria visual opcional

```bash
npm run audit:visual
```

A ferramenta depende de uma instalação funcional do Chrome ou Chromium. Na Etapa 7, essa auditoria será executada em uma estação de homologação com navegador compatível.
