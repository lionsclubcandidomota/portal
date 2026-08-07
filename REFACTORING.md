# Registro técnico — 6.36.0

## Objetivo desta etapa

A v6.36.0 executa a **Etapa 8 — estabilização final** e encerra a refatoração incremental do Portal. O objetivo foi remover código comprovadamente sem uso, tornar o processo de atualização mais seguro e transformar as regras arquiteturais em verificações automáticas.

## Código removido com evidência

Uma análise do grafo completo, iniciada em `assets/js/app.js`, identificou dois arquivos que não eram alcançados por imports estáticos nem dinâmicos:

- `assets/js/modules/treasury.js`: fachada antiga que duplicava exports dos módulos efetivamente usados;
- `assets/js/modules/treasury-admin/categories.js`: gerenciador antigo substituído pelo fluxo integrado ao formulário de lançamento.

Os dois arquivos foram removidos. A validação da Tesouraria agora consulta diretamente os contratos de `controller.js`, `view.js` e `charts.js`.

## Auditoria do grafo de módulos

O novo comando:

```bash
npm run audit:modules
```

percorre todos os módulos de `assets/js`, resolve imports relativos com ou sem parâmetro de versão e reprova a entrega quando encontra:

- arquivo JavaScript não alcançável pela aplicação;
- import relativo para arquivo inexistente;
- dependência circular no grafo de execução.

A auditoria integra o comando `npm run quality` e, consequentemente, todos os portões de release.

## Backup antes da atualização

O comando:

```bash
npm run backup:local
```

cria uma cópia de:

- `data/dados.json`;
- `data/modelo.json`.

Cada backup recebe data, versão do Portal, tamanho e SHA-256 dos arquivos. Os backups ficam em `.portal-backups`, fora do Git, com retenção automática das 10 cópias mais recentes.

O backup é executado antes de `data:migrate` no fluxo oficial de finalização.

## Pipeline consolidado

O comando oficial passou a ser:

```bash
npm run release:prepare
```

Ele executa, nesta ordem:

1. backup local;
2. migração idempotente dos dados;
3. geração do CSS;
4. testes e auditorias de qualidade;
5. geração do manifesto;
6. auditoria e verificação final do release.

A auditoria visual permanece separada: use `npm run audit:visual` durante a revisão e `npm run audit:visual:required` na estação oficial de homologação. Ela não faz parte do finalizador automático para evitar que uma instalação local de navegador incompatível bloqueie a atualização.

O arquivo `FINALIZAR-ATUALIZACAO.bat` chama somente esse pipeline, evitando repetições e reduzindo o tempo de validação.

## Segurança dos dados

- esquema permanece na versão 10;
- nenhuma regra da Tesouraria foi alterada;
- nenhuma regra de mensalidades ou Mútuas foi alterada;
- nenhuma integração com Cloudflare foi adicionada;
- o pacote de atualização não inclui `data` nem `public`;
- `data/dados.json` e `data/modelo.json` permanecem preservados durante a sobreposição do pacote.

## Resultado acumulado da refatoração

Entre as versões 6.29.0 e 6.36.0, o projeto passou a contar com:

- CSS sem camada legacy;
- carregamento sob demanda dos módulos pesados;
- redução superior a 50% no JavaScript inicial;
- mídia responsiva e template de aniversário otimizado;
- renderização incremental das listas e gráficos;
- ícones SVG locais e consistentes;
- homologação visual em cinco telas e cinco resoluções;
- auditorias de desempenho, mídia, segurança, acessibilidade, CSS, módulos e release;
- backup automático antes de atualizações.

**Etapas pendentes: nenhuma.**
