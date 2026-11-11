/* =========================================================================
   ONLINE — FASE 2: CONTAS (tela "Entrar / Criar conta")
   Quem joga no próprio computador do servidor (o Roberto, administrador) entra
   direto. Quem vem de fora precisa de uma conta: usuário + senha. A sessão volta
   do servidor e fica no navegador (localStorage com "lembrar de mim", senão
   sessionStorage) e vai em todo pedido /api/ (cabeçalho X-Aethra-Session,
   colocado pelo fetch de net3d.js). Personagens criados na fase 1 neste mesmo
   navegador passam para a conta ao entrar.
   ========================================================================= */
import './net3d.js'; // garante o fetch com a chave do navegador e a sessão

const KEY = 'aethra_session';
export const ACCOUNT = { admin: false, user: null, logged: false };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function setSession(tok, remember) {
  try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (e) { }
  if (!tok) return;
  try { (remember ? localStorage : sessionStorage).setItem(KEY, tok); } catch (e) { }
}

export async function refreshAccount() {
  try { Object.assign(ACCOUNT, await (await fetch('/api/auth/me')).json()); } catch (e) { }
  return ACCOUNT;
}

export async function logout() {
  try { await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); } catch (e) { }
  setSession(null);
  location.reload();
}

/* Chamada antes da vitrine: true = pode seguir (administrador ou já logado); false = a tela de entrada foi mostrada
   e, depois do login, onDone() é chamado. */
export async function ensureLogin(overlay, onDone) {
  await refreshAccount();
  if (ACCOUNT.admin || ACCOUNT.logged) return true;
  showLogin(overlay, onDone);
  return false;
}

function showLogin(o, onDone, mode = 'entrar') {
  const reg = mode === 'criar';
  o.classList.add('show');
  o.innerHTML = `<div class="acc">
    <div class="cs-head"><h1>Crônicas de Aethra</h1><div class="sub">${reg ? 'CRIAR CONTA' : 'ENTRAR NA SUA CONTA'}</div></div>
    <form class="acc-card" id="acc-form" autocomplete="on" novalidate>
      <div class="acc-tabs"><button type="button" class="acc-tab ${reg ? '' : 'on'}" data-m="entrar">Entrar</button><button type="button" class="acc-tab ${reg ? 'on' : ''}" data-m="criar">Criar conta</button></div>
      <label>Usuário<input id="acc-user" name="username" maxlength="20" autocomplete="username" spellcheck="false" placeholder="de 3 a 20 letras ou números"></label>
      <label>Senha<input id="acc-pass" name="password" type="password" maxlength="128" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="${reg ? 'pelo menos 6 caracteres' : ''}"></label>
      ${reg ? '<label>Confirmar senha<input id="acc-pass2" type="password" maxlength="128" autocomplete="new-password"></label>' : ''}
      <label class="acc-check"><input type="checkbox" id="acc-rem" checked> Lembrar de mim neste computador</label>
      <div class="acc-err" id="acc-err" role="alert"></div>
      <button type="submit" class="btn acc-go" id="acc-go">${reg ? 'Criar conta e entrar' : 'Entrar'}</button>
      <div class="acc-foot">${reg ? 'Já tem conta? <a href="#" data-m="entrar">Entrar</a>' : 'Primeira vez aqui? <a href="#" data-m="criar">Criar uma conta</a>'}</div>
    </form>
    <div class="ver">Sua conta guarda os seus personagens: entre de qualquer computador com o mesmo usuário e senha.</div>
  </div>`;
  const $ = id => o.querySelector('#' + id);
  o.querySelectorAll('[data-m]').forEach(el => el.onclick = e => { e.preventDefault(); if (el.dataset.m !== mode) showLogin(o, onDone, el.dataset.m); });
  const err = m => { $('acc-err').textContent = m || ''; };
  setTimeout(() => $('acc-user').focus(), 30);
  $('acc-form').onsubmit = async e => {
    e.preventDefault();
    const user = $('acc-user').value.trim(), pass = $('acc-pass').value, rem = $('acc-rem').checked;
    if (!/^[A-Za-z0-9_.-]{3,20}$/.test(user)) return err('O usuário precisa ter de 3 a 20 letras, números, ponto, hífen ou _.');
    if (pass.length < 6) return err('A senha precisa ter pelo menos 6 caracteres.');
    if (reg && pass !== $('acc-pass2').value) return err('As duas senhas não são iguais.');
    err(''); const go = $('acc-go'); go.disabled = true; go.textContent = reg ? 'Criando…' : 'Entrando…';
    let r = null;
    try {
      const res = await fetch(reg ? '/api/auth/register' : '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: user, senha: pass, lembrar: rem }) });
      r = await res.json();
    } catch (e2) { r = { msg: 'Sem conexão com o servidor. Tente de novo.' }; }
    if (!r || !r.ok) { go.disabled = false; go.textContent = reg ? 'Criar conta e entrar' : 'Entrar'; return err((r && r.msg) || 'Não deu certo. Tente de novo.'); }
    setSession(r.session, rem);
    await refreshAccount();
    onDone && onDone();
  };
}

/* selo da conta no canto das telas fora do mundo (vitrine e criador), com "Sair da conta" — só para quem vem de fora */
export function accountBadge(o) {
  if (!o || ACCOUNT.admin || !ACCOUNT.logged) return;
  const old = o.querySelector('.acc-badge'); if (old) old.remove();
  const d = document.createElement('div'); d.className = 'acc-badge';
  d.innerHTML = `👤 <b>${esc(ACCOUNT.user)}</b> <button type="button" class="acc-out" title="Sair da conta">Sair da conta</button>`;
  d.querySelector('.acc-out').onclick = () => logout();
  o.appendChild(d);
}
