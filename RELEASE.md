# Release 6.43.0

Data: 07/08/2026

## Escopo

- Portal 6.43.0: movimentações passam a usar paginação e pesquisa diretamente no D1, com fallback local automático.
- Worker 1.9.0: tabelas relacionais tornam-se a fonte principal do estado privado e o snapshot sai das gravações granulares diárias.
- D1 esquema 5: ativa a fonte relacional, os modelos operacionais e a política de snapshot somente para recuperação.

## Ordem obrigatória de implantação

1. Extrair o Worker 1.9.0.
2. Copiar para a nova pasta o `wrangler.toml` já configurado do Worker anterior.
3. Executar `npm ci`.
4. Publicar primeiro o Worker 1.9.0:

   ```bash
   npx wrangler deploy --config wrangler.toml
   ```

5. Aplicar a migração:

   ```bash
   npx wrangler d1 migrations apply lions-portal-dados --remote --config wrangler.toml
   ```

6. Confirmar a aplicação de `0006_relational_operational_source.sql`.
7. Conferir o `/health` com Worker 1.9.0, esquema D1 5, `relationalSource: true` e paginação operacional ativa.
8. Publicar o Portal 6.43.0 no GitHub Pages.

O Worker 1.9.0 mantém compatibilidade temporária com os esquemas operacionais 3 e 4. O Portal 6.43.0 somente ativa a paginação remota quando o esquema 5 estiver disponível; antes disso, usa o estado local como contingência.

## Fonte oficial dos dados

Após a migração 0006:

```text
Tabelas relacionais D1 → fonte operacional oficial
Snapshot D1/R2          → recuperação, importação e contingência
R2                      → anexos e backups versionados
GitHub Pages            → conteúdo público
```

O login administrativo reconstrói o estado privado a partir das tabelas relacionais. Participantes familiares, vínculos e eventos de Mútuas e anexos são reagrupados pelos relacionamentos do banco.

## Movimentações paginadas

A nova rota autenticada:

```text
GET /api/operational/treasury
```

recebe período, pesquisa, filtro e páginas independentes para programados e realizados. O D1 devolve somente os registros da página, além de:

- contagens dos filtros;
- entradas e saídas do resumo selecionado;
- resultado realizado ou programado;
- total de páginas;
- revisão do banco.

A tela identifica a origem com `D1 · consulta paginada`. Em falha temporária, utiliza `Modo local de contingência` sem bloquear a Tesouraria.

## Política de snapshot

Movimentações e grupos salvos granularmente não regravam mais:

- `portal_state_snapshot`;
- espelho JSON atual no R2.

Essas operações atualizam apenas as tabelas afetadas e marcam `snapshot_stale = 1`. O estado completo continua sendo materializado em:

- migração ou sincronização completa;
- importação e restauração;
- rollback seguro para o R2;
- backups criados pela Central de Recuperação.

## Testes recomendados

1. Entrar como Administrador e confirmar os dados privados existentes.
2. Abrir **Tesouraria → Movimentações** e conferir o selo `D1 · consulta paginada`.
3. Testar Todos, Realizados, Programados, Entradas e Saídas.
4. Pesquisar por descrição e categoria.
5. Navegar entre páginas de realizados e programados.
6. Criar, editar e excluir uma movimentação de teste.
7. Recarregar o Portal e confirmar a persistência.
8. Criar um backup manual e testar a Central de Recuperação.
9. Conferir que nenhuma operação privada criou commit no GitHub.

## Retorno seguro

Se a paginação operacional estiver indisponível, a tela usa o estado privado já carregado. Se for necessário retornar ao backend R2, a Central de Recuperação reconstrói o estado atual pelas tabelas relacionais antes do rollback, evitando perda das alterações feitas depois do último snapshot.
