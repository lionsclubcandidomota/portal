# Release 6.34.0

Esta versão conclui o plano principal de refatoração do Portal com proteção operacional do estado privado no Cloudflare R2.

## Backups remotos

O Worker 1.2.0 passa a manter uma linha do tempo privada em:

```text
__portal/backups/private-state-v1/
```

Antes de substituir o estado principal, o Worker preserva a versão anterior. Depois da gravação, a nova revisão também recebe uma cópia restaurável. São mantidas automaticamente as 20 versões mais recentes.

Cada objeto possui checksum SHA-256, revisão, data, autor e resumo de movimentações, contas e anexos.

## Proteções de escrita

- Controle otimista de revisão continua impedindo conflitos entre sessões.
- Uma publicação que tentaria remover todos os dados privados é bloqueada com erro 422.
- O estado principal é validado pelo checksum antes de ser carregado.
- Uma restauração cria um backup de segurança do estado atual antes de aplicar a versão selecionada.

## Integridade dos anexos

A Central de Recuperação consulta o Worker e informa:

- comprovantes referenciados e encontrados;
- arquivos ausentes;
- referências inválidas ou duplicadas;
- objetos no prefixo `treasury/` sem vínculo com movimentações atuais;
- quantidade de backups disponíveis.

A Diretoria possui consulta somente leitura. Criação manual e restauração de backups permanecem exclusivas do Administrador.

## Validação

- 246 testes automatizados;
- lint e grafo de imports;
- auditorias de CSS, acessibilidade e segurança;
- bloqueio de dados financeiros no pacote público;
- verificação dos endpoints e contratos do Worker;
- artefatos determinísticos e hashes SHA-256.

## Publicação obrigatória

Esta versão altera o Worker. Publique primeiro o pacote `cloudflare-worker-v1.2.0.zip` e confirme no endpoint `/health` os campos:

```json
{
  "privateBackups": "versioned",
  "privateBackupRetention": 20,
  "attachmentIntegrity": "available"
}
```

Depois publique `portal-site-v6.34.0.zip`.
