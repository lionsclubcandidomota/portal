# Portões de qualidade — v6.26.0

## Comando principal

```bash
npm run check
```

O comando executa conferência de versão, lint, auditoria CSS, acessibilidade, segurança, sintaxe, imports, contratos públicos, dados, mídia e testes.

## Orçamentos atuais

- Até 27 fontes CSS no bundle modular.
- Nenhuma regra CSS exatamente duplicada.
- Até 321 seletores redefinidos no mesmo contexto.
- Até 477 regras de sobrescrita.
- Zero fontes e zero bytes em `assets/css/legacy`.
- Até 40.000 bytes por fonte CSS.
- Até 325.000 bytes no bundle CSS.
- Até 520 linhas por módulo de interface.
- `portal-app.js` abaixo de 500 linhas.
- `entity-forms.js` abaixo de 380 linhas.

## Regras automáticas adicionais

- Todos os botões de templates declaram `type`.
- Eventos inline no HTML são bloqueados.
- IDs estáticos duplicados são bloqueados.
- Arquivos CSS modernos não carregam versão no nome.
- `debugger`, `var` e `console.log` são bloqueados na aplicação.
- Todos os parâmetros `?v=` correspondem ao `package.json`.
- A pasta `assets/css/legacy` não pode existir.
- Templates de cadastro e composição visual permanecem em módulos próprios.

## Auditoria de segurança

`npm run audit:security` bloqueia campos sensíveis nos JSONs oficiais, verifica as políticas do HTML e procura persistência indevida de credenciais no navegador.

## Portão de release

`npm run release:check` executa todos os portões anteriores e também valida documentação, ausência de dependências externas de execução e manifesto SHA-256 do pacote.
