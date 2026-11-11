#!/usr/bin/env python3
"""Servidor local do jogo + caixa de sugestões.

Uso:
    python3 server.py            # abre em http://localhost:5577
    python3 server.py 9000       # outra porta
    python3 server.py --relatorio  # só regenera feedback/SUGESTOES.md
    python3 server.py --online     # abre para a rede (outras pessoas jogam junto; veja docs/ONLINE.md)
    python3 server.py --online 9000
    python3 server.py --set-password robertofpj   # define a senha de uma conta (pede no teclado, sem mostrar)

As sugestões feitas no jogo (tecla Q) ficam em:
    feedback/sugestoes.json   (dados completos, lidos pelo Claude)
    feedback/SUGESTOES.md     (versão legível)
    feedback/img/S-XXX.png    (print do que foi marcado)
"""
import base64
import datetime
import json
import os
import re
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
FB_DIR = os.path.join(ROOT, 'feedback')
IMG_DIR = os.path.join(FB_DIR, 'img')
DB = os.path.join(FB_DIR, 'sugestoes.json')
MD = os.path.join(FB_DIR, 'SUGESTOES.md')
PROPS = os.path.join(FB_DIR, 'propostas.json')  # propostas do Claude (aba na janela L)
PROP_STATUS = ('proposta', 'aprovada', 'recusada', 'feita')
LOCK = threading.Lock()
MAX_BODY = 8 * 1024 * 1024
DEFAULT_PORT = 5577

# ---------------- Arena PvP (em memória; o servidor é o juiz do HP) ----------------
import math
import random
import time
ARENA_LOCK = threading.Lock()
ARENA = {'players': {}, 'events': [], 'seq': 0}
ARENA_FIELDS = ('name', 'cls', 'look', 'hat', 'skin', 'x', 'z', 'yaw', 'moving', 'anim', 'maxHp', 'def', 'mdef', 'flee', 'baseLv')


def arena_event(kind, **kw):
    ARENA['seq'] += 1
    ARENA['events'].append({'seq': ARENA['seq'], 'kind': kind, 't': time.time(), **kw})
    ARENA['events'] = ARENA['events'][-200:]


def arena_spawn():
    a = random.random() * 6.283
    r = 6 + random.random() * 9
    return {'x': 800 + r * math.cos(a), 'z': r * math.sin(a)}


def arena_tick():
    now = time.time()
    for pid, p in list(ARENA['players'].items()):
        if now - p['seen'] > 8:  # saiu (fechou a aba) — some da arena
            del ARENA['players'][pid]
            arena_event('saiu', who=p.get('name'))
        elif p['dead'] and now >= p['respawn']:
            p['dead'] = False
            p['hp'] = p.get('maxHp', 100)
            sp = arena_spawn()
            p['tp'] = sp  # o cliente reaparece aqui
            arena_event('voltou', who=p.get('name'), id=pid)


HEAL_SOURCES = ('cura', 'pocao', 'habilidade', 'regen')
HEAL_ONE = 0.6      # uma cura sozinha vale no máximo 60% do HP máximo
HEAL_WINDOW = 10.0  # e, somando tudo, no máximo 150% do HP máximo a cada 10 s (contra trapaça)
HEAL_BUDGET = 1.5


def arena_heal(pid, p, amount, src):
    """P-002: o servidor decide quanto da cura vale (o HP é dele); devolve o quanto curou de fato."""
    if not p or p['dead']:
        return 0
    try:
        amount = int(amount)
    except (TypeError, ValueError):
        return 0
    mx = int(p.get('maxHp') or 100)
    if amount <= 0:
        return 0
    now = time.time()
    log = [h for h in p.get('heals', []) if now - h[0] < HEAL_WINDOW]
    used = sum(h[1] for h in log)
    allowed = max(0, min(amount, int(mx * HEAL_ONE), int(mx * HEAL_BUDGET) - used, mx - p['hp']))
    if allowed > 0:
        p['hp'] += allowed
        log.append((now, allowed))
        arena_event('cura', to=pid, amt=allowed, src=src if src in HEAL_SOURCES else 'cura')
    p['heals'] = log
    return allowed


def arena_view(pid, since):
    me = ARENA['players'].get(pid)
    others = [{'id': k, **{f: v.get(f) for f in ARENA_FIELDS}, 'hp': v['hp'], 'dead': v['dead'], 'kills': v['kills'], 'deaths': v['deaths']}
              for k, v in ARENA['players'].items() if k != pid]
    you = None
    if me:
        you = {'hp': me['hp'], 'dead': me['dead'], 'kills': me['kills'], 'deaths': me['deaths'], 'respawn': max(0, me['respawn'] - time.time())}
        if me.get('tp'):
            you['tp'] = me.pop('tp')
    evs = [e for e in ARENA['events'] if e['seq'] > since]
    return {'you': you, 'players': others, 'events': evs, 'seq': ARENA['seq']}
SAVES_DIR = os.path.join(ROOT, 'saves')
TRASH_DIR = os.path.join(SAVES_DIR, 'lixeira')
SAVE_LOCK = threading.Lock()

# ---------------- Online (fase 1): dono de cada save, presença no mundo e chat ----------------
import hashlib
LOCAL_ADDRS = ('127.0.0.1', '::1', '::ffff:127.0.0.1')
PRIVATE_PREFIXES = ('/saves', '/feedback', '/.git', '/.claude', '/server.py', '/ONLINE.md', '/db', '/backups', '/docs')  # quem vem de fora não lê arquivos internos


def owner_hash(token):
    """O navegador de cada jogador guarda um token aleatório; no save fica só o hash dele (não dá para descobrir o token)."""
    t = str(token or '').strip()
    if not re.fullmatch(r'[A-Za-z0-9_-]{16,128}', t):
        return None
    return hashlib.sha256(('aethra:' + t).encode()).hexdigest()[:40]


