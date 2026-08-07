# Recuperação e continuidade operacional

A recuperação do Portal possui duas camadas complementares.

## 1. Pontos locais do navegador

A Central de Recuperação mantém cópias no IndexedDB, com fallback para `localStorage`. Esses pontos protegem alterações ainda não publicadas e permitem restauração seletiva de associados, agenda, Tesouraria, configurações e demais áreas.

Arquivos principais:

- `recovery-center/controller.js`: coordena criação, diagnóstico e restauração;
- `recovery-center/domain.js`: checksum, resumo e integridade do snapshot;
- `recovery-center/storage.js`: IndexedDB e fallback;
- `recovery-center/view.js`: interface local e remota.

## 2. Backups privados no Cloudflare R2

O Worker 1.2.0 mantém o estado principal em:

```text
__portal/private-state-v1.json
```

As versões restauráveis ficam em:

```text
__portal/backups/private-state-v1/
```

Antes de uma publicação substituir o estado principal, o Worker cria uma cópia da revisão atual. A revisão confirmada após a publicação também é armazenada. A retenção é limitada às 20 versões mais recentes.

Cada envelope inclui:

- revisão única;
- data e responsável;
- checksum SHA-256;
- quantidade de movimentações, contas e anexos;
- motivo da criação do backup.

## Proteção contra perda integral

Quando o estado atual possui registros privados, o Worker rejeita uma gravação cujo novo estado não contenha nenhum registro protegido. Essa regra evita que falhas de hidratação, migração ou cache substituam a Tesouraria por um objeto vazio.

A revisão esperada continua obrigatória. Caso outra sessão publique primeiro, o Worker retorna conflito e exige atualização do painel.

## Restauração remota

Somente o Administrador pode restaurar uma versão do R2. O fluxo é:

1. confirmar a revisão atual;
2. validar o checksum do backup selecionado;
3. criar uma cópia de segurança do estado atual;
4. gerar uma nova revisão para o conteúdo restaurado;
5. atualizar o objeto principal;
6. hidratar novamente a sessão do Portal.

A Diretoria pode consultar a linha do tempo e o diagnóstico, mas não pode criar ou restaurar backups.

## Integridade dos comprovantes

O endpoint de diagnóstico percorre as referências `objectKey` presentes nas movimentações e confere cada objeto com `R2.head()`.

O relatório mostra:

- anexos referenciados e encontrados;
- anexos ausentes;
- referências inválidas;
- referências duplicadas;
- objetos em `treasury/` que não possuem vínculo com o estado atual;
- quantidade de backups disponíveis.

A Central de Recuperação apresenta esse resultado sem expor o conteúdo dos arquivos ou credenciais do bucket.


## Continuidade com D1 — versão 6.37.0

A Central de Recuperação consulta `GET /api/storage/status` e apresenta claramente a fonte principal. O corte para D1 cria um backup `before-d1-migration`; o retorno ao R2 cria `before-d1-rollback`. Em operação normal, cada gravação D1 mantém um espelho atual no objeto `__portal/private-state-v1.json`, além da linha do tempo de backups.

## Fila privada e continuidade — versão 6.38.0

A fila serial consolida alterações rápidas e mantém a geração ainda não confirmada. Em falha de rede, o Portal conserva os dados no navegador, sinaliza o erro e tenta novamente quando a conexão retorna ou quando o Administrador aciona o indicador. Publicação, atualização e logout são bloqueados enquanto a gravação privada não puder ser confirmada.

## Snapshot somente para recuperação — versão 6.43.0

Com o esquema D1 5, as tabelas relacionais passam a ser a fonte operacional oficial. Gravações granulares de movimentações e grupos não regravam o snapshot a cada ação; elas marcam `snapshot_stale = 1`.

Quando a Central de Recuperação cria um backup, restaura uma versão ou retorna temporariamente ao R2, o Worker reconstrói o estado privado atual a partir das tabelas relacionais antes de materializar o JSON. Assim, o snapshot permanece um artefato de contingência, não uma dependência das operações diárias.

O endpoint de status informa `relationalSource`, `snapshotStale` e `snapshotUpdatedAt`, permitindo distinguir o banco operacional do último snapshot materializado.
