# Linha de base do CSS — v6.32.0

O bundle é gerado por `tools/build-css.mjs`. A lista explícita de fontes preserva a ordem da cascata e não contém fontes na pasta `legacy`.

## Linha de base automatizada

- 27 arquivos-fonte consolidados em um único bundle.
- 3.536 regras analisadas.
- 0 regras exatamente duplicadas.
- 330 seletores redefinidos no mesmo contexto.
- 488 regras de sobrescrita.
- 0 fontes e 0 bytes na camada `legacy`.
- Maior fonte individual limitada a 36.000 bytes.
- Bundle limitado a 330.000 bytes.

Execute:

```bash
npm run build:css
npm run audit:css
```

A validação falha ao ultrapassar qualquer limite, reintroduzir regras exatamente duplicadas ou recriar a pasta `assets/css/legacy`.

## Componentes adicionados nesta versão

- Anexos financeiros foram incorporados a `pages/treasury-records.css`.
- Notificações semânticas foram incorporadas a `components/interaction-foundation.css`.
- O Portal Sincronizado foi modernizado dentro de `components/publication-center.css`.

A quantidade de fontes permaneceu em 27. O orçamento do bundle foi ampliado de forma controlada para comportar os novos componentes sem recriar camadas genéricas ou arquivos isolados.

## Próximos cuidados

- Novas regras devem ser incluídas no módulo de domínio correspondente.
- Correções não devem ser adicionadas ao final do bundle como camada genérica.
- Redefinições de seletores precisam reduzir ou manter os limites atuais.
- Componentes globais devem reutilizar tokens e padrões existentes.

## Consolidação 6.32.0

- Zero declarações já substituídas pelo mesmo seletor e contexto.
- Até 280 seletores redefinidos.
- Até 360 regras de sobrescrita.
- Resultado atual: 254 seletores redefinidos, 325 sobrescritas e bundle próximo de 320 KB.
