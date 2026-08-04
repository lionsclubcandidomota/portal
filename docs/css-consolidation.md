# Consolidação da cascata CSS — v6.32.0

## Objetivo

Reduzir o acúmulo histórico de regras sem alterar o resultado visual do Portal. A consolidação remove somente declarações que já eram substituídas posteriormente pelo mesmo seletor, no mesmo contexto responsivo e com o mesmo nível de importância.

## Resultado

| Métrica | Antes | Depois |
|---|---:|---:|
| Declarações | 10.235 | 9.410 |
| Regras | 3.561 | 3.364 |
| Seletores redefinidos | 329 | 254 |
| Sobrescritas | 487 | 325 |
| Bundle CSS | 339.999 bytes | 319.885 bytes |
| Maior fonte | 37.764 bytes | 35.204 bytes |

Foram removidas 825 declarações sem função no resultado final. A última declaração efetiva de cada propriedade foi preservada.

## Garantias aplicadas

- O mapa final de propriedades por seletor e contexto permaneceu idêntico.
- A ordem relativa das 9.410 declarações restantes foi preservada.
- Todos os valores finais substitutos foram reconhecidos pelo navegador de homologação.
- Componentes representativos foram comparados em 1365 px, 820 px e 400 px.
- As comparações visuais ficaram idênticas pixel a pixel.
- Os 242 testes e todas as auditorias permaneceram aprovados.

## Novo portão

A auditoria `npm run audit:css` passa a reprovar qualquer propriedade que permaneça em uma regra quando outra regra posterior com o mesmo seletor, contexto e importância já a substitui.

Isso impede que ajustes futuros sejam acrescentados indefinidamente no fim da cascata sem remover a configuração que ficou obsoleta.

## Orçamentos

- Até 27 fontes.
- Zero regras exatamente duplicadas.
- Zero declarações já substituídas.
- Até 280 seletores redefinidos.
- Até 360 regras de sobrescrita.
- Até 36.000 bytes por fonte.
- Até 330.000 bytes no bundle.
