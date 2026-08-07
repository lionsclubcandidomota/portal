# Release 6.38.0

Esta etapa conclui a separação operacional entre **banco privado** e **publicação pública**.

- Dados privados são salvos automaticamente no D1 pelo Worker 1.4.0.
- Anexos privados continuam no R2.
- O GitHub recebe somente conteúdo público e deixa de ser necessário para registrar operações financeiras.
- Uma fila segura impede perda de alterações em falhas temporárias e permite nova tentativa pelo indicador do cabeçalho.

## Ordem de implantação

1. Publicar o Worker 1.4.0 com os bindings D1 e R2 já configurados.
2. Confirmar no `/health` `workerVersion: "1.4.0"`, `privateAutosave: "available"` e D1 ativo.
3. Publicar o Portal 6.38.0.
4. Entrar como Administrador e testar uma movimentação privada sem usar “Publicar conteúdo público”.
5. Testar um aviso público e confirmar que apenas ele gera pendência de publicação.

O contrato `GET/PUT /api/private-state` continua compatível. Nesta etapa, o Worker atualiza transacionalmente o snapshot canônico e as projeções relacionais do D1 a cada salvamento privado.

---


## Versão 6.37.0

Esta versão introduz a migração segura do estado privado para Cloudflare D1. Publique primeiro o Worker 1.3.0, crie o banco, aplique as migrações e somente depois publique o Portal. O corte de dados é feito pela Central de Recuperação e mantém o R2 como espelho e backup.

O D1 guarda um snapshot canônico e projeções relacionais na mesma transação. O frontend permanece compatível com o contrato atual enquanto a camada SQL fica pronta para futuras rotas granulares.

Guia: `docs/cloudflare-d1-migration.md`.
# Release 6.36.2

Esta versão ajusta o botão **Desejar parabéns** para compartilhar somente a imagem gerada pelo Portal.

## Compartilhamento

O compartilhamento nativo recebe apenas o arquivo PNG. Não são mais enviados título ou mensagem de texto automática.

Quando o navegador não oferece compartilhamento de arquivos, a imagem continua sendo baixada para compartilhamento manual.

## Publicação

Atualize o repositório com `portal-main-v6.36.2.zip` ou publique apenas o site com `portal-site-v6.36.2.zip`.

O Cloudflare Worker permanece na versão 1.2.0 e não precisa ser republicado.
