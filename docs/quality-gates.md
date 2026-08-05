# Portões de qualidade — v6.34.1

## Comando principal

```bash
npm run check
```

O comando executa os testes automatizados, valida o bundle CSS, confere versões de cache, lint, auditorias CSS, acessibilidade e segurança, além da validação de sintaxe, imports, contratos públicos, dados e mídia.

## Orçamentos atuais

- Até 27 fontes CSS no bundle modular.
- Nenhuma regra CSS exatamente duplicada.
- Nenhuma declaração pode permanecer em uma regra quando já é substituída posteriormente pelo mesmo seletor, contexto e nível de importância.
- Até 280 seletores redefinidos no mesmo contexto.
- Até 360 regras de sobrescrita.
- Zero fontes e zero bytes em `assets/css/legacy`.
- Até 36.000 bytes por fonte CSS.
- Até 336.000 bytes no bundle CSS.
- Até 520 linhas por módulo de interface.
- `portal-app.js` abaixo de 340 linhas.
- `entity-forms.js` abaixo de 380 linhas.

## Regras automáticas adicionais

- Todos os botões de templates declaram `type`.
- Eventos inline no HTML são bloqueados.
- IDs estáticos duplicados são bloqueados.
- Arquivos CSS modernos não carregam versão no nome.
- `debugger`, `var` e `console.log` são bloqueados na aplicação.
- Todos os parâmetros `?v=` correspondem exatamente ao `package.json`, inclusive referências antigas com quatro partes.
- A pasta `assets/css/legacy` não pode existir.
- Templates de cadastro e composição visual permanecem em módulos próprios.

## Auditoria de segurança

`npm run audit:security` bloqueia campos sensíveis nos JSONs oficiais, verifica as políticas do HTML e procura persistência indevida de credenciais no navegador.

## Pipeline de release

```bash
npm run release:build
```

O pipeline executa os portões, atualiza o manifesto do código-fonte, cria os pacotes em `dist`, gera hashes SHA-256 e executa `release:dist:verify`. O timestamp fixo do release garante que o mesmo código produza ZIPs com os mesmos hashes. Arquivos locais e secretos são excluídos por uma lista de bloqueio central.


## Execução no GitHub Actions

O workflow `.github/workflows/quality-gates.yml` executa automaticamente `npm run release:check` para o Portal e um bundle `wrangler deploy --dry-run` para o Worker. Os trabalhos são independentes, usam Node.js 22 e possuem apenas permissão `contents: read`.

O workflow `.github/workflows/release-artifacts.yml` repete a validação do Worker, executa `npm run release:build` e envia somente os ZIPs e comprovantes da pasta `dist` como artefatos. Não existe deploy automático nesta etapa. Consulte `docs/github-actions.md`.
