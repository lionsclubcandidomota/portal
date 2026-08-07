# Portal Lions v6.36.0

## Etapa 8 — estabilização final da refatoração

A v6.36.0 encerra a refatoração incremental iniciada na v6.29.0. Esta entrega não altera regras de negócio nem dados do Portal. O foco é garantir que o código publicado permaneça enxuto, verificável e seguro para futuras atualizações.

### Alterações

- Remoção de dois módulos comprovadamente sem uso no grafo real da aplicação:
  - `assets/js/modules/treasury.js`;
  - `assets/js/modules/treasury-admin/categories.js`.
- Nova auditoria `audit:modules`, que percorre imports estáticos e dinâmicos a partir de `assets/js/app.js`.
- Bloqueio automático de módulos órfãos, imports locais ausentes e dependências circulares.
- Contratos da Tesouraria validados diretamente nos módulos usados em produção, sem fachada redundante.
- Novo backup local automático de `data/dados.json` e `data/modelo.json` antes de qualquer migração ou geração de release.
- Retenção automática dos 10 backups locais mais recentes em `.portal-backups`.
- Fluxo de finalização consolidado no comando `npm run release:prepare`, evitando executar os mesmos testes e auditorias várias vezes.
- `FINALIZAR-ATUALIZACAO.bat` agora verifica a presença dos arquivos de dados, cria o backup e executa um único pipeline oficial.
- Correção do `.gitignore`: o iniciador de homologação volta a ser publicável, enquanto backups e artefatos locais permanecem fora do Git.
- Portões de qualidade e documentação revisados para a versão consolidada.

### Compatibilidade

- esquema de dados: 10;
- sem Cloudflare, D1 ou Worker;
- publicação continua pelo fluxo atual do GitHub;
- pacote de atualização não contém `data` nem `public`;
- Tesouraria, mensalidades, Mútuas, associados, fotos e demais cadastros são preservados;
- a regra de Mútua continua gerando cobrança somente após o registro de falecimento.

## Refatoração concluída

As oito etapas planejadas foram concluídas. Novas melhorias devem ser tratadas como versões evolutivas independentes, sempre preservando os portões de qualidade e o fluxo de backup estabelecidos nesta entrega.
