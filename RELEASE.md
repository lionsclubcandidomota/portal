# Release 6.46.0

Data: 07/08/2026

## Escopo

- Portal 6.46.0: sincronização automática e atualização seletiva dos módulos privados.
- Worker 1.12.0: revisões por módulo e endpoints leves de referência e grupos.
- D1 esquema 8: tabela `portal_module_revisions` e sinalização `module_revision_sync`.

## Ordem obrigatória de implantação

1. Extrair o Worker 1.12.0.
2. Copiar o `wrangler.toml` já configurado da versão anterior.
3. Executar:

   ```bash
   npm ci
   npx wrangler deploy --config wrangler.toml
   ```

4. Aplicar a migração:

   ```bash
   npx wrangler d1 migrations apply lions-portal-dados --remote --config wrangler.toml
   ```

5. Confirmar a aplicação de `0009_module_revisions.sql`.
6. Conferir o `/health` com Worker 1.12.0 e esquema D1 8.
7. Publicar o Portal 6.46.0 no GitHub Pages.

O Worker pode ser publicado antes da migração. Enquanto o esquema 8 ainda não estiver ativo, as rotas anteriores continuam operando e a sincronização automática fica apenas indisponível.

## Resultado esperado no `/health`

```json
{
  "workerVersion": "1.12.0",
  "privateState": "d1",
  "d1": {
    "active": true,
    "schemaVersion": 8,
    "requiredSchemaVersion": 8
  },
  "automaticSync": {
    "available": true,
    "intervalSeconds": 45,
    "refreshOnFocus": true,
    "moduleRevisions": true
  },
  "snapshotPolicy": "recovery-only"
}
```

## Testes recomendados

1. Abra o Portal em dois navegadores ou computadores.
2. No primeiro, registre uma movimentação e aguarde **Banco sincronizado**.
3. No segundo, mantenha a tela de Movimentações aberta e aguarde até 45 segundos, ou retorne para a aba.
4. Confirme que os dados são consultados novamente sem `F5`.
5. Altere uma categoria ou conta e confirme a atualização automática na outra sessão.
6. Edite um grupo familiar ou de Mútua e confira a atualização seletiva.
7. Mantenha um formulário aberto e confirme que a sincronização é adiada até o fechamento.
8. Teste o botão manual de atualização como contingência.

## Segurança

- As rotas exigem sessão autenticada.
- Nenhuma senha, token ou conteúdo de anexo é retornado nas revisões.
- Atualizações são adiadas quando há dados locais não confirmados.
- O snapshot permanece reservado para backup e recuperação.
