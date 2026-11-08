---
name: gosto-do-roberto
description: Perfil vivo do gosto do Roberto como criador de Crônicas de Aethra, destilado de todas as sugestões que ele fez no jogo (tecla Q). Use SEMPRE que for aplicar sugestões de feedback/sugestoes.json, ao mexer em qualquer visual, interface, monstro, classe, mundo ou sensação de jogo do Aethra, e quando o Roberto pedir ideias ou "o que melhorar" no jogo. Ao terminar cada rodada de sugestões, esta skill deve ser atualizada.
---

# O gosto do Roberto (Crônicas de Aethra)

Esta skill existe para duas coisas:
1. **Acertar de primeira**: antes de implementar qualquer coisa, consulte o perfil e entregue já do jeito que ele gosta, sem esperar a próxima reclamação.
2. **Propor por conta própria**: com o perfil afiado, você enxerga o que ele ainda vai pedir e sugere antes.

Ela **evolui a cada rodada de sugestões**. O perfil é uma hipótese que as próximas sugestões confirmam ou corrigem.

## Arquivos
- `perfil.md`: princípios de gosto com peso e evidências (ids S-xxx), antipadrões e o checklist de entrega. **Leia antes de implementar.**
- `rodadas.md`: histórico de cada rodada (o que ele pediu, o que se repetiu, o que aprendemos). Serve para medir se estamos melhorando.
- `propostas.md`: como funcionam as melhorias que **você** propõe. Elas ficam em `feedback/propostas.json` e o Roberto as aprova ou recusa no jogo (janela L).

## Ao aplicar sugestões (junto com o fluxo do CLAUDE.md)
1. Leia `perfil.md` inteiro, depois as sugestões pendentes e os prints.
2. Para cada sugestão, identifique quais princípios ela toca. Se um princípio já existia, aplique-o **de forma ampla**, como ele mesmo pediu em S-039: leve o feedback para os elementos parecidos, não só para o que foi clicado. Diga isso na `resposta`.
3. Antes de entregar, passe o **checklist de entrega** do perfil (escala, flutuação, atravessar objetos, bordas da água, música duplicada, cara humana...) nos elementos que você tocou.
4. Implemente, teste e marque como feito (fluxo do CLAUDE.md).

## Ao terminar a rodada: atualize a skill (obrigatório)
1. **Em `rodadas.md`**: adicione a rodada com data, ids, temas e uma linha por aprendizado.
   - Uma **reincidência** é quando ele reclama de novo de algo já "feito". É o sinal mais forte de que o perfil ou a entrega falhou. Registre-a e suba o peso do princípio.
2. **Em `perfil.md`**:
   - Some as evidências novas aos princípios. Ajuste os pesos (★ a ★★★★★) pela frequência e pela intensidade da linguagem ("muuuito feio", "horroroso", "bug" pesam mais).
   - Crie um princípio quando aparecer um padrão novo. Rebaixe o que ficou velho.
   - Uma frase literal curta dele vale mais que uma paráfrase longa.
3. **Em `feedback/propostas.json`**:
   - Leia as recusas e seus motivos (aprendizado!) e marque como feitas as propostas que a rodada resolveu.
   - Proponha de 1 a 3 itens novos, se o perfil indicar algo que ele ainda não pediu.
4. Não guarde aqui o que já está no código ou no CLAUDE.md. Aqui fica o **porquê do gosto**, não a implementação.

## Ao propor melhorias por conta própria
Quando ele pedir ideias, ou ao fim de uma rodada:
1. Percorra as telas e o mundo: vitrine, criador, mundo, janelas, monstros e montarias. Use `__api.shot` e prints numa cópia de teste, nunca com o Vidro.
2. Compare o que vê com cada princípio de `perfil.md`. Cada desvio vira uma proposta candidata.
3. Priorize por: **peso do princípio × quanto aparece na tela × reincidências do tema ÷ esforço**.
4. Escreva em `feedback/propostas.json` (P-xxx), cada uma com o princípio, as evidências S-xxx e o que exatamente mudar. Apresente as 3 melhores numa frase cada.
   - Não implemente sem o "sim" dele, a não ser que seja bug evidente (atravessar, flutuar, música duplicada).
