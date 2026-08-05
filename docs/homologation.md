# Homologação — v6.35.1

## Fluxos prioritários do Portal

1. Entrar como Administrador e confirmar que o Dashboard e a Tesouraria carregam normalmente.
2. Criar ou editar uma movimentação sem anexo e confirmar que a publicação anterior continua funcionando.
3. Confirmar as situações Ativo, Mútua e Inativo no cadastro.
4. Usar o filtro Mutuários e confirmar que somente esses registros são exibidos.
5. Abrir Mensalidades e confirmar que o Mutuário não aparece.
6. Criar um grupo de Mútuas e confirmar que ele nasce ativo, sem data de baixa e sem cobranças automáticas.
7. Registrar um falecimento e confirmar que uma cobrança única é criada para cada participante ativo na data do evento.
8. Baixar uma cobrança e confirmar que o lançamento fica vinculado ao grupo, ao falecimento e ao participante, sem competência mensal.
9. Expandir o grupo de Mútuas e confirmar que todos os participantes ativos aparecem antes dos eventos.
10. Abrir “Registrar falecimento” após rolar outro modal e confirmar que o formulário inicia no topo, sem desalinhamento de avatar, nome ou selo.
11. Encerrar um grupo apenas após informar data e motivo de baixa.
12. Clicar em Sair e confirmar o retorno ao Dashboard em modo visitante, sem erro no console.

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


## Pipeline de release — versão 6.35.1

1. Execute `npm run release:build`.
2. Confirme que a pasta `dist` contém os três ZIPs e `checksums.sha256`.
3. Execute `npm run release:dist:verify` e confirme a validação dos artefatos.
4. Publique somente o conteúdo de `portal-site-v6.35.1.zip` no GitHub Pages.
5. Atualize o Worker primeiro com o pacote `cloudflare-worker-v1.2.0.zip` quando houver alteração no Worker.


## GitHub Actions — versão 6.35.1

1. Envie a pasta `.github/workflows` ao repositório.
2. Na aba **Actions**, confirme a execução de **Qualidade do Portal**.
3. Confirme que os trabalhos do Portal e do Worker foram aprovados.
4. Execute manualmente **Pacotes de release** e baixe o artefato gerado.
5. Compare `checksums.sha256` com os ZIPs antes da publicação.
6. Confirme que nenhuma execução solicitou token do Portal, segredo do Worker ou permissão de escrita.
7. Depois da primeira execução, configure a proteção da branch conforme `docs/github-actions.md`.
