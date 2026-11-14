/* Configuração única do site. Se agendarUrl tiver valor, todos os botões
   [data-cta="agendar"] passam a apontar para lá; vazio = contactos.html. */
window.OLEITECH = { agendarUrl: '' };
document.addEventListener('DOMContentLoaded', function () {
  var u = (window.OLEITECH && window.OLEITECH.agendarUrl) || '';
  if (!u) return;
  document.querySelectorAll('[data-cta="agendar"]').forEach(function (a) { a.setAttribute('href', u); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); });
});
