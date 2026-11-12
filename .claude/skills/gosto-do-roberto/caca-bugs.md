# Caça-bugs do Aethra

Pedido do Roberto (2026-11-12): a skill também precisa **caçar bugs claros**, os que ele sente jogando, para irmos resolvendo antes que ele tenha de apertar Q.
O exemplo dele: no navio "eu ficava meio que dando uns teleportes".

## O que é "bug claro"
É o que um jogador comum percebe em segundos, sem procurar. Quatro famílias:
1. **Corpo e movimento**: teleporte, tremedeira, ficar preso, atravessar parede ou objeto, afundar no piso, cair do mapa, rodopiar sozinho (S-300, S-310, S-331).
2. **Câmera**: sair pela parede, herói sumir atrás de objeto, ver o "vazio" fora da sala.
3. **Mundo**: objeto flutuando ou enterrado, água vazando, grama no piso de pedra, área cinza ou vazia, portal escondido (S-025, S-056, S-166, S-179, S-181).
4. **Sistema e tela**: duas músicas ao mesmo tempo (S-032), nome de monstro visível de longe (S-096), janela que volta ao topo sozinha (S-101), recorte errado do Q (S-380), engasgo ou lag (S-069, S-240).

**Não é bug claro**: gosto, estética ou "podia ser mais bonito". Isso vai para `propostas.json`.

## Como caçar (numa cópia de teste, nunca com o Vidro)
1. **Verificador automático**: `__api.qa()` ou o Painel do Mestre → "🔍 Verificar o mundo". Rode a partir da vila (`teleport3d(0,10)`), nunca da Arena. Ele já mede:
   - **Mundo**: flutuando, enterrado, colisão menor que o objeto, NPC dentro de objeto.
   - **Jogabilidade** (`checkPlay`, em `js3d/qa3d.js`):
     - saída de cada porta livre (fora de parede, sem prender, fora da água);
     - chegada dos andares;
     - todo NPC alcançável a até 4,6 m (a conversa vale até 5 m);
     - nenhum monstro dentro de objeto ou na água funda.
   - **Câmera nas salas** (`checkRoomCamera`): em cada sala, a câmera gira em 5 pontos × 8 direções e nunca pode sair da caixa da sala.
   - **Música**: só uma por vez.
   - **Personagens**: 13 classes × 3 raças (`__api.qaChars()`).
2. **Ganchos para testes manuais**: `__api.ctx()` devolve `resolve`, `trulyStuck`, `portals`, `enterInterior`, `leaveInterior`, `waterLevelAt`, `camera`...
3. **Sondas na mão**. São bugs que só aparecem andando:
   - **Empurrar paredes**: segure W contra uma parede por 4 s e registre os saltos quadro a quadro (deslocamento > 0,35 m num quadro = teleporte). Faça no navio, nas casas e nas muralhas.
   - **Bordas de piso**: tablados (`DECKS`), cais, terraços de Pedrafunda e escadas. Ande pela beira e pelos degraus. O herói não pode afundar nem saltar de altura.
   - **Portas**: entre e saia de cada sala. A câmera precisa mostrar o herói e ele não pode sair dentro de parede.
   - **Câmera**: gire 360° encostado na parede da porta (o pior ponto).
   - **Desempenho**: o teste de câmera contra modelos gigantes trava o quadro. Objeto com mais de 60 mil faces é ignorado pela câmera e avisa no console. Modelo grande (castelo, muralha) usa caixas invisíveis como oclusor.
4. **Releia as sugestões antigas**, pelas palavras: bug, teleporte, preso, travado, atravessa, flutua, lag, volta ao topo. Um bug "feito" pode ter voltado: reincidência é o sinal mais forte.

