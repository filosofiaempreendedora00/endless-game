# Crônicas de Aethra online: o plano

Este é o plano para o Aethra virar um jogo **multiplayer de verdade**, com várias pessoas jogando juntas num servidor na internet. Está escrito para quem não é da área. Cada fase deixa o jogo funcionando: nada para de rodar no meio do caminho.

## Jogar junto agora (mesma rede / mesmo Wi-Fi)

1. No seu computador, rode o servidor no modo online:

```bash
python3 server.py --online
```

2. O terminal mostra um endereço como `http://192.168.x.x:5577`. Quem estiver no mesmo Wi-Fi abre esse endereço no navegador, **cria uma conta** (usuário e senha), cria o próprio personagem e entra.
3. Você continua abrindo `http://localhost:5577` e entra direto, sem senha, na sua conta de administrador (`robertofpj`). Só você, neste computador, é o administrador: Painel do Mestre, God Mode, comandos de teste e barrinha de ASPD.
4. Para fechar a porta para a rede, pare o servidor (Ctrl+C) e rode `python3 server.py` de novo, sem `--online`.

**Senha da sua conta** (para entrar de outro computador quando o jogo estiver na internet). Rode no terminal; a senha é pedida sem aparecer na tela:

```bash
python3 server.py --set-password robertofpj
```

Também dá para trocá-la no Painel do Mestre (⌘+Z) → "Conta do administrador".

## Como o jogo funciona hoje
- **O seu navegador faz quase tudo.** Desenha o mundo, move os monstros, calcula o dano, sorteia os drops, controla zeny, inventário, loja e refino.
- **O servidor (`server.py`) faz pouco.** Entrega os arquivos do jogo, cuida das contas e dos personagens (no banco `db/aethra.db`, com espelho em `saves/`), guarda as sugestões e cuida da Arena, onde ele já é o juiz do HP.

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

### Fase 2: contas de verdade *(feita em 2026-11-10)*
- **Contas:** quem vem de fora vê a tela "Entrar / Criar conta" antes dos personagens.
  - Usuário de 3 a 20 caracteres e senha de pelo menos 6.
  - "Lembrar de mim" mantém a pessoa conectada por 30 dias; sem marcar, 12 horas.
  - Na tela dos personagens há "Sair da conta".
  - Personagens criados na fase 1 naquele mesmo navegador passam para a conta ao entrar.
- **Senhas seguras:** no banco fica só uma versão embaralhada da senha (PBKDF2, 200 mil voltas), e a sessão também é guardada embaralhada. Quem errar a senha 5 vezes espera 10 minutos.
- **Banco de dados** (`db/aethra.db`, SQLite, que já vem no Python): é onde ficam contas e personagens agora.
  - Na primeira vez que o servidor sobe, ele **lê** os `saves/*.json` (sem mexer neles) e coloca os seus na sua conta `robertofpj`: Vidro, Gertrudes, Paulico e os outros.
  - A cada gravação, o personagem também é escrito em `saves/<nome>.json` do mesmo jeito de antes: é a cópia de segurança "à moda antiga".
- **Cópia do banco** todo dia em `backups/` (guarda as últimas 14).
- **Nomes únicos:** nomes de personagem são únicos no mundo inteiro, e ninguém de fora vê, grava ou apaga personagem de outra conta.

**Ainda falta (próximas fases):**
- **Conexão segura (HTTPS):** obrigatória quando for para a internet; vem junto com a hospedagem (fase 5).
- **Conexão contínua (WebSocket):** substitui o "perguntar a cada 0,2 s" e deixa tudo mais rápido e leve. Fica para a fase 3; talvez precise de uma biblioteca, e vou pedir a sua permissão antes.
- **Recuperar senha por e-mail:** hoje, quem esquecer a senha precisa que você defina uma nova pelo comando `--set-password`.

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
