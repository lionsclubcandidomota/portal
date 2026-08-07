# Homologação — v6.45.0

## Fluxos prioritários do Portal

1. Entrar como Administrador e confirmar que o Dashboard e a Tesouraria carregam normalmente.
2. Criar ou editar uma movimentação sem anexo e confirmar que a publicação anterior continua funcionando.
3. Em **Tesouraria → Movimentações**, selecionar **Programados** e confirmar as somas de entradas previstas, saídas previstas e resultado programado.
5. Em **Aniversariantes**, clicar em **Desejar parabéns** e confirmar que o compartilhamento contém somente a imagem, sem título ou mensagem automática.
5. Confirmar que o resumo informa que os valores programados ainda não alteram o saldo atual e que a seção de realizados fica oculta nesse filtro.
6. Confirmar as situações Ativo, Mútua e Inativo no cadastro.
7. Usar o filtro Mutuários e confirmar que somente esses registros são exibidos.
8. Abrir Mensalidades e confirmar que o Mutuário não aparece.
9. Criar um grupo de Mútuas e confirmar que ele nasce ativo, sem data de baixa e sem cobranças automáticas.
10. Expandir um grupo sem falecimentos e confirmar que a visualização inicial é **Participantes**, sem lista de cobranças vazia.
11. Alternar entre as abas **Cobranças** e **Participantes** e confirmar que as duas listas nunca aparecem simultaneamente.
12. Registrar um falecimento e confirmar que uma cobrança única é criada para cada participante ativo na data do evento.
13. Confirmar que, após o registro, o grupo permanece expandido na aba **Cobranças**, sem repetir a lista completa de participantes acima das cobranças.
14. Expandir o cartão do falecimento e confirmar que o nome, a data, os totais e os participantes cobrados são apresentados no contexto do evento.
15. Usar **Selecionar pendentes deste evento** e confirmar que apenas as cobranças abertas daquele falecimento são marcadas.
16. Abrir a baixa das cobranças e confirmar que os participantes estão agrupados por evento, com grupo e data apresentados uma única vez.
17. Abrir “Registrar falecimento” após rolar outro modal e confirmar que o formulário inicia no topo, sem desalinhamento de avatar, nome ou selo.
18. Repetir o fluxo em desktop, tablet e celular, verificando rolagem, rodapé do modal, espaçamentos e ausência de sobreposição.
19. Encerrar um grupo apenas após informar data e motivo de baixa.
20. Clicar em Sair e confirmar o retorno ao Dashboard em modo visitante, sem erro no console.

## Homologação do Cloudflare R2

1. Entrar como Administrador, redefinir e publicar a senha da Diretoria para o padrão compatível com o Worker.

Execute esta seção somente depois de publicar o Worker e salvar sua URL em Configurações.

1. Em **Configurações → Armazenamento privado de anexos**, testar a conexão com o Worker.
2. Criar uma movimentação com imagem e PDF dentro dos limites permitidos.
3. Publicar e confirmar que a sincronização conclui sem inserir Base64 em `data/dados.json`.
4. Expandir a movimentação e testar **Visualizar** e **Baixar**.
5. Sair, entrar como Diretoria e confirmar que os anexos podem ser consultados.
6. Sair para o modo Visitante e confirmar que os documentos não ficam acessíveis pela interface.
7. Caso existam anexos antigos, confirmar que foram removidos de `public/treasury/` depois da primeira publicação.
8. No painel R2, confirmar que os objetos estão em `treasury/<movimentacao>/...` e que o bucket continua privado.
9. Interromper propositalmente uma publicação de homologação antes do commit e confirmar que o estado oficial não aponta para arquivos incompletos.
10. Fechar ou minimizar o progresso da sincronização e confirmar que o envio continua em segundo plano.


## Migração e homologação do Cloudflare D1

Execute esta seção somente depois de criar o banco, aplicar `0001_portal_private_state.sql` e `0002_admin_auth.sql`, configurar os segredos e publicar o Worker 1.5.0.

