# Homologação — Portal 6.47.0 / Worker 1.13.0

## Antes do corte

1. Mantenha o Portal 6.46.0 publicado.
2. Confirme que `data/dados.json`, logo e fotos antigas estão acessíveis.
3. Publique o Worker 1.13.0 com `PUBLIC_DATA_URL` temporária.
4. Aplique `0010_public_portal_d1.sql`.
5. Entre novamente como Administrador para iniciar a importação.

## Conferência da migração

1. Verifique `/health` com esquema 9 e `structuredDataSource: "cloudflare-d1"`.
2. Confirme 32 associados, 12 eventos, 3 reuniões e 2 avisos.
3. Abra algumas fotos pela rota `/api/public/media`.
4. Confirme que o D1 contém uma revisão pública e que o R2 contém os objetos `public/...`.
5. Teste login, logout, Movimentações, Mensalidades, Mútuas, relatórios e anexos.

## Publicação do novo front-end

1. Publique somente o conteúdo de `portal-site-v6.47.0.zip`.
2. Confirme que o pacote não contém `data/dados.json`, `public/members` ou `public/treasury`.
3. Abra o Portal em janela anônima e valide página inicial, associados, agenda, reuniões e avisos.
4. Altere um aviso, publique e confirme a nova revisão no D1.
5. Em outra sessão, confirme a atualização sem F5 em até 60 segundos ou ao retornar para a aba.
6. Recarregue novamente e confirme resposta pública por ETag/304 quando não houver mudança.

## Integridade e recuperação

1. Crie um backup manual.
2. Confirme que anexos privados continuam em Visualizar e Baixar.
3. Execute o diagnóstico de integridade.
4. Mantenha uma cópia dos pacotes 6.46.0 e 1.12.0 durante a janela de homologação.

## Encerramento

Depois da aprovação, remova `PUBLIC_DATA_URL`. O segredo `GITHUB_TOKEN`, caso ainda esteja cadastrado, também pode ser excluído.
