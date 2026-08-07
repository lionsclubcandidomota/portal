# Ícones da interface — v6.36.0

O Portal usa `assets/icons/ui-icons.svg`, um sprite SVG local e sem dependências externas.

## Uso no HTML

```html
<svg class="ui-icon" aria-hidden="true" focusable="false">
  <use href="./assets/icons/ui-icons.svg#calendar"></use>
</svg>
```

Ícones decorativos permanecem com `aria-hidden="true"`. Botões continuam precisando de texto visível ou `aria-label` próprio.

## Escopo atual

A padronização cobre:

- menu lateral, navegação móvel e menu compacto;
- atualização, sincronização e segurança;
- cards principais do Dashboard;
- Área administrativa e seleção de perfil;
- eventos, reuniões, aniversariantes e avisos administrativos;
- relatórios PDF e CSV;
- backup, importação, recuperação e histórico;
- navegação da Tesouraria;
- contas, transferências, grupos familiares, Mútuas, anexos, buscas e ações principais.

Emojis inseridos nos conteúdos cadastrados ou usados como informação semântica específica continuam preservados.

## Regras

- não carregar bibliotecas externas apenas para ícones;
- preferir símbolos existentes no sprite antes de criar novos SVGs isolados;
- manter tamanho, alinhamento e espessura consistentes;
- não substituir texto essencial por um ícone sem nome acessível.
