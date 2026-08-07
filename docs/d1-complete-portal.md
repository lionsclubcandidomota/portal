# Portal integral no Cloudflare D1 — v6.47.0

## Arquitetura final

```text
GitHub Pages / hospedagem estática
└── HTML, CSS, JavaScript, favicon e recursos fixos da aplicação

Cloudflare Worker
├── autenticação e autorização
├── regras de negócio
├── API pública e privada
├── publicação estruturada
└── acesso controlado às mídias e aos anexos

Cloudflare D1
├── associados
├── agenda e eventos
├── reuniões e avisos
├── configurações públicas e privadas
├── usuários, sessões e auditoria
├── contas, categorias e movimentações
├── mensalidades e grupos familiares
├── grupos, eventos e cobranças de Mútuas
├── revisões por módulo
└── histórico de publicações públicas

Cloudflare R2
├── logo e fotos públicas dinâmicas
├── comprovantes e documentos privados
└── backups e snapshots de recuperação
```

O arquivo operacional `data/dados.json` deixa de integrar o site publicado. O diretório estático também deixa de transportar fotos de associados e anexos financeiros.

## Fonte de verdade

O D1 é a fonte única dos dados estruturados. O navegador consulta somente o módulo ou a página necessária. O snapshot JSON permanece restrito à recuperação, importação, exportação e rollback.

O R2 não guarda regras de negócio. Ele mantém os arquivos binários, enquanto o D1 mantém metadados, relacionamentos, revisões e referências aos objetos.

## Conteúdo público

A rota pública é:

```text
GET /api/public/state
```

Ela reconstrói o conteúdo público a partir de tabelas normalizadas e nunca inclui Tesouraria, grupos financeiros, hashes, sessões ou outras coleções privadas.

As mídias públicas são servidas por:

```text
GET /api/public/media?key=public/...
```

As respostas usam ETag e cache público. Quando a revisão não mudou, o Worker responde `304 Not Modified` após ler somente os metadados da revisão; não percorre associados, agenda, reuniões ou avisos.

## Publicação administrativa

O botão de publicação continua existindo para agrupar alterações públicas e permitir revisão antes da confirmação. A operação agora grava diretamente no D1 e envia novas mídias ao R2.

```text
Revisar alterações públicas
→ validar fronteira de dados
→ enviar novas mídias ao R2
→ gravar tabelas públicas em lote no D1
→ incrementar revisão pública
→ atualizar a interface
```

Se o lote do D1 falhar, os novos objetos enviados naquela tentativa são removidos do R2.

## Sincronização

A verificação normal ocorre a cada 60 segundos, ao voltar para a aba, ao focar a janela e ao trocar de área. A rota de revisão lê somente os registros de revisão dos módulos. As coleções são consultadas apenas quando alguma revisão mudou.

O módulo público também participa da sincronização. Alterações feitas em outra sessão aparecem sem recarregar a página inteira.

## Migração inicial

A migração `0010_public_portal_d1.sql` cria as tabelas públicas e eleva o esquema D1 para 9.

Durante a implantação, `PUBLIC_DATA_URL` deve apontar temporariamente para o `data/dados.json` ainda publicado pela versão 6.46.0. No primeiro login administrativo após a migração, o Worker importa:

- configurações públicas;
- 32 associados do conjunto atual;
- 12 eventos;
- 3 reuniões;
- 2 avisos;
- logo e fotos públicas existentes.

Somente depois de confirmar o conteúdo no D1 deve-se publicar o Portal 6.47.0, que remove o JSON e as mídias dinâmicas do pacote estático.

## Segredos

Permanecem necessários:

- `SESSION_SECRET`;
- `ADMIN_BOOTSTRAP_KEY`.

`GITHUB_TOKEN` não é utilizado pela arquitetura 6.47.0 e pode ser removido depois da homologação da migração.
