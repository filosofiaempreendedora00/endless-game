# Crônicas de Aethra *(nome provisório)*

Um RPG de ação 2D no navegador, com espírito de MMORPG clássico: **matar monstros, subir de nível, escolher uma carreira de classes em Y e caçar cartas raras** que dão personalidade aos equipamentos.

> Projeto pessoal de longo prazo. Esta é a versão **0.1 (MVP)**: tudo roda offline, num único arquivo HTML, sem instalar nada.

## Como jogar

**Jeito mais simples:** abra o arquivo `index.html` no navegador (Chrome, Edge, Firefox ou Safari).

**Com servidor local** (recomendado durante o desenvolvimento):

```bash
python3 -m http.server 8777
```

Depois acesse http://localhost:8777. O progresso é salvo automaticamente no navegador.

### Controles

| Ação | Comando |
|---|---|
| Andar | Clique no chão (segure para continuar andando) |
| Atacar | Clique no monstro |
| Pegar item | Clique no item ou aperte **Z** |
| Habilidades/itens | Teclas **1–9** |
| Sentar (regenera 2× mais rápido) | **X** |
| Personagem / Inventário / Equipamento | **C** / **I** / **E** |
| Habilidades / Árvore de Classes / Ajuda | **K** / **T** / **H** |
| Som liga/desliga | **N** |
| Chat / comandos | **Enter** (digite `/ajuda`) |
| Zoom | Roda do mouse |

**Comandos de teste:** `/taxa 10` (EXP 10×), `/nivel 30`, `/classe 30`, `/zeny 5000`, `/item pocao_azul 10`, `/carta lobo_cinzento`, `/ir ruinas`, `/cura`, `/resetar`.

## O que já existe (v0.1)

- **Carreira em Y:** Aprendiz → 4 classes (Guerreiro, Mago, Arqueiro, Ladino) → 8 especializações (2 por classe), com um espaço reservado para a 3ª classe.
- **31 habilidades** (ativas e passivas), com conjuração, recarga, área de efeito, congelamento, atordoamento, veneno, buffs e roubo de itens.
- **Nível de Base e Nível de Classe** separados, com pontos de atributo (FOR, AGI, VIT, INT, DES, SOR) e de habilidade.
- **Sistema de cartas:** cada um dos 13 monstros tem uma carta única. Equipamentos têm espaços [ ] e a carta inserida é permanente.
- **Elementos:** Água > Fogo > Terra > Vento > Água; Sagrado ⇄ Sombra.
- **4 mapas:** Vila de Alvorada (cidade), Campos de Verdelume, Bosque Sussurrante e Ruínas de Kael, com 2 mini-chefes e 1 chefe.
- **NPCs:** mentora de classes, mercador (compra e venda), curandeira e guarda com dicas.
- **Trilha sonora original** gerada em tempo real (uma música por mapa) e efeitos sonoros.
- Drops no chão, números de dano, chat com balão de fala, minimapa e salvamento automático.

## Como o código está organizado

| Arquivo | O que faz |
|---|---|
| `js/data.js` | **Conteúdo do jogo**: classes, habilidades, itens, monstros, cartas, mapas e taxas. É o arquivo mais editado. |
| `js/game.js` | Regras: combate, progressão, IA dos monstros, NPCs, entrada e loop principal. |
| `js/ui.js` | Interface: HUD, janelas, loja, diálogos, árvore de classes e tela inicial. |
| `js/render.js` | Visual: tudo é desenhado com código (sem imagens ainda). |
| `js/world.js` | Geração dos mapas e pathfinding (A*). |
| `js/audio.js` | Músicas e efeitos sonoros (Web Audio). |

**Quer criar um monstro novo?** Adicione uma entrada em `MONSTERS` (em `data.js`) e coloque-o em `spawns` de um mapa. A carta dele é criada automaticamente.

## Roadmap (ideias para as próximas versões)

**Curto prazo**
- [ ] Refinamento de equipamentos (+1 a +10, com chance de quebrar)
- [ ] Armazém e mais NPCs na vila
- [ ] Missões simples (matar X, coletar Y)
- [ ] Mais mapas, monstros e um calabouço com andares
- [ ] Equipamentos visíveis no personagem (chapéus!)

**Médio prazo**
- [ ] Arte própria (sprites) e música composta
- [ ] 3ª classe (o terceiro despertar)
- [ ] Mercenários / companheiros controlados por IA (prévia de grupo)
- [ ] Ajustes de balanceamento e curva de experiência

**Longo prazo — o lado MMO**
- [ ] Servidor multiplayer (outros jogadores no mesmo mapa)
- [ ] **Grupos** com divisão de EXP
- [ ] **Guildas** com emblema, chat e eventos
- [ ] Contas, comércio entre jogadores e economia
- [ ] Publicação para o público

## Créditos

Inspirado no estilo dos MMORPGs clássicos, com conteúdo, nomes, arte e música originais.
