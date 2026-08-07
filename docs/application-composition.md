# Composição da aplicação — v6.26.0

## Bootstrap

`assets/js/modules/portal-app.js` monta serviços, controladores e dependências de alto nível. O arquivo não contém mais a implementação das páginas.

## Renderização

`assets/js/modules/portal-view-renderer.js` coordena as páginas:

- Dashboard
- Aniversariantes
- Tesouraria
- Agenda
- Avisos
- Dashboard administrativo
- Configurações

Cada página continua usando seu módulo de domínio e view existente. O compositor apenas recebe dependências e escolhe a renderização da rota atual.

## Cadastros

`assets/js/modules/entity-forms.js` controla abertura, submissão, persistência e exclusão.

`assets/js/modules/entity-forms/templates.js` contém:

- Templates de associado, compromisso, evento, reunião e aviso.
- Campos de local presencial ou virtual.
- Opções e sincronização de status.
- Normalização e validação dos locais.

## Portões arquiteturais

- `portal-app.js` deve permanecer abaixo de 500 linhas.
- `entity-forms.js` deve permanecer abaixo de 380 linhas.
- O compositor visual e os templates precisam exportar seus contratos esperados.
- A pasta `assets/css/legacy` não pode ser recriada.