WORLD_LOCK = threading.Lock()
WORLD = {'players': {}, 'chat': [], 'seq': 0}
WORLD_FIELDS = ('name', 'cls', 'look', 'hat', 'wpn', 'off', 'skin', 'mount', 'x', 'y', 'z', 'yaw', 'anim', 'moving', 'room', 'hp', 'maxHp', 'baseLv', 'sit', 'dead', 'riding', 'atk', 'clip', 'speed')
WORLD_NEAR = 150.0   # vê quem está a até 150 m (ou na mesma sala)
WORLD_TTL = 8.0      # sem notícia há 8 s = saiu


def world_tick():
    now = time.time()
    for pid, p in list(WORLD['players'].items()):
        if now - p['seen'] > WORLD_TTL:
            del WORLD['players'][pid]


def world_view(pid, since):
    me = WORLD['players'].get(pid) or {}
    room, mx, mz = me.get('room'), float(me.get('x') or 0), float(me.get('z') or 0)
    out = []
    for k, v in WORLD['players'].items():
        if k == pid:
            continue
        if (v.get('room') or None) != (room or None):
            continue
        try:
            if math.hypot(float(v.get('x') or 0) - mx, float(v.get('z') or 0) - mz) > WORLD_NEAR:
                continue
        except (TypeError, ValueError):
            continue
        out.append({'id': k, **{f: v.get(f) for f in WORLD_FIELDS}, 'age': round(now_age(v), 3)})
    chat = [c for c in WORLD['chat'] if c['seq'] > since]
    return {'players': out, 'chat': chat, 'seq': WORLD['seq'], 't': time.time()}


def now_age(v):
    return time.time() - v['seen']


# ---------------- Online (fase 2): contas, sessões e banco SQLite ----------------
# O banco (db/aethra.db) é a fonte principal dos personagens. saves/<slug>.json continua sendo
# escrito a cada gravação como ESPELHO de segurança (mesmo formato de antes). Na subida do servidor,
# os saves/*.json são lidos (nunca alterados) e importados: os antigos vão para a conta do administrador ("robertofpj").
# Senha de uma conta pela linha de comando (sem subir o servidor): python3 server.py --set-password <usuario>
import hmac
import secrets
import sqlite3
DB_DIR = os.path.join(ROOT, 'db')
ADB_FILE = os.path.join(DB_DIR, 'aethra.db')
BACKUP_DIR = os.path.join(ROOT, 'backups')
BACKUP_KEEP = 14
PBKDF2_ITER = 200_000
SESSION_LONG = 30 * 86400    # "lembrar de mim": 30 dias
SESSION_SHORT = 12 * 3600    # sem lembrar: 12 horas
ADMIN_USER = 'robertofpj'   # conta do administrador (dona dos personagens importados de saves/, inclusive o Vidro)
OLD_ADMIN_USERS = ('roberto',)  # nome antigo: um banco que já o tenha é renomeado
USER_RE = re.compile(r'[A-Za-z0-9_.-]{3,20}')
RESERVED_USERS = {'admin', 'administrador', 'mestre', 'root', 'sistema', 'aethra', 'roberto'}
FAIL_WINDOW, FAIL_MAX_USER, FAIL_MAX_IP = 600, 5, 20   # 5 erros por conta / 20 por IP em 10 min = espera
REG_MAX_IP = 8  # no máximo 8 contas novas por endereço a cada 10 min
ADB_LOCK = threading.RLock()
LOGIN_FAILS = {}
_adb = None


def adb():
    global _adb
    if _adb is None:
        os.makedirs(DB_DIR, exist_ok=True)
        _adb = sqlite3.connect(ADB_FILE, check_same_thread=False, isolation_level=None)  # transações explícitas (BEGIN/COMMIT)
        _adb.row_factory = sqlite3.Row
        _adb.execute('PRAGMA journal_mode=WAL')
        _adb.execute('PRAGMA foreign_keys=ON')
    return _adb


class Tx:
    """with Tx() as c: ... — trava + transação (tudo ou nada)."""
    def __enter__(self):
        ADB_LOCK.acquire()
        self.c = adb()
        self.c.execute('BEGIN IMMEDIATE')
        return self.c

    def __exit__(self, et, ev, tb):
        try:
            self.c.execute('ROLLBACK' if et else 'COMMIT')
        finally:
            ADB_LOCK.release()
        return False


def init_db():
    with ADB_LOCK:
        adb().executescript('''
        CREATE TABLE IF NOT EXISTS contas (
            id INTEGER PRIMARY KEY, usuario TEXT NOT NULL UNIQUE COLLATE NOCASE, senha TEXT,
            admin INTEGER NOT NULL DEFAULT 0, criada REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS sessoes (
            token TEXT PRIMARY KEY, conta INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
            criada REAL NOT NULL, expira REAL NOT NULL, ip TEXT);
        CREATE TABLE IF NOT EXISTS personagens (
            slug TEXT PRIMARY KEY, nome TEXT NOT NULL, conta INTEGER REFERENCES contas(id),
            dono_antigo TEXT, dados TEXT NOT NULL, salvo REAL NOT NULL DEFAULT 0, atualizado REAL NOT NULL);
        CREATE INDEX IF NOT EXISTS personagens_conta ON personagens(conta);
        CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);''')
    with Tx() as c:
        if not c.execute('SELECT 1 FROM contas WHERE usuario=?', (ADMIN_USER,)).fetchone():
            old = None
            for o in OLD_ADMIN_USERS:  # banco criado com o nome antigo da conta do administrador: renomeia (mantém personagens e senha)
                old = c.execute('SELECT id FROM contas WHERE usuario=? AND admin=1', (o,)).fetchone()
                if old:
                    c.execute('UPDATE contas SET usuario=? WHERE id=?', (ADMIN_USER, old['id']))
                    break
            if not old:
                c.execute('INSERT INTO contas(usuario, senha, admin, criada) VALUES (?, NULL, 1, ?)', (ADMIN_USER, time.time()))
    n = import_saves()
    if n:
        print(f'📦 {n} personagem(ns) de saves/ importado(s) para o banco.', flush=True)


