/* I1 (specs/comportamento.md): o site real do projeto, vivo, dentro da moldura do Figma. Só em desktop (>800px):
   no mobile a escala ficava ilegível, por isso fica a captura. O iframe tem 1440px de largura e é escalado para a moldura. */
(() => {
  const card = document.querySelector('.detail__card[data-embed]');
  if (!card || !matchMedia('(min-width: 801px)').matches) return;
  const W = 1440, f = document.createElement('iframe');
  f.className = 'detail__live'; f.src = card.dataset.embed; f.title = card.dataset.title;
  f.loading = 'lazy'; f.setAttribute('sandbox', 'allow-scripts allow-same-origin'); f.referrerPolicy = 'no-referrer';
  const fit = () => { const k = card.clientWidth / W; f.style.transform = `scale(${k})`; f.style.height = card.clientHeight / k + 'px'; };
  f.addEventListener('load', () => card.classList.add('is-live'));
  card.appendChild(f); fit();
  new ResizeObserver(fit).observe(card);
})();
