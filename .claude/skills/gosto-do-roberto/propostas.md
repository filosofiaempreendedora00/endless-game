# Propostas do Claude

As propostas ficam em **`feedback/propostas.json`**: é a fonte única, lida e gravada pelo jogo.

O Roberto vê as propostas na janela **L → aba "🤖 Propostas do Claude"** e aprova ou recusa com um clique. Ao recusar, ele pode escrever o motivo.

## Formato
```json
{ "id": "P-006", "titulo": "curto", "detalhe": "o que muda, em pt-BR simples",
  "principios": ["nome do princípio do perfil.md"], "evidencias": ["S-039"],
  "status": "proposta", "resposta": "(ao concluir) o que foi feito", "motivo": "(se recusada) escrito por ele" }
```

## Status
- `proposta`: nova, esperando a decisão dele.
- `aprovada`: ele aprovou. Quando ele pedir *"aplique as propostas aprovadas"*, implemente, mude para `feita` e escreva uma `resposta`.
- `recusada`: ele recusou. **Leia o `motivo`**, que diz muito sobre o gosto dele. Registre o aprendizado em `rodadas.md` e ajuste `perfil.md`. Não proponha de novo a mesma coisa.
- `feita`: concluída.

## Regras
- Nunca mude o status de uma proposta que ele aprovou ou recusou sem que ele peça.
- Novas propostas recebem o próximo id (P-xxx) e entram com `status: "proposta"`.
- Faça poucas e boas: de 1 a 3 por rodada, priorizadas como descrito no `SKILL.md`.