def admin_id(c=None):
    r = (c or adb()).execute('SELECT id FROM contas WHERE usuario=?', (ADMIN_USER,)).fetchone()
    return r['id'] if r else None


def import_saves():
    """Lê saves/*.json (sem alterar nada) e traz para o banco o que for novo ou mais recente que o banco.
    Saves sem dono = do Roberto (conta do administrador, ADMIN_USER); saves da fase 1 com dono (_owner) ficam esperando o dono entrar numa conta."""
    if not os.path.isdir(SAVES_DIR):
        return 0
    n = 0
    with Tx() as c:
        aid = admin_id(c)
        for fn in sorted(os.listdir(SAVES_DIR)):
            if not fn.endswith('.json'):
                continue
            try:
                with open(os.path.join(SAVES_DIR, fn), encoding='utf-8') as f:
                    data = json.load(f)
            except (OSError, ValueError):
                continue
            if not isinstance(data, dict) or not data.get('name') or 'cls' not in data:
                continue
            sl, legacy, conta_nome = fn[:-5], data.pop('_owner', None), data.pop('_conta', None)
            saved = float(data.get('savedAt') or 0)
            row = c.execute('SELECT salvo FROM personagens WHERE slug=?', (sl,)).fetchone()
            if row is None:
                dono = aid if not legacy else None
                if conta_nome:  # espelho de um personagem de outra conta (ex.: banco restaurado): volta para a conta dele
                    r2 = c.execute('SELECT id FROM contas WHERE usuario=?', (conta_nome,)).fetchone()
                    dono = r2['id'] if r2 else None
                    legacy = legacy if r2 else (legacy or 'conta:' + str(conta_nome))
                c.execute('INSERT INTO personagens(slug, nome, conta, dono_antigo, dados, salvo, atualizado) VALUES (?,?,?,?,?,?,?)',
                          (sl, str(data['name'])[:40], dono, legacy, json.dumps(data, ensure_ascii=False), saved, time.time()))
                n += 1
            elif saved > (row['salvo'] or 0):  # alguém mexeu no arquivo depois: o mais novo vale
                c.execute('UPDATE personagens SET dados=?, salvo=?, nome=?, atualizado=? WHERE slug=?',
                          (json.dumps(data, ensure_ascii=False), saved, str(data['name'])[:40], time.time(), sl))
                n += 1
    return n


def hash_pw(pw, salt=None, it=PBKDF2_ITER):
    salt = salt or secrets.token_bytes(16)
    h = hashlib.pbkdf2_hmac('sha256', pw.encode('utf-8'), salt, it)
    return f'pbkdf2_sha256${it}${salt.hex()}${h.hex()}'


def check_pw(pw, stored):
    try:
        _, it, s, h = str(stored).split('$')
        calc = hashlib.pbkdf2_hmac('sha256', pw.encode('utf-8'), bytes.fromhex(s), int(it)).hex()
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(calc, h)


DUMMY_HASH = 'pbkdf2_sha256$%d$%s$%s' % (PBKDF2_ITER, '00' * 16, '00' * 32)


def sess_key(tok):
    return hashlib.sha256(('sessao:' + str(tok)).encode()).hexdigest()  # no banco fica só o hash (vazou o banco, não vaza a sessão)


def new_session(conta, ip, remember):
    tok, now = secrets.token_urlsafe(32), time.time()
    exp = now + (SESSION_LONG if remember else SESSION_SHORT)
    with Tx() as c:
        c.execute('INSERT INTO sessoes(token, conta, criada, expira, ip) VALUES (?,?,?,?,?)', (sess_key(tok), conta, now, exp, ip))
    return tok, exp


def session_account(tok):
    t = str(tok or '').strip()
    if not re.fullmatch(r'[A-Za-z0-9_-]{20,100}', t):
        return None
    with ADB_LOCK:
        r = adb().execute('SELECT c.id, c.usuario, c.admin FROM sessoes s JOIN contas c ON c.id = s.conta WHERE s.token=? AND s.expira > ?',
                          (sess_key(t), time.time())).fetchone()
    return dict(r) if r else None


def admin_account():
    with ADB_LOCK:
        r = adb().execute('SELECT id, usuario, admin FROM contas WHERE usuario=?', (ADMIN_USER,)).fetchone()
    return dict(r) if r else None


def login_blocked(ip, user):
    now = time.time()
    for k in list(LOGIN_FAILS):
        LOGIN_FAILS[k] = [t for t in LOGIN_FAILS[k] if now - t < FAIL_WINDOW]
        if not LOGIN_FAILS[k]:
            del LOGIN_FAILS[k]
    return len(LOGIN_FAILS.get('ip:' + ip, [])) >= FAIL_MAX_IP or len(LOGIN_FAILS.get('u:' + user.lower(), [])) >= FAIL_MAX_USER


def login_failed(ip, user):
    for k in ('ip:' + ip, 'u:' + user.lower()):
        LOGIN_FAILS.setdefault(k, []).append(time.time())


def claim_legacy(conta, legacy_owner):
    """Personagens criados na fase 1 (dono = chave do navegador) passam para a conta de quem entrou nesse navegador."""
    if not legacy_owner:
        return 0
    with Tx() as c:
        return c.execute('UPDATE personagens SET conta=?, dono_antigo=NULL WHERE conta IS NULL AND dono_antigo=?', (conta, legacy_owner)).rowcount


