# Release 6.44.0

Data: 07/08/2026

## Escopo

- Portal 6.44.0: Mensalidades e Mútuas passam a usar consultas operacionais específicas e paginadas no D1.
- Worker 1.10.0: adiciona o diretório relacional de associados e as rotas operacionais de mensalidades e eventos de Mútuas.
- D1 esquema 6: cria `portal_members`, índices operacionais e ativa `operational_memberships` e `operational_mutuals`.

## Ordem obrigatória de implantação

1. Extrair o Worker 1.10.0.
2. Copiar para a nova pasta o `wrangler.toml` já configurado do Worker anterior.
3. Executar `npm ci`.
4. Publicar primeiro o Worker 1.10.0:

   ```bash
   npx wrangler deploy --config wrangler.toml
   ```

5. Aplicar a migração:

   ```bash
   npx wrangler d1 migrations apply lions-portal-dados --remote --config wrangler.toml
   ```

6. Confirmar a aplicação de `0007_operational_memberships_mutuals.sql`.
7. Conferir o `/health` com Worker 1.10.0, esquema D1 6 e leituras de Mensalidades/Mútuas habilitadas.
8. Publicar o Portal 6.44.0 no GitHub Pages.

O Worker 1.10.0 mantém as rotas anteriores durante a implantação. As novas rotas operacionais só respondem quando o esquema 6 estiver ativo; até lá, o Portal utiliza o modelo local de contingência.

## Diretório relacional de associados

A tabela `portal_members` mantém somente a projeção necessária para relacionar os associados públicos com mensalidades, grupos e Mútuas. O diretório é atualizado:

- no mesmo fluxo de uma publicação pública bem-sucedida;
- automaticamente pelo Worker quando estiver vazio ou desatualizado há mais de 24 horas;
- manualmente pela rota administrativa `POST /api/operational/member-directory/sync`.

Nenhuma senha, sessão ou informação financeira é copiada para essa tabela.

## Mensalidades paginadas

A rota autenticada:

```text
GET /api/operational/memberships
```

aplica no D1:

- mês inicial e final;
- pesquisa por associado, número ou grupo;
- filtro de grupo familiar;
- situação paga, pendente ou todas;
- paginação dos associados;
- totais de unidades previstas, pagas e pendentes;
- valor recebido no período.

A interface identifica a origem com `D1 · consulta paginada` e mantém fallback local automático.

## Mútuas paginadas por evento

A rota autenticada:

```text
GET /api/operational/mutuals
```

aplica no banco:

- grupo de mutuários;
- intervalo de falecimentos;
- pesquisa por falecido, participante ou grupo;
- situação das cobranças;
- paginação por evento;
- totais previstos, recebidos, pagos e pendentes.

A interface identifica a origem com `D1 · eventos paginados`. A seleção de cobranças é descartada ao trocar de página para impedir baixas invisíveis ou fora do recorte atual.

## Testes recomendados

1. Entrar como Administrador e abrir **Tesouraria → Mensalidades**.
2. Confirmar o selo `D1 · consulta paginada`.
3. Testar período, pesquisa, grupo familiar, situação e paginação.
4. Comparar as quantidades pagas e pendentes com o período conhecido.
5. Abrir **Tesouraria → Mútuas** e confirmar `D1 · eventos paginados`.
6. Testar grupo, datas, pesquisa, situação e páginas de eventos.
7. Selecionar cobranças pendentes, trocar de página e confirmar que a seleção anterior foi limpa.
8. Registrar uma mensalidade e uma baixa de Mútua; recarregar a página e conferir os resultados.
9. Confirmar que nenhuma consulta ou operação privada criou commit no GitHub.

## Compatibilidade e contingência

O estado privado completo ainda é reconstruído após o login para formulários e telas que dependem do contrato legado. Esta versão remove a carga pesada das listas de Mensalidades e Mútuas, mas não elimina completamente o estado compatível do navegador. Em falha de rede ou indisponibilidade das novas rotas, as telas usam o estado local já carregado.
