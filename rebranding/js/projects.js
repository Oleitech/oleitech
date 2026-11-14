/* Projetos em destaque — factos de specs/conteudo-oleitech.md.
   shots = n.º de fatias da captura de página inteira em assets/sites/<slug>/ (desktop.jpg, desktop-2.jpg…),
   usada enquanto o iframe carrega e como reserva se o site não abrir. */
export const PROJECTS = [
  { slug: 'aigp', shots: { desktop: 2, mobile: 2 }, n: '01', name: 'AIGP Caniçal', caption: 'AIGP CANIÇAL', type: 'Website institucional', sector: 'Gestão florestal',
    tags: ['Website', 'HTML5', 'CSS3', 'JavaScript'], url: 'https://aigpcanical-oleiros.pt/',
    text: 'Website da Área Integrada de Gestão da Paisagem do Caniçal, em Oleiros: gestão conjunta e sustentável de mais de 2.000 hectares de floresta com os proprietários locais. Notícias, propostas de operações e contacto.' },
  { slug: 'festa', shots: { desktop: 1, mobile: 1 }, n: '02', name: 'Festa de Santa Margarida', caption: 'FESTA DE SANTA MARGARIDA', type: 'Landing page', sector: 'Evento',
    tags: ['Landing page', 'Animações SVG', 'Responsive'], url: 'https://festadeoleiros.pt/',
    text: 'Landing page interativa para a festa anual de Oleiros, com o programa completo, animações e informações práticas para quem visita.' },
  { slug: 'peripecia', shots: { desktop: 1, mobile: 1 }, n: '03', name: 'Peripécia', caption: 'PERIPÉCIA', type: 'Website', sector: 'Estúdio criativo',
    tags: ['Website', 'JavaScript', 'Responsive'], url: 'https://peripecia.pt/',
    text: 'Website do estúdio criativo de design e comunicação, com o portfólio de projetos e uma identidade visual marcante. A Peripécia é também parceira: eles desenham, nós programamos.' },
  { slug: 'jaf', shots: { desktop: 3, mobile: 3 }, n: '04', name: 'JAF — José Afonso & Filhos', caption: 'JAF', type: 'Website institucional', sector: 'Indústria da madeira',
    tags: ['Website', 'Bootstrap 5', 'Responsive'], url: 'https://oleitech.pt/jaf/',
    text: 'Website do grupo José Afonso & Filhos: história, produtos, serviços, investimentos e certificações.' },
  { slug: 'sh-solicitador', shots: { desktop: 3, mobile: 3 }, n: '05', name: 'SH Solicitador', caption: 'SH SOLICITADOR', type: 'Página de apresentação', sector: 'Solicitadoria',
    tags: ['Website', 'HTML5', 'CSS3'], url: 'https://sh-solicitador.com/',
    text: 'Página de apresentação do escritório de solicitadoria Simão Henriques, desenhada pela Lavor e desenvolvida pela Oleitech.' },
];