def set_password(user, pw):
    """Grava só o hash PBKDF2 da senha (cria a conta se não existir) e derruba as sessões antigas dessa conta."""
    with Tx() as c:
        r = c.execute('SELECT id FROM contas WHERE usuario=?', (user,)).fetchone()
        if r:
            cid = r['id']
            c.execute('UPDATE contas SET senha=? WHERE id=?', (hash_pw(pw), cid))
        else:
            cid = c.execute('INSERT INTO contas(usuario, senha, admin, criada) VALUES (?,?,?,?)',
                            (user, hash_pw(pw), 1 if user.lower() == ADMIN_USER else 0, time.time())).lastrowid
        c.execute('DELETE FROM sessoes WHERE conta=?', (cid,))
    return cid


def cli_set_password(user):
    """python3 server.py --set-password <usuario>: lê a senha do teclado (sem mostrar) ou da entrada padrão; não sobe o servidor."""
    import getpass
    user = str(user or '').strip()
    if not USER_RE.fullmatch(user):
        sys.exit('Usuário inválido: use de 3 a 20 letras, números, ponto, hífen ou _.')
    if sys.stdin.isatty():
        pw = getpass.getpass(f'Nova senha para "{user}": ')
        if pw != getpass.getpass('Repita a senha: '):
            sys.exit('As duas senhas não são iguais. Nada foi alterado.')
    else:
        pw = sys.stdin.readline().rstrip('\r\n')
    if len(pw) < 6 or len(pw) > 128:
        sys.exit('A senha precisa ter de 6 a 128 caracteres. Nada foi alterado.')
    init_db()
    set_password(user, pw)
    print(f'🔐 Senha da conta "{user}" definida (no banco fica só o hash).', flush=True)


def mirror_write(sl, data, user=None):
    """Espelho de segurança: saves/<slug>.json no mesmo formato de antes (o anterior vira .bak)."""
    os.makedirs(SAVES_DIR, exist_ok=True)
    p = save_path(sl)
    out = dict(data)
    if user and user != ADMIN_USER:
        out['_conta'] = user  # só informativo; quem manda é o banco
    try:
        if os.path.exists(p):
            os.replace(p, p + '.bak')
    except OSError:
        pass
    tmp = p + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False)
    os.replace(tmp, p)


def backup_db(force=False):
    """Cópia do banco por dia em backups/aethra-AAAA-MM-DD.db (mantém as 14 mais recentes)."""
    try:
        os.makedirs(BACKUP_DIR, exist_ok=True)
        dst = os.path.join(BACKUP_DIR, f'aethra-{datetime.date.today().isoformat()}.db')
        if os.path.exists(dst) and not force:
            return None
        tmp = dst + '.tmp'
        out = sqlite3.connect(tmp)
        with ADB_LOCK:
            adb().backup(out)
        out.close()
        os.replace(tmp, dst)
        olds = sorted(f for f in os.listdir(BACKUP_DIR) if f.startswith('aethra-') and f.endswith('.db'))
        for f in olds[:-BACKUP_KEEP]:
            os.remove(os.path.join(BACKUP_DIR, f))
        with ADB_LOCK:
            adb().execute('DELETE FROM sessoes WHERE expira < ?', (time.time(),))  # limpa sessões vencidas
        return dst
    except (OSError, sqlite3.Error) as e:
        print(f'⚠️ Backup do banco falhou: {e}', flush=True)
        return None


def backup_loop():
    while True:
        time.sleep(3600)  # confere de hora em hora; cria uma cópia por dia
        backup_db()


def slug(name):
    s = re.sub(r'[^a-z0-9]+', '_', str(name).lower()).strip('_')
    return s[:32] or 'sem_nome'


def save_path(sl):
    return os.path.join(SAVES_DIR, slug(sl) + '.json')


def deleted_ids(name):
    """Identidades (charId) dos personagens com esse nome que foram para a lixeira.
    Personagens antigos sem charId entram como None."""
    ids, pre = set(), slug(name) + '-'
    if os.path.isdir(TRASH_DIR):
        for fn in os.listdir(TRASH_DIR):
            if fn.startswith(pre) and fn.endswith('.json'):
                try:
                    with open(os.path.join(TRASH_DIR, fn), encoding='utf-8') as f:
                        ids.add(json.load(f).get('charId'))
                except (OSError, ValueError):
                    pass
    return ids


def list_saves(owner=None, local=True):
    """Local (o Roberto) vê todos; quem vem de fora só os que têm o seu dono."""
    out = []
    if not os.path.isdir(SAVES_DIR):
        return out
    for fn in os.listdir(SAVES_DIR):
        if not fn.endswith('.json'):
            continue
        try:
            with open(os.path.join(SAVES_DIR, fn), encoding='utf-8') as f:
                s = json.load(f)
            if not local and (not owner or s.get('_owner') != owner):
                continue
            out.append({'slug': fn[:-5], 'name': s.get('name'), 'cls': s.get('cls'), 'baseLv': s.get('baseLv'),
                        'jobLv': s.get('jobLv'), 'mapId': s.get('mapId'), 'savedAt': s.get('savedAt', 0)})
        except (OSError, ValueError):
            continue
    return sorted(out, key=lambda s: s['savedAt'] or 0, reverse=True)


