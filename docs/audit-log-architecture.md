# Histórico de alterações e observabilidade

## Objetivo

A Fase 8 adiciona rastreabilidade às operações administrativas sem incluir o histórico no arquivo público `data/dados.json`. O histórico é mantido localmente no navegador usado para administrar o portal.

## Estrutura

```text
assets/js/modules/
├── audit-log.js
└── audit-log/
    ├── controller.js
    ├── domain.js
    ├── storage.js
    └── view.js
```

- `domain.js`: normalização do administrador, sanitização das diferenças, lotes, estados e resumos.
- `storage.js`: envelope versionado armazenado no `localStorage`.
- `controller.js`: registro das operações, associação com publicações, exportação e abertura da interface.
- `view.js`: histórico consultável, filtros, busca e detalhes das alterações.

## Ciclo de uma alteração

1. O formulário altera o estado em memória e chama `persist(mensagem)`.
2. A persistência compara o estado anterior salvo com o estado atual.
3. A diferença é registrada em um lote pendente.
4. Novas operações antes da publicação são associadas ao mesmo lote.
5. Ao publicar, o lote recebe o SHA, o endereço do commit e o identificador de implantação.
6. Quando o GitHub Pages confirma a propagação, o lote passa para o estado confirmado.
7. Se as alterações forem descartadas ou substituídas por uma recarga, o lote registra o desfecho correspondente.

## Identificação do administrador

Após a conexão administrativa, o portal consulta o usuário autenticado no GitHub e mantém somente:

- ID público;
- login;
- nome público;
- endereço público do avatar.

O token, o e-mail e outras propriedades da conta não são gravados.

## Privacidade

O histórico usa a mesma revisão sanitizada da Central de Publicações:

- senhas aparecem apenas como “senha protegida”;
- imagens aparecem apenas como “imagem anterior” ou “nova imagem”;
- tokens nunca fazem parte do estado ou do histórico;
- o histórico não é publicado no portal público;
- somente as 400 operações mais recentes são mantidas.

## Armazenamento

Chave local:

```text
lionsCandidoMota.audit.v1
```

O histórico possui exportação JSON independente do backup de dados do portal.

## Estados dos lotes

- `pending`: alterações ainda não enviadas;
- `published`: commit criado, propagação pública ainda não confirmada;
- `confirmed`: conteúdo disponível no portal público;
- `discarded`: alterações descartadas antes do envio;
- `replaced`: alterações substituídas ao recarregar os dados publicados.
