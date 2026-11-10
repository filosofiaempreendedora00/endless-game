# Crônicas de Aethra online: o plano

Este é o plano para o Aethra virar um jogo **multiplayer de verdade**, com várias pessoas jogando juntas num servidor na internet. Está escrito para quem não é da área. Cada fase deixa o jogo funcionando: nada para de rodar no meio do caminho.

## Jogar junto agora (mesma rede / mesmo Wi-Fi)

1. No seu computador, rode o servidor no modo online:

```bash
python3 server.py --online
```

2. O terminal mostra um endereço como `http://192.168.x.x:5577`. Quem estiver no mesmo Wi-Fi abre esse endereço no navegador, cria o próprio personagem e entra.
3. Você continua abrindo `http://localhost:5577`. Só você, neste computador, é o administrador: Painel do Mestre, God Mode, comandos de teste e barrinha de ASPD.
4. Para fechar a porta para a rede, pare o servidor (Ctrl+C) e rode `python3 server.py` de novo, sem `--online`.

## Como o jogo funciona hoje
- **O seu navegador faz quase tudo.** Desenha o mundo, move os monstros, calcula o dano, sorteia os drops, controla zeny, inventário, loja e refino.
- **O servidor (`server.py`) faz pouco.** Entrega os arquivos do jogo, guarda os saves (`saves/`) e as sugestões, e cuida da Arena, onde ele já é o juiz do HP.

Para jogar sozinho isso basta. Num jogo online é perigoso: quem decide as coisas no próprio navegador pode trapacear (aumentar zeny, dano, itens), e cada jogador veria monstros diferentes.

## O que muda no online (a ideia principal)
**O servidor vira o "juiz" do mundo.** O navegador de cada jogador passa a só **mostrar** o jogo e **pedir** ações ("quero atacar aquele lobo", "quero comprar isto"). O servidor confere se pode, calcula o resultado e avisa todo mundo que está perto.

## As fases

### Fase 1: ver os outros jogadores *(feita em 2026-11-10)*
- Você vê os outros jogadores andando, atacando, sentados e montados, com nome e classe.
- Chat entre todos os jogadores.
- **Saves com dono:** cada personagem pertence a quem o criou.
  - Ninguém de fora vê, apaga ou grava os seus personagens.
  - **O Vidro é protegido:** só o seu computador mexe nele.
- **Modo online opcional** (`python3 server.py --online`): amigos na mesma rede Wi-Fi já conseguem entrar.
- O **Painel do Mestre** e o **God Mode** continuam só no seu computador.

### Fase 2: contas de verdade
- Login com e-mail/usuário e senha (a senha guardada embaralhada, nunca em texto).
- Os saves saem dos arquivos soltos e vão para um banco de dados (SQLite, que já vem no Python), com cópia de segurança automática.
- Conexão segura (HTTPS), obrigatória na internet.
- Conexão contínua com o servidor (WebSocket) no lugar de "perguntar a cada 0,2 s". Isso deixa tudo mais rápido e leve. Para isso talvez seja preciso instalar uma biblioteca, e vou pedir a sua permissão antes.

### Fase 3: o servidor manda no mundo
- **Monstros:** nascem, andam e atacam no servidor, então todos veem o mesmo lobo no mesmo lugar e podem caçá-lo juntos.
- **Dano e drops:** o dano é calculado no servidor, e o drop cai para quem merece.
- **Regras sem duplicação:** as regras de jogo (`js/rules.js`, `js/data.js`) já são separadas da parte gráfica. A ideia é rodar o servidor em **Node.js** (JavaScript, já instalado no seu Mac) para reusar exatamente as mesmas regras, sem reescrever nada.

### Fase 4: economia segura
- Zeny, inventário, loja, refino, cartas e missões passam a ser decididos no servidor.
- Troca entre jogadores, grupo (party) com divisão de experiência e guildas.

### Fase 5: colocar na internet
- **Onde hospedar:** um servidor alugado (VPS), de US$ 5 a 20 por mês para começar, mais um domínio (o nome do site).
- **Manutenção:** backups diários, monitoramento e atualização do jogo sem derrubar quem está jogando.
- **Crescimento:** se muita gente entrar ao mesmo tempo, o mundo é dividido em canais (como nos MMOs clássicos).

## Regras que eu passo a seguir a partir de agora
1. **Regra nova vai para `js/rules.js` / `js/data.js`** (funções puras, sem tela). Assim o servidor da fase 3 reaproveita sem reescrever.
2. **Nada novo guarda progresso só no navegador:** tudo que é do personagem vai no save.
3. **Toda ação que mexe em valor** (zeny, item, XP, dano) passa por um único ponto do código, que depois vira um pedido ao servidor.
4. **Ferramentas de mestre continuam presas ao administrador.**
5. **Cada coisa nova responde a "como isso fica com 2 jogadores vendo ao mesmo tempo?"** antes de ser entregue.
