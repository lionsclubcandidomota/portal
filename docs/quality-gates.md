# Portões de qualidade — v6.44.0

## Comando principal

```bash
npm run quality
```

O comando executa, uma única vez:

- conferência da versão de cache;
- lint interno;
- testes automatizados;
- auditoria do grafo de módulos;
- homologação integrada de esquema, vínculos, cargos e dirigentes públicos;
- auditorias de CSS, acessibilidade, segurança, desempenho e mídia;
- validação de sintaxe, contratos públicos, imports e dados.

`npm run check` permanece como um alias compatível para `npm run quality`.

## Orçamentos atuais

- até 30 fontes CSS no bundle modular;
- nenhuma regra CSS exatamente duplicada;
- até 400 seletores redefinidos no mesmo contexto;
- até 580 regras de sobrescrita;
- zero fontes e zero bytes em `assets/css/legacy`;
- até 40.000 bytes por fonte CSS;
- até 400.000 bytes no bundle CSS;
- até 190.000 bytes de JavaScript no grafo inicial;
- até 60.000 bytes para o logotipo da interface;
- até 600.000 bytes de ativos críticos não comprimidos;
- `portal-app.js` abaixo de 500 linhas;
- `entity-forms.js` abaixo de 380 linhas.

## Regras automáticas adicionais

- todos os módulos de `assets/js` devem ser alcançáveis a partir de `assets/js/app.js`;
- imports relativos não podem apontar para arquivos ausentes;
- dependências circulares são bloqueadas;
- todos os botões de templates declaram `type`;
- eventos inline no HTML, IDs estáticos duplicados, `debugger`, `var` e `console.log` são bloqueados;
- todos os parâmetros `?v=` correspondem ao `package.json`;
- a pasta `assets/css/legacy` não pode existir;
- recursos pesados não podem retornar ao carregamento estático inicial;
- o template de aniversário não pode ser pré-carregado;
- shell, Dashboard, Área administrativa e navegação financeira usam ícones SVG locais;
- listas críticas devem usar `renderHtmlIfChanged` para evitar substituições idênticas;
- `.feature-loading` pertence à camada de interação, não à camada visual final.

## Auditorias

- `npm run audit:modules`: alcançabilidade, imports ausentes e ciclos;
- `npm run audit:integrated`: esquema, vínculos, períodos, rota pública e cobertura de Dirigentes;
- `npm run audit:css`: cascata, duplicações, fontes e peso;
- `npm run audit:a11y`: contratos de acessibilidade estática;
- `npm run audit:security`: campos sensíveis, políticas do HTML e credenciais;
- `npm run audit:performance`: grafo inicial e ativos críticos;
- `npm run audit:media`: fotos, miniaturas e template de aniversário;
- `npm run audit:visual`: validação opcional em navegador disponível;
- `npm run audit:visual:required`: validação visual obrigatória na estação de homologação.

## Backup local

```bash
npm run backup:local
```

Cria uma cópia versionada dos dois JSONs operacionais em `.portal-backups`, com SHA-256 e retenção das 10 versões mais recentes.

## Portão de release

Para conferir um pacote já preparado:

```bash
npm run release:check
```

Para preparar uma atualização completa:

```bash
npm run release:prepare
```

`release:prepare` cria o backup, migra os dados de forma idempotente, gera o CSS, executa os portões determinísticos, produz o manifesto e verifica o pacote final. A auditoria visual deve ser executada separadamente na estação de homologação. O relatório integrado fica em `artifacts/homologation/integrated-report.json`.
