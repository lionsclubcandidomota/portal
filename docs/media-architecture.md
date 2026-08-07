# Mídias, anexos e backups — v6.47.0

## Separação

```text
D1
└── metadados, relacionamentos, checksum, tipo, tamanho e objectKey

R2
├── public/logo.png
├── public/members/...
├── treasury/<movimentação>/...
└── __portal/backups/...
```

O site estático não transporta mais fotos dinâmicas de associados nem comprovantes.

## Mídias públicas

Logo e fotos cadastradas são enviadas ao R2 na publicação. O D1 armazena referências canônicas `r2://public/...`; a API pública converte essas referências em URLs do Worker.

As respostas usam cache imutável e ETag. Uma mídia só recebe um novo objeto quando seu conteúdo é alterado.

## Anexos privados

Comprovantes e documentos continuam privados. Administrador ou Diretoria solicita **Visualizar** ou **Baixar**, o Worker valida a sessão e emite um ticket temporário. O objeto é transmitido sem exposição de credenciais ou URL permanente.

## Consistência entre D1 e R2

Na publicação pública:

1. novas mídias são validadas e enviadas ao R2;
2. tabelas e referências são gravadas em lote no D1;
3. se o lote falhar, os novos objetos são removidos;
4. após sucesso, objetos marcados como excluídos são removidos.

Na Tesouraria, o D1 mantém a referência do anexo vinculada à movimentação. O diagnóstico de integridade identifica referências ausentes, inválidas, duplicadas e objetos órfãos.

## Limites principais

- mídia pública individual: até 8 MB;
- conjunto de mídias de uma publicação: até 24 MB;
- até 5 anexos por movimentação;
- validações de formato e tamanho no navegador e no Worker.
