# Linha de base do CSS — v6.36.0

O bundle é gerado por `tools/build-css.mjs`. A lista explícita de fontes preserva a ordem da cascata e não contém fontes na pasta `legacy`.

## Linha de base automatizada

- 27 arquivos-fonte consolidados em um único bundle;
- 3.732 regras analisadas;
- 0 regras exatamente duplicadas;
- 380 seletores redefinidos no mesmo contexto;
- 547 regras de sobrescrita;
- 0 fontes e 0 bytes na camada `legacy`;
- bundle com 355.260 bytes.

Execute:

```bash
npm run build:css
npm run audit:css
```

## Alterações desta versão

- `.feature-loading` e seu indicador foram movidos de `components/modern-interface.css` para `components/interaction-foundation.css`;
- regras reutilizáveis alinham ícones SVG em botões, cards administrativos e navegação financeira;
- a ordem da cascata e o visual existente foram preservados.

## Limites atuais

- até 400 seletores redefinidos;
- até 580 regras de sobrescrita;
- até 365.000 bytes no bundle;
- nenhuma duplicata exata ou fonte legacy.

## Próximo objetivo

Continuar a incorporação gradual de `modern-interface.css` nos módulos de domínio somente quando a homologação visual confirmar equivalência.