1. Abra `/health` e confirme `storage: "cloudflare-r2+d1"`, D1 disponível e inicializado, mas ainda inativo.
2. Publique o Portal 6.39.0, crie o primeiro Administrador e entre com usuário e senha.
3. Abra **Recuperação e integridade** e confirme **Banco pronto para receber os dados**.
4. Registre os totais atuais de movimentações, contas, grupos, mútuas e anexos.
5. Clique em **Migrar para o D1** e confirme a criação do backup prévio no R2.
6. Atualize `/health` e confirme `privateState: "d1"` e `d1.active: true`.
7. Compare as contagens do D1 com os totais registrados antes do corte.
8. Recarregue o Portal, teste uma inclusão, uma edição e uma exclusão e confirme a persistência.
9. Abra anexos antigos e confirme que continuam sendo lidos do mesmo bucket R2.
10. Crie um backup manual e restaure-o; com o D1 ativo, confirme que a restauração atualiza o banco e o espelho do R2.
11. Em homologação, teste **Retornar ao R2**, confirme que os dados mais recentes foram copiados e depois migre novamente para o D1.
12. Confirme que o GitHub Actions continua verde e que `data/dados.json` permanece sem dados financeiros.

## Regressões

- Associados ativos continuam participando das Mensalidades e podem participar das Mútuas.
- Associados inativos não participam de novas cobranças.
- Pagamentos e vínculos históricos permanecem preservados.
- Diretoria continua em modo de consulta e Configurações permanece exclusiva do Administrador.
- Fotos institucionais e de associados continuam públicas conforme a arquitetura atual.
- Sem Worker configurado, o Portal permanece utilizável, mas anexos financeiros ainda seguem o fluxo legado até a ativação.


## Dashboard autenticado

- Validar os quatro cards de resumo em Administrador e Diretoria.
- Confirmar que nomes e títulos longos não sobrepõem os controles.
- Conferir a disposição 7/5 de compromissos e avisos em telas amplas.
- Conferir empilhamento em tablet e celular.
- Validar barras de progresso de Mensalidades e Mútuas com leitor de tela.


## Versão 6.29.0

Antes da homologação funcional, publique o Worker atualizado e execute a migração descrita em `docs/private-data-migration.md`.


## Pipeline de release — versão 6.37.0

1. Execute `npm run release:build`.
2. Confirme que a pasta `dist` contém os três ZIPs e `checksums.sha256`.
3. Execute `npm run release:dist:verify` e confirme a validação dos artefatos.
4. Publique somente o conteúdo de `portal-site-v6.39.0.zip` no GitHub Pages.
5. Atualize o Worker primeiro com o pacote `cloudflare-worker-v1.5.0.zip` quando houver alteração no Worker.


## GitHub Actions — versão 6.37.0

1. Envie a pasta `.github/workflows` ao repositório.
2. Na aba **Actions**, confirme a execução de **Qualidade do Portal**.
3. Confirme que os trabalhos do Portal e do Worker foram aprovados.
4. Execute manualmente **Pacotes de release** e baixe o artefato gerado.
5. Compare `checksums.sha256` com os ZIPs antes da publicação.
6. Confirme que nenhuma execução solicitou token do Portal, segredo do Worker ou permissão de escrita.
7. Depois da primeira execução, configure a proteção da branch conforme `docs/github-actions.md`.

## Salvamento privado sem publicação — versão 6.38.0

1. Confirme que o `/health` informa `privateAutosave: "available"` e `d1.active: true`.
2. Inclua uma movimentação financeira. O indicador deve passar por **Salvando no banco** e terminar em **Banco sincronizado**.
3. Recarregue o Portal e confirme que a movimentação permanece. Não use o botão de publicação nesse teste.
4. Cadastre ou altere uma Mútua e confirme o mesmo comportamento.
5. Crie um aviso público. Somente essa operação deve aparecer como pendência em **Publicar conteúdo público**.
6. Publique o aviso e confirme o GitHub Actions verde.


## Login por usuário e senha — versão 6.39.0

1. Confirme no `/health` `workerVersion: "1.5.0"` e `authentication.initialized: true`.
2. Antes do primeiro usuário, confirme `authentication.bootstrapRequired: true`.
3. Use **Primeiro acesso** e a `ADMIN_BOOTSTRAP_KEY` para criar o Administrador.
4. Entre com usuário e senha; a tela não deve solicitar token GitHub.
5. Salve uma movimentação privada e confirme o D1.
6. Publique um aviso público e confirme que o Worker usa o segredo sem solicitar token.
7. Saia e confirme que a sessão anterior não pode mais acessar as rotas privadas.


## Gravação granular de grupos — versão 6.41.0