def load():
    try:
        with open(DB, encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except FileNotFoundError:
        return []


def load_props():
    try:
        with open(PROPS, encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (FileNotFoundError, ValueError):
        return []


def save(items):
    os.makedirs(FB_DIR, exist_ok=True)
    tmp = DB + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    os.replace(tmp, DB)
    write_md(items)


def write_md(items):
    def block(s):
        alvo = s.get('alvo') or {}
        lines = [f"### {s.get('id')} · {alvo.get('rotulo', '?')}: {alvo.get('nome', '?')}"]
        meta = [f"**Status:** {s.get('status')}", f"**Quando:** {s.get('criadoEm', '?')}"]
        if s.get('categoria'):
            meta.append(f"**Categoria:** {s['categoria']}")
        if s.get('tela') and s.get('tela') != 'Mundo':
            meta.append(f"**Tela:** {s['tela']}")
        if s.get('mapa'):
            meta.append(f"**Mapa:** {s['mapa'].get('nome')} (tile {s['mapa'].get('tile')})")
        lines.append('- ' + ' · '.join(meta))
        if alvo.get('codigo'):
            lines.append(f"- **Onde no código:** {alvo['codigo']}")
        lines.append(f"- **Sugestão:** {s.get('texto', '').strip()}")
        if s.get('imagem'):
            lines.append(f"- ![print]({s['imagem']})")
        if s.get('resposta'):
            lines.append(f"- **Resposta do Claude:** {s['resposta']}")
        return '\n'.join(lines)

    pend = [s for s in items if s.get('status') != 'feito']
    done = [s for s in items if s.get('status') == 'feito']
    out = ['# Sugestões do jogo', '',
           'Feitas dentro do jogo com a tecla **Q**. Peça ao Claude: *"aplique minhas sugestões pendentes"*.', '',
           f'## Pendentes ({len(pend)})', '']
    out += [block(s) + '\n' for s in pend] or ['_Nenhuma._', '']
    out += [f'## Feitas ({len(done)})', '']
    out += [block(s) + '\n' for s in done] or ['_Nenhuma._', '']
    os.makedirs(FB_DIR, exist_ok=True)
    with open(MD, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # silencioso; sugestões são impressas à parte

    def send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # quem está pedindo: local (o Roberto, administrador, no próprio computador) ou alguém de fora pela rede
    def is_local(self):
        return self.client_address[0] in LOCAL_ADDRS and not self.headers.get('X-Forwarded-For')

    def owner(self):
        return owner_hash(self.headers.get('X-Aethra-Token'))

    # conta de quem pede: a sessão (cabeçalho X-Aethra-Session); no computador do Roberto, sem sessão = conta do administrador
    def account(self):
        if not hasattr(self, '_acct'):
            a = session_account(self.headers.get('X-Aethra-Session'))
            if not a and self.is_local():
                a = admin_account()
            self._acct = a
        return self._acct

    def who(self):
        """Chave de dono para sugestões: a conta (de fora) ou a chave do navegador."""
        a = self.account()
        return ('a:%d' % a['id']) if a and not self.is_local() else self.owner()

    def need_login(self):
        return self.send_json(401, {'erro': 'login', 'msg': 'Entre na sua conta para jogar.'})

    def ip(self):
        return str(self.client_address[0])

    def do_GET(self):
        path = self.path.split('?')[0]
        local = self.is_local()
        if not local and any(path == p or path.startswith(p + '/') or path.startswith(p + '.') for p in PRIVATE_PREFIXES):
            return self.send_json(403, {'erro': 'acesso negado'})
        if path in ('/api/me', '/api/auth/me'):
            a = self.account()
            return self.send_json(200, {'admin': local, 'user': a['usuario'] if a else None, 'logged': bool(a),
                                        'session': bool(session_account(self.headers.get('X-Aethra-Session')))})
        if path == '/api/feedback':
            with LOCK:
                items = load()
            if not local:  # de fora: só as próprias sugestões
                own = self.who()
                items = [i for i in items if own and i.get('_owner') == own]
            return self.send_json(200, [{k: v for k, v in i.items() if k != '_owner'} for i in items])
        if path == '/api/propostas':
            if not local:
                return self.send_json(200, [])
            with LOCK:
                return self.send_json(200, load_props())
        if path == '/api/saves':  # personagens da conta (fase 2: vem do banco)
            a = self.account()
            if not a:
                return self.need_login()
            with ADB_LOCK:
                rows = adb().execute('SELECT slug, dados, salvo FROM personagens WHERE conta=? ORDER BY salvo DESC', (a['id'],)).fetchall()
            out = []
            for r in rows:
                try:
                    s = json.loads(r['dados'])
                except ValueError:
                    continue
                out.append({'slug': r['slug'], 'name': s.get('name'), 'cls': s.get('cls'), 'baseLv': s.get('baseLv'),
                            'jobLv': s.get('jobLv'), 'mapId': s.get('mapId'), 'savedAt': s.get('savedAt', 0)})
            return self.send_json(200, out)
        if path.startswith('/api/save/'):
            a = self.account()
            if not a:
                return self.need_login()
            with ADB_LOCK:
                r = adb().execute('SELECT conta, dados FROM personagens WHERE slug=?', (slug(path[len('/api/save/'):]),)).fetchone()
            if not r or (r['conta'] != a['id'] and not local):
                return self.send_json(404, {'erro': 'personagem não encontrado'})
            try:
                return self.send_json(200, json.loads(r['dados']))
            except ValueError:
                return self.send_json(404, {'erro': 'personagem não encontrado'})
        return super().do_GET()

    def read_json(self, limit):
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0 or n > limit:
            return None
        try:
            return json.loads(self.rfile.read(n))
        except (ValueError, UnicodeDecodeError):
            return None

    # salvar personagem: saves/<nome>.json (mantém o anterior em .bak)
    def save_character(self):
        data = self.read_json(2 * 1024 * 1024)
        if not isinstance(data, dict) or not str(data.get('name', '')).strip() or 'cls' not in data:
            return self.send_json(400, {'erro': 'save inválido'})
        local, a = self.is_local(), self.account()
        for k in ('_owner', '_conta'):
            data.pop(k, None)  # o dono quem decide é o servidor, nunca o que vem no pedido
        if not a:
            return self.need_login()
        sl = slug(data['name'])
        with Tx() as c:
            row = c.execute('SELECT conta, dados, salvo FROM personagens WHERE slug=?', (sl,)).fetchone()
            # nomes são únicos no mundo: de fora só se grava personagem da própria conta
            if row and row['conta'] != a['id'] and not local:
                return self.send_json(403, {'erro': 'nome_ocupado', 'msg': 'Esse nome já pertence a outro jogador. Escolha outro.'})
            # personagem apagado nunca volta: nem por cópia do navegador, nem por uma aba que ficou aberta
            cid = data.get('charId')
            dead = deleted_ids(data['name'])
            if dead and (cid in dead or (cid is None and not row)):
                return self.send_json(200, {'ok': True, 'apagado': True})
            if row:
                try:
                    old = json.loads(row['dados'])
                except ValueError:
                    old = {}
                if old.get('charId') and cid and old['charId'] != cid:  # mesmo nome, outro personagem: não sobrescreve
                    return self.send_json(200, {'ok': True, 'apagado': True})
                if (old.get('savedAt') or 0) > (data.get('savedAt') or 0):
                    return self.send_json(200, {'ok': True, 'ignorado': 'save do projeto é mais recente'})
                conta = row['conta'] if row['conta'] is not None else a['id']
                c.execute('UPDATE personagens SET nome=?, conta=?, dono_antigo=NULL, dados=?, salvo=?, atualizado=? WHERE slug=?',
                          (str(data['name'])[:40], conta, json.dumps(data, ensure_ascii=False), float(data.get('savedAt') or 0), time.time(), sl))
            else:
                conta = a['id']
                c.execute('INSERT INTO personagens(slug, nome, conta, dono_antigo, dados, salvo, atualizado) VALUES (?,?,?,NULL,?,?,?)',
                          (sl, str(data['name'])[:40], conta, json.dumps(data, ensure_ascii=False), float(data.get('savedAt') or 0), time.time()))
            owner = c.execute('SELECT usuario FROM contas WHERE id=?', (conta,)).fetchone()
            try:
                mirror_write(sl, data, owner['usuario'] if owner else None)  # espelho de segurança em saves/
            except OSError as e:
                print(f'⚠️ Espelho do save {sl} não foi escrito: {e}', flush=True)
        return self.send_json(200, {'ok': True})

    # apagar personagem: vai para saves/lixeira (recuperável)
    def do_DELETE(self):
        path = self.path.split('?')[0]
        if not path.startswith('/api/save/'):
            return self.send_json(404, {'erro': 'rota desconhecida'})
        a = self.account()
        if not a:
            return self.need_login()
        sl = slug(path[len('/api/save/'):])
        p = save_path(sl)
        with Tx() as c:
            row = c.execute('SELECT conta, dados FROM personagens WHERE slug=?', (sl,)).fetchone()
            if not row or (row['conta'] != a['id'] and not self.is_local()):  # online: só apaga o próprio personagem
                return self.send_json(404, {'erro': 'personagem não encontrado'})
            c.execute('DELETE FROM personagens WHERE slug=?', (sl,))
            # vai para saves/lixeira (recuperável); a lixeira também impede que ele "volte" por uma aba aberta
            os.makedirs(TRASH_DIR, exist_ok=True)
            stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
            dst = os.path.join(TRASH_DIR, f'{sl}-{stamp}.json')
            if os.path.exists(p):
                os.replace(p, dst)
            else:
                with open(dst, 'w', encoding='utf-8') as f:
                    f.write(row['dados'])
        return self.send_json(200, {'ok': True})

    # o Roberto aprova/recusa uma proposta do Claude pela janela L
    def answer_prop(self):
        data = self.read_json(16 * 1024)
        if not isinstance(data, dict) or data.get('status') not in ('proposta', 'aprovada', 'recusada'):
            return self.send_json(400, {'erro': 'pedido inválido'})
        with LOCK:
            props = load_props()
            p = next((x for x in props if x.get('id') == data.get('id')), None)
            if not p or p.get('status') == 'feita':
                return self.send_json(404, {'erro': 'proposta não encontrada'})
            p['status'] = data['status']
            p['respondidoEm'] = datetime.datetime.now().isoformat(timespec='seconds')
            motivo = str(data.get('motivo') or '').strip()[:500]
            if data['status'] == 'recusada' and motivo:
                p['motivo'] = motivo
            else:
                p.pop('motivo', None)
            if data['status'] == 'proposta':
                p.pop('respondidoEm', None)
            os.makedirs(FB_DIR, exist_ok=True)
            tmp = PROPS + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump(props, f, ensure_ascii=False, indent=2)
            os.replace(tmp, PROPS)
        print(f"🤖 Proposta {p['id']}: {p['status']}", flush=True)
        return self.send_json(200, {'ok': True})

    def arena(self, path):
        data = self.read_json(64 * 1024)
        if not isinstance(data, dict) or not data.get('id'):
            return self.send_json(400, {'erro': 'dados inválidos'})
        pid = str(data['id'])[:64]
        with ARENA_LOCK:
            arena_tick()
            P = ARENA['players']
            if path == '/api/arena/sync':
                p = P.get(pid)
                if not p:
                    p = P[pid] = {'hp': int(data.get('maxHp') or 100), 'dead': False, 'kills': 0, 'deaths': 0, 'respawn': 0, 'seen': time.time()}
                    arena_event('entrou', who=str(data.get('name'))[:24])
                for f in ARENA_FIELDS:
                    if f in data:
                        p[f] = data[f]
                p['seen'] = time.time()
                p['hp'] = min(p['hp'], int(p.get('maxHp') or 100))
                if data.get('heal'):  # cura feita no cliente desde o último sync (poção, habilidade, regeneração)
                    arena_heal(pid, p, data.get('heal'), str(data.get('healSrc') or 'cura')[:12])
                return self.send_json(200, arena_view(pid, int(data.get('since') or 0)))
            if path == '/api/arena/heal':
                p = P.get(pid)
                got = arena_heal(pid, p, data.get('amount'), str(data.get('src') or 'cura')[:12])
                return self.send_json(200, {'ok': got > 0, 'healed': got, 'hp': p['hp'] if p else 0})
            if path == '/api/arena/hit':
                a, t = P.get(pid), P.get(str(data.get('to')))
                if not a or not t or a['dead'] or t['dead']:
                    return self.send_json(200, {'ok': False})
                dmg = max(1, min(99999, int(data.get('dmg') or 0)))
                miss = bool(data.get('miss'))
                if not miss:
                    t['hp'] = max(0, t['hp'] - dmg)
                arena_event('golpe', frm=pid, to=data.get('to'), dmg=0 if miss else dmg, crit=bool(data.get('crit')), miss=miss, tipo=str(data.get('kind') or 'fisico')[:12])
                if t['hp'] <= 0 and not t['dead']:
                    t['dead'] = True
                    t['deaths'] += 1
                    a['kills'] += 1
                    t['respawn'] = time.time() + 5
                    arena_event('morte', killer=a.get('name'), victim=t.get('name'), to=data.get('to'))
                return self.send_json(200, {'ok': True, 'hp': t['hp']})
            if path == '/api/arena/leave':
                if pid in P:
                    arena_event('saiu', who=P[pid].get('name'))
                    del P[pid]
                return self.send_json(200, {'ok': True})
        return self.send_json(404, {'erro': 'rota desconhecida'})

    # contas (fase 2): cadastro, entrada, saída e senha do administrador
    def auth(self, path):
        data = self.read_json(16 * 1024) or {}
        if not isinstance(data, dict):
            data = {}
        ip = self.ip()
        if path == '/api/auth/logout':
            tok = self.headers.get('X-Aethra-Session')
            if tok:
                with Tx() as c:
                    c.execute('DELETE FROM sessoes WHERE token=?', (sess_key(tok),))
            return self.send_json(200, {'ok': True})
        if path == '/api/auth/admin-password':  # só no computador do Roberto: define/troca a senha da conta do administrador
            if not self.is_local():
                return self.send_json(403, {'erro': 'só o administrador'})
            pw, pw2 = str(data.get('senha') or ''), str(data.get('confirmar') or '')
            if len(pw) < 6 or len(pw) > 128:
                return self.send_json(400, {'erro': 'senha', 'msg': 'A senha precisa ter pelo menos 6 caracteres.'})
            if pw != pw2:
                return self.send_json(400, {'erro': 'senha', 'msg': 'As duas senhas não são iguais.'})
            set_password(ADMIN_USER, pw)
            return self.send_json(200, {'ok': True, 'msg': f'Senha da conta "{ADMIN_USER}" definida.'})
        user = str(data.get('usuario') or '').strip()
        pw = str(data.get('senha') or '')
        remember = bool(data.get('lembrar'))
        if path == '/api/auth/register':
            if not USER_RE.fullmatch(user):
                return self.send_json(400, {'erro': 'usuario', 'msg': 'O usuário precisa ter de 3 a 20 letras, números, ponto, hífen ou _.'})
            if user.lower() in RESERVED_USERS or user.lower() == ADMIN_USER:
                return self.send_json(409, {'erro': 'usuario', 'msg': 'Esse nome de usuário não está disponível.'})
            if len(pw) < 6 or len(pw) > 128:
                return self.send_json(400, {'erro': 'senha', 'msg': 'A senha precisa ter pelo menos 6 caracteres.'})
            login_blocked(ip, '')  # limpa marcas velhas
            if len(LOGIN_FAILS.get('reg:' + ip, [])) >= REG_MAX_IP:  # contra criação de contas em massa (por endereço)
                return self.send_json(429, {'erro': 'espera', 'msg': 'Muitas contas criadas daqui agora. Espere alguns minutos.'})
            LOGIN_FAILS.setdefault('reg:' + ip, []).append(time.time())
            try:
                with Tx() as c:
                    cid = c.execute('INSERT INTO contas(usuario, senha, admin, criada) VALUES (?,?,0,?)', (user, hash_pw(pw), time.time())).lastrowid
            except sqlite3.IntegrityError:
                return self.send_json(409, {'erro': 'usuario', 'msg': 'Esse nome de usuário já existe. Escolha outro ou entre.'})
        elif path == '/api/auth/login':
            if login_blocked(ip, user):
                return self.send_json(429, {'erro': 'espera', 'msg': 'Muitas tentativas erradas. Espere 10 minutos e tente de novo.'})
            with ADB_LOCK:
                r = adb().execute('SELECT id, senha FROM contas WHERE usuario=?', (user,)).fetchone()
            if not r or not r['senha'] or not check_pw(pw, r['senha']):
                login_failed(ip, user)
                if r is None:
                    check_pw(pw, DUMMY_HASH)  # mesmo tempo de resposta com ou sem conta (não revela quem existe)
                return self.send_json(401, {'erro': 'login', 'msg': 'Usuário ou senha incorretos.'})
            cid = r['id']
        else:
            return self.send_json(404, {'erro': 'rota desconhecida'})
        tok, exp = new_session(cid, ip, remember)
        claimed = claim_legacy(cid, self.owner())  # personagens da fase 1 criados neste navegador passam para a conta
        with ADB_LOCK:
            name = adb().execute('SELECT usuario FROM contas WHERE id=?', (cid,)).fetchone()['usuario']
        return self.send_json(200, {'ok': True, 'user': name, 'session': tok, 'expira': exp, 'reivindicados': claimed})

    # presença no mundo e chat entre jogadores (fase 1 do online: o servidor só repassa)
    def world(self, path):
        data = self.read_json(64 * 1024)
        if not isinstance(data, dict) or not data.get('id'):
            return self.send_json(400, {'erro': 'dados inválidos'})
        pid = str(data['id'])[:64]
        now = time.time()
        if not self.is_local() and not self.account():  # fase 2: no mundo online só entra quem está numa conta
            return self.need_login()
        with WORLD_LOCK:
            world_tick()
            P = WORLD['players']
            if path == '/api/world/sync':
                p = P.get(pid)
                if not p:
                    p = P[pid] = {'seen': now, 'last': 0}
                if now - p['last'] >= 0.08:  # limite simples: no máximo ~12 atualizações por segundo
                    for f in WORLD_FIELDS:
                        if f in data:
                            v = data[f]
                            if isinstance(v, str):
                                v = v[:64]
                            p[f] = v
                    p['name'] = str(p.get('name') or 'Aventureiro')[:24]
                    p['last'] = now
                p['seen'] = now
                return self.send_json(200, world_view(pid, int(data.get('since') or 0)))
            if path == '/api/world/chat':
                p = P.get(pid)
                text = re.sub(r'\s+', ' ', str(data.get('text') or '')).strip()[:200]
                if not p or not text or text.startswith('/'):
                    return self.send_json(200, {'ok': False})
                if now - p.get('lastChat', 0) < 0.7:  # contra enxurrada de mensagens
                    return self.send_json(200, {'ok': False, 'erro': 'devagar'})
                p['lastChat'] = now
                WORLD['seq'] += 1
                WORLD['chat'].append({'seq': WORLD['seq'], 'id': pid, 'name': p.get('name'), 'text': text, 't': now})
                WORLD['chat'] = WORLD['chat'][-100:]
                return self.send_json(200, {'ok': True, 'seq': WORLD['seq']})
            if path == '/api/world/leave':
                P.pop(pid, None)
                return self.send_json(200, {'ok': True})
        return self.send_json(404, {'erro': 'rota desconhecida'})

    def do_POST(self):
        if self.path.split('?')[0] == '/api/save':
            return self.save_character()
        if self.path.split('?')[0].startswith('/api/auth/'):
            return self.auth(self.path.split('?')[0])
        if self.path.split('?')[0].startswith('/api/world/'):
            return self.world(self.path.split('?')[0])
        if self.path.split('?')[0] == '/api/propostas':
            if not self.is_local():
                return self.send_json(403, {'erro': 'só o administrador'})
            return self.answer_prop()
        if self.path.split('?')[0].startswith('/api/arena/'):
            return self.arena(self.path.split('?')[0])
        if self.path.split('?')[0] != '/api/feedback':
            return self.send_json(404, {'erro': 'rota desconhecida'})
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0 or n > MAX_BODY:
            return self.send_json(413, {'erro': 'tamanho inválido'})
        try:
            data = json.loads(self.rfile.read(n))
        except (ValueError, UnicodeDecodeError):
            return self.send_json(400, {'erro': 'JSON inválido'})
        if not isinstance(data, dict) or not str(data.get('texto', '')).strip():
            return self.send_json(400, {'erro': 'texto vazio'})
        shot = data.pop('screenshot', None)
        with LOCK:
            items = load()
            nums = [int(re.sub(r'\D', '', str(i.get('id', ''))) or 0) for i in items]
            sid = f"S-{max(nums + [0]) + 1:03d}"
            rec = dict(data)
            rec.update({'id': sid, 'status': 'pendente', 'criadoEm': datetime.datetime.now().isoformat(timespec='seconds')})
            rec.pop('resposta', None)
            rec.pop('_owner', None)
            if not self.is_local():  # online: sugestão de outro jogador entra marcada, com o nome dele
                rec['remoto'] = True
                rec['autor'] = str(((data.get('jogador') or {}) if isinstance(data.get('jogador'), dict) else {}).get('nome') or 'jogador de fora')[:24]
                a = self.account()
                if a:
                    rec['autor'] = a['usuario'] + ' · ' + rec['autor']
                if self.who():
                    rec['_owner'] = self.who()
            if isinstance(shot, str) and shot.startswith('data:image/png;base64,'):
                try:
                    raw = base64.b64decode(shot.split(',', 1)[1], validate=True)
                    os.makedirs(IMG_DIR, exist_ok=True)
                    with open(os.path.join(IMG_DIR, sid + '.png'), 'wb') as f:
                        f.write(raw)
                    rec['imagem'] = f'img/{sid}.png'
                except ValueError:
                    pass
            items.append(rec)
            save(items)
        print(f"💡 Nova sugestão {sid}: {str(rec.get('texto'))[:70]}", flush=True)
        return self.send_json(200, {'ok': True, 'id': sid})


def main():
    if '--relatorio' in sys.argv:
        write_md(load())
        print('feedback/SUGESTOES.md atualizado.')
        return
    if '--set-password' in sys.argv:  # senha de uma conta pela linha de comando, sem subir o servidor
        i = sys.argv.index('--set-password')
        cli_set_password(sys.argv[i + 1] if i + 1 < len(sys.argv) else '')
        return
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    wanted = int(args[0]) if args else int(os.environ.get('PORT', DEFAULT_PORT))
    online = '--online' in sys.argv  # abre para a rede: outras pessoas jogam junto (veja docs/ONLINE.md)
    host = '0.0.0.0' if online else '127.0.0.1'
    init_db()  # contas e personagens no banco (db/aethra.db); importa saves/*.json só lendo
    if backup_db():
        print('💾 Cópia de segurança do banco feita em backups/.', flush=True)
    threading.Thread(target=backup_loop, daemon=True).start()
    srv = None
    for port in range(wanted, wanted + 20):  # se a porta estiver ocupada, tenta as próximas
        try:
            srv = ThreadingHTTPServer((host, port), Handler)
            break
        except OSError:
            print(f'Porta {port} ocupada, tentando {port + 1}...', flush=True)
    if not srv:
        sys.exit(f'Nenhuma porta livre entre {wanted} e {wanted + 19}.')
    print(f'🎮 Jogo em http://localhost:{port}  (Ctrl+C para parar)', flush=True)
    if online:
        ip = '?'
        try:
            import socket
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(('10.255.255.255', 1))  # não envia nada: só descobre o IP desta máquina na rede
            ip = s.getsockname()[0]
            s.close()
        except OSError:
            pass
        print(f'🌐 MODO ONLINE: quem estiver na mesma rede entra por http://{ip}:{port}', flush=True)
        print('   Você (neste computador) continua sendo o administrador; quem entra de fora só vê e grava os próprios personagens.', flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