## Como reportar e agir
- Liste os bugs por **quanto o jogador sente × quantas vezes acontece**, cada um com onde, como reproduzir e a causa provável.
- **Bug claro e de causa evidente: corrija sem esperar.** Ele mesmo disse que "não pode acontecer" (S-300). Diga o que mudou.
- Bug que exige escolha de design (ex.: tirar uma regra de física): pergunte antes.
- Falso alarme do verificador: registre aqui em "Falsos alarmes conhecidos", para não reabrir.
- Ao criar um sistema novo de movimento, câmera ou sala, acrescente uma checagem em `checkPlay`/`checkRoomCamera`. O caça-bugs cresce com o jogo.

## Registro de caçadas
### 2026-11-12: primeira caçada
- **Teleporte no navio, corrigido.** O destravador automático (S-300) achava que o herói estava "preso" só porque a parede barrava a frente: a cada 0,4 s ele o jogava 0,5 m para trás. Valia para **qualquer parede** do jogo.
  - Agora ele só age se o herói estiver dentro de algo ou sem nenhuma direção livre (`trulyStuck`).
  - O salto vertical do destravamento ficou limitado a 1,2 m, para não pular do navio para o cais.
- **Câmera saindo da sala, corrigido.** Em 10 salas (taverna, estábulo, catacumbas 1–4, torreão, taverna do porto, armazém, castelo), virando a câmera para a porta ela saía pela parede e o herói sumia.
  - Causa: o filtro de oclusores olhava a *posição* do grupo, e as paredes das salas são montadas na origem.
  - Agora a câmera fica presa na caixa da sala e o filtro usa a caixa real do objeto.
- **Engasgo perto do castelo e da Muralha Gélida, corrigido.** A câmera testava raio contra 23 mil faces (castelo, ~12 ms por quadro) e 95 mil faces (muralha, ~75 ms). Agora ela bate em caixas invisíveis.
- **A conferir**: o verificador acusa 7 montes de "escombros" nas Ruínas (perto de -26,-248; 12,-232; 51,-405...) sem colisão. São pedrinhas baixas e espalhadas, então talvez seja de propósito. Mas o S-302 pediu para não atravessar escombros: confira de perto se algum é alto.
- Dados íntegros: drops, cartas, missões, habilidades e lojas apontam para coisas que existem.

### 2026-11-12: segunda caçada (castelo de Valcinza)
- **Grama no portão, corrigido.** Entre a portaria e a ponte o chão era grama e terra. O calçamento da passagem e o da ponte eram montados no centro do pátio, escondidos debaixo dele, porque `terrainPlane` não movia a placa para o lugar certo.
- **Sol vazando pelo teto das salas, corrigido.** Faixas claras na diagonal no fundo do salão do trono, no Salão das Lâminas e na cozinha.
  - Causa: a sombra do sol cobria só 38 m em volta do herói, e fora disso o teto não fazia sombra.
  - Agora, em sala coberta, a sombra cobre a sala inteira e fica centrada nela (main3d, antes de `updateDayNight`). Vale para todas as salas; a Arena, aberta, continua igual.
- **Melhorias com bom senso** (ambiente, não bug):
  - Janelas de verdade (vidro em losangos, mainel, arco, peitoril) nas salas laterais; vitrais na capela.
  - Tapeçarias tecidas no lugar dos retângulos lisos (trono e quarto real).
  - Quarto de hóspedes mobiliado.
  - Forno de pão de tijolo na cozinha.
  - Pátio com campo de treino (alvos, suportes de armas), canto da cavalariça (feno, bebedouro, carrinho, balde) e carga junto das casas.
- **Sinal para o futuro**: sala grande demais e vazia (13 m de pé-direito, paredes lisas) é o ponto fraco do castelo. Ao mexer nele, prefira encher o que existe a criar sala nova.

### Falsos alarmes conhecidos
- **Gudrun e Irmão Hulda** (Pedrafunda) ficam 1,35 m acima do chão de propósito, na base da estátua e no degrau do templo. Dá para conversar com eles de baixo.
- "NPC dentro de objeto" para NPCs sentados ou atrás de balcão (Dona Rosa, Velho Gui, Rei Aldemar, Irmão Caio, Ilka...): o círculo de colisão do móvel os cobre, mas o jogador conversa normalmente.