1. Aplique `0004_group_granular_writes.sql` e publique o Worker 1.7.0 antes do Portal.
2. Confirme no `/health` `schemaVersion: 3`, `privateAutosave: "granular-treasury-groups"` e `granularWrites.groups: true`.
3. Crie um grupo familiar, aguarde **Banco sincronizado**, recarregue a página e confirme nome, titular e participantes.
4. Edite somente um grupo familiar e confirme que movimentações e Mútuas permanecem inalteradas.
5. Crie ou edite um grupo de Mútuas, altere participantes e confirme persistência após recarregar.
6. Registre um falecimento e confirme que o evento e a lista congelada de participantes reaparecem após recarregar.
7. Tente repetir a mesma solicitação em uma simulação de falha de rede e confirme ausência de grupos ou eventos duplicados.
8. Abra o painel do D1 e confirme que as linhas gravadas cresceram apenas de forma compatível com os grupos e vínculos alterados.
9. Crie uma movimentação e confirme que o endpoint granular da Tesouraria continua funcionando.
10. Confirme que nenhuma alteração privada cria pendência em **Publicar conteúdo público**.


## Leituras SQL do Dashboard e relatórios — versão 6.42.0

1. Publique o Worker 1.8.0 ainda com o esquema D1 3 e confirme que login, salvamento e anexos continuam funcionando.
2. Aplique `0005_analytics_read_models.sql`.
3. Confirme no `/health` `schemaVersion: 4` e `optimizedReads.dashboard/reports: true`.
4. Publique o Portal 6.42.0.
5. Abra o Dashboard Administrativo e confirme o selo **D1 · consulta otimizada** no card da Tesouraria.
6. Alterne entre mês atual, mês anterior, trimestre, ano e período personalizado; confira os totais com a tela de Movimentações.
7. Gere o relatório de Movimentações e confirme que somente o período selecionado aparece.
8. Gere Mensalidades e Mútuas em PDF e CSV e confira nomes, valores, baixas e totais.
9. Interrompa temporariamente a rede e confirme que o Dashboard e os relatórios continuam pelo fallback local.
10. No painel D1, confirme aumento de linhas lidas compatível com as consultas, sem aumento de linhas gravadas causado apenas pela visualização.

## Fonte relacional e paginação — versão 6.43.0

1. Publique o Worker 1.9.0 antes da migração 0006.
2. Confirme que o login e as gravações continuam funcionando no esquema anterior.
3. Aplique `0006_relational_operational_source.sql`.
4. Confirme `/health` com esquema 5, `relationalSource: true` e `treasuryPagination: true`.
5. Publique o Portal 6.43.0.
6. Abra Movimentações e confirme `D1 · consulta paginada`.
7. Teste pesquisa, filtros e páginas independentes.
8. Faça uma alteração privada e confirme que `snapshot_stale` fica ativo sem impedir leitura, backup ou rollback.

## Mensalidades e Mútuas paginadas — versão 6.44.0

1. Publique o Worker 1.10.0.
2. Aplique `0007_operational_memberships_mutuals.sql`.
3. Confirme esquema D1 6 e `optimizedReads.memberships/mutuals: true` no `/health`.
4. Publique o Portal 6.44.0.
5. Em Mensalidades, teste período, família, situação, pesquisa e páginas.
6. Em Mútuas, teste grupo, período, situação, pesquisa, páginas e limpeza da seleção ao trocar de página.
7. Registre uma mensalidade e uma baixa de Mútua e valide a atualização após recarregar.
8. Confirme que o fallback local continua disponível ao simular indisponibilidade da rota operacional.



## Bootstrap privado reduzido — versão 6.45.0

1. Publique o Worker 1.11.0 e aplique `0008_private_bootstrap_reference.sql`.
2. Abra `/health` e confirme esquema 7, `optimizedReads.privateBootstrap: true`, `granularWrites.reference: true` e política de snapshot para recuperação.
3. Publique o Portal 6.45.0, entre como Administrador e confirme que o login apresenta o carregamento privado reduzido.
4. Abra **Tesouraria → Movimentações** e confirme que a lista é carregada sob demanda pelo D1, com paginação e totais corretos.
5. Edite e exclua uma movimentação visível, recarregue a página e confirme que registros não carregados não foram removidos.
6. Abra **Mensalidades** e **Mútuas** e confirme que o conjunto de pagamentos necessário permanece disponível após o login.
7. Crie ou edite conta, categoria e configuração financeira privada e confirme **Banco sincronizado**, sem publicação pública pendente.
8. Crie um backup manual e confirme que o snapshot completo é materializado para recuperação.
9. Confirme que avisos, agenda e associados continuam seguindo o fluxo de publicação pública no GitHub.
