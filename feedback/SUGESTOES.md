# Sugestões do jogo

Feitas dentro do jogo com a tecla **Q**. Peça ao Claude: *"aplique minhas sugestões pendentes"*.

## Pendentes (0)

_Nenhuma._

## Feitas (2)

### S-001 · Área do mapa: Área de 6×4 tiles
- **Status:** feito · **Quando:** 2026-11-07T15:20:32 · **Mapa:** Vila de Alvorada (tile [29, 11])
- **Onde no código:** js/world.js (geração de vila) · js/data.js → MAPS.vila
- **Sugestão:** isso é so um teste mesmo
- ![print](img/S-001.png)
- **Resposta do Claude:** Era um teste do modo sugestão — funcionou! Nada a mudar no jogo.

### S-002 · Área do mapa: Área de 6×3 tiles
- **Status:** feito · **Quando:** 2026-11-07T15:35:55 · **Mapa:** Campos de Verdelume (tile [26, 12])
- **Onde no código:** js/world.js (geração de campos) · js/data.js → MAPS.campos
- **Sugestão:** ignora o print mas percebi que a musica que eu entrei aqui se sobrepos com a utra. Nao pode ser as duas. Tem que ser so a do mapa viegente

Outra coisa. QUando eu clicar em enter aqui na sugestao tem que ir direto e nao dar um salto de linha
- ![print](img/S-002.png)
- **Resposta do Claude:** Música: ao trocar de mapa a música anterior agora baixa e é cortada em 0,6s, então só toca a do mapa atual; e o jogo silencia quando a aba não está visível (evita duas abas tocando juntas). Sugestão: Enter agora envia direto; Shift+Enter pula linha.
