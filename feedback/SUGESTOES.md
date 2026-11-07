# Sugestões do jogo

Feitas dentro do jogo com a tecla **Q**. Peça ao Claude: *"aplique minhas sugestões pendentes"*.

## Pendentes (0)

_Nenhuma._

## Feitas (5)

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

### S-003 · Área do mapa: Área de 8×5 tiles
- **Status:** feito · **Quando:** 2026-11-07T15:42:56 · **Mapa:** Campos de Verdelume (tile [10, 29])
- **Onde no código:** js/world.js (geração de campos) · js/data.js → MAPS.campos
- **Sugestão:** gostaria de ter alguma forma de minimizar esse chat pra ele nao me atrapalhar quando eu nao o quisesse
- ![print](img/S-003.png)
- **Resposta do Claude:** Chat agora tem botão "—" para minimizar: vira um botãozinho "💬 Chat" que mostra quantas mensagens novas chegaram. Clique nele ou aperte Enter para abrir. A escolha fica lembrada.

### S-004 · Área do mapa: Área de 9×3 tiles
- **Status:** feito · **Quando:** 2026-11-07T15:43:41 · **Mapa:** Campos de Verdelume (tile [19, 31])
- **Onde no código:** js/world.js (geração de campos) · js/data.js → MAPS.campos
- **Sugestão:** gostaria que isso aqui ficasse la em cima ao lado do card pricipal do meu nome e não aqui embaixo
- ![print](img/S-004.png)
- **Resposta do Claude:** A barra de atalhos (1–9) foi para o topo, ao lado do card com seu nome; os ícones de buff ficam logo abaixo dela. Obs.: ao marcar uma área por cima da interface, a sugestão agora também registra quais partes da interface estavam dentro.

### S-005 · Área do mapa: Área de 21×21 tiles
- **Status:** feito · **Quando:** 2026-11-07T15:44:52 · **Mapa:** Campos de Verdelume (tile [13, 13])
- **Onde no código:** js/world.js (geração de campos) · js/data.js → MAPS.campos
- **Sugestão:** gostaria que o god mode permitisse que eu fosse qualquer classe. EU pudesse facilmente escolher ali a minha classe quando entrasse no menu do god mode
- ![print](img/S-005.png)
- **Resposta do Claude:** No Painel do Mestre (⌘+Z) há a seção "Classe": clique em qualquer uma das 13 classes para virar ela na hora (recebe a arma típica da classe). O botão "Todas as habilidades da classe no máximo" libera tudo para testar.
