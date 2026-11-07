#!/usr/bin/env python3
"""Servidor local do jogo + caixa de sugestões.

Uso:
    python3 server.py            # abre em http://localhost:5577
    python3 server.py 9000       # outra porta
    python3 server.py --relatorio  # só regenera feedback/SUGESTOES.md

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
LOCK = threading.Lock()
MAX_BODY = 8 * 1024 * 1024
DEFAULT_PORT = 5577
SAVES_DIR = os.path.join(ROOT, 'saves')
TRASH_DIR = os.path.join(SAVES_DIR, 'lixeira')
SAVE_LOCK = threading.Lock()


def slug(name):
    s = re.sub(r'[^a-z0-9]+', '_', str(name).lower()).strip('_')
    return s[:32] or 'sem_nome'


def save_path(sl):
    return os.path.join(SAVES_DIR, slug(sl) + '.json')


def list_saves():
    out = []
    if not os.path.isdir(SAVES_DIR):
        return out
    for fn in os.listdir(SAVES_DIR):
        if not fn.endswith('.json'):
            continue
        try:
            with open(os.path.join(SAVES_DIR, fn), encoding='utf-8') as f:
                s = json.load(f)
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

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/api/feedback':
            with LOCK:
                return self.send_json(200, load())
        if path == '/api/saves':
            with SAVE_LOCK:
                return self.send_json(200, list_saves())
        if path.startswith('/api/save/'):
            try:
                with SAVE_LOCK, open(save_path(path[len('/api/save/'):]), encoding='utf-8') as f:
                    return self.send_json(200, json.load(f))
            except (OSError, ValueError):
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
        p = save_path(data['name'])
        with SAVE_LOCK:
            os.makedirs(SAVES_DIR, exist_ok=True)
            try:
                with open(p, encoding='utf-8') as f:
                    old = json.load(f)
                if (old.get('savedAt') or 0) > (data.get('savedAt') or 0):
                    return self.send_json(200, {'ok': True, 'ignorado': 'save do projeto é mais recente'})
                os.replace(p, p + '.bak')
            except (OSError, ValueError):
                pass
            tmp = p + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False)
            os.replace(tmp, p)
        return self.send_json(200, {'ok': True})

    # apagar personagem: vai para saves/lixeira (recuperável)
    def do_DELETE(self):
        path = self.path.split('?')[0]
        if not path.startswith('/api/save/'):
            return self.send_json(404, {'erro': 'rota desconhecida'})
        p = save_path(path[len('/api/save/'):])
        with SAVE_LOCK:
            if not os.path.exists(p):
                return self.send_json(404, {'erro': 'personagem não encontrado'})
            os.makedirs(TRASH_DIR, exist_ok=True)
            stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
            os.replace(p, os.path.join(TRASH_DIR, f'{os.path.basename(p)[:-5]}-{stamp}.json'))
        return self.send_json(200, {'ok': True})

    def do_POST(self):
        if self.path.split('?')[0] == '/api/save':
            return self.save_character()
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
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    wanted = int(args[0]) if args else int(os.environ.get('PORT', DEFAULT_PORT))
    srv = None
    for port in range(wanted, wanted + 20):  # se a porta estiver ocupada, tenta as próximas
        try:
            srv = ThreadingHTTPServer(('127.0.0.1', port), Handler)
            break
        except OSError:
            print(f'Porta {port} ocupada, tentando {port + 1}...', flush=True)
    if not srv:
        sys.exit(f'Nenhuma porta livre entre {wanted} e {wanted + 19}.')
    print(f'🎮 Jogo em http://localhost:{port}  (Ctrl+C para parar)', flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
