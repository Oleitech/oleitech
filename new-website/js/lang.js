/* Idioma (L1, specs/comportamento.md): o botão mostra o idioma atual e abre a lista com o outro, que é só um link para
   a mesma página nessa língua. Fecha com Esc, clique fora, ao sair com o foco e ao escolher. Sem preferência guardada. */
(() => {
  const box = document.querySelector('[data-lang]');
  if (!box) return;
  const btn = box.querySelector('button'), link = box.querySelector('[data-lang-list] a');
  const isOpen = () => btn.getAttribute('aria-expanded') === 'true';
  // também a cópia antracite do header no hero (.hero__ink), para o texto se ler por baixo da bola
  // com a lista aberta, as molduras (iframe) não recebem o rato: o 1.º clique nelas chega à página e fecha a lista
  // (há sites embutidos, como o da JAF, que não deixam o foco entrar no iframe, e então a janela nem perde o foco)
  const set = open => { document.documentElement.classList.toggle('lang-open', open); document.querySelectorAll('.lang__btn').forEach(b => b.setAttribute('aria-expanded', open)); document.querySelectorAll('[data-lang-list]').forEach(l => { l.hidden = !open; }); };
  btn.addEventListener('click', () => set(!isOpen()));
  btn.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); set(true); link.focus(); } });
  link.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); btn.focus(); }
    else if (e.key === ' ') { e.preventDefault(); link.click(); }
  });
  link.addEventListener('click', () => set(false));
  box.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen()) { e.preventDefault(); set(false); btn.focus(); } });
  // o foco saiu da lista: para outro sítio da página, ou para fora dela (relatedTarget null: p. ex. a moldura do site vivo)
  box.addEventListener('focusout', e => { if (!box.contains(e.relatedTarget)) set(false); });
  addEventListener('blur', () => set(false));   // a janela perdeu o foco: um clique ou um Tab para dentro do iframe
  document.addEventListener('click', e => { if (isOpen() && !box.contains(e.target)) set(false); });
})();
