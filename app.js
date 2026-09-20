/* =========================================================
   CAROTTE — app.js
   Utilitários compartilhados entre host e participante.
   Mesmo padrão do Galolingo: esc(), shuffle(), playSound(),
   saveState()/loadState() em localStorage.
   ========================================================= */

/* ---------------------------------------------------------
   TEXTO
   --------------------------------------------------------- */
function esc(s){
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function jsStr(s){ return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

function shuffle(arr){
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

function formatScore(n){
  const r = Math.round(Number(n)||0);
  return r.toLocaleString('pt-BR');
}

/* ---------------------------------------------------------
   SONS — pasta sounds/, volume 0.85 nos efeitos
   --------------------------------------------------------- */
const SOUND_FILES = {
  click:'sounds/click.mp3',
  ok:'sounds/ok.mp3',
  falha:'sounds/falha.mp3',
  modo:'sounds/modo.mp3',
  question:'sounds/questionsound.mp3',
  alert:'sounds/alert.mp3',
  level:'sounds/level.mp3',
  levelfail:'sounds/levelfail.mp3',
  losing:'sounds/losing.mp3',
  win:'sounds/win01.mp3'
};

function playSound(name){
  try{
    const src = SOUND_FILES[name]; if(!src) return;
    const a = new Audio(src); a.volume = 0.85; a.play().catch(()=>{});
  }catch(e){}
}

/* música de fundo em loop (volume baixo) — só começa após o 1º clique */
const music = {
  el:null, muted:false, wanted:false, unlocked:false,
  init(){
    try{
      this.muted = localStorage.getItem('carotte_mute') === '1';
      this.el = new Audio('sounds/game-backsound.mp3');
      this.el.loop = true; this.el.volume = 0.25;
    }catch(e){}
    const unlock = ()=>{ music.unlocked = true; if(music.wanted) music.start(); };
    document.addEventListener('click', unlock, { once:true });
    document.addEventListener('touchstart', unlock, { once:true });
    document.addEventListener('keydown', unlock, { once:true });
  },
  start(){
    this.wanted = true;
    if(!this.el || this.muted || !this.unlocked) return;
    try{ this.el.play().catch(()=>{}); }catch(e){}
  },
  stop(){
    this.wanted = false;
    try{ if(this.el){ this.el.pause(); this.el.currentTime = 0; } }catch(e){}
  },
  toggle(){
    this.muted = !this.muted;
    try{ localStorage.setItem('carotte_mute', this.muted ? '1' : '0'); }catch(e){}
    if(this.muted){ try{ this.el && this.el.pause(); }catch(e){} }
    else if(this.wanted){ this.start(); }
    return this.muted;
  },
  icon(){ return this.muted ? '🔇' : '🔊'; }
};
music.init();

/* ---------------------------------------------------------
   FORMAS DAS 4 OPÇÕES
   O verde é reservado para "correto" — nunca é cor de opção.
   --------------------------------------------------------- */
const SHAPES = [
  { key:'tri', nome:'triângulo', cls:'shape-tri', cor:'var(--vermelho)',  corDark:'var(--vermelho-dark)' },
  { key:'los', nome:'losango',   cls:'shape-los', cor:'var(--azul-dark)', corDark:'var(--azul-shape-dark)' },
  { key:'cir', nome:'círculo',   cls:'shape-cir', cor:'var(--amarelo)',   corDark:'var(--amarelo-dark)' },
  { key:'qua', nome:'quadrado',  cls:'shape-qua', cor:'var(--rosa)',      corDark:'var(--rosa-dark)' }
];

function shapeSvg(i){
  const f = '#ffffff';
  switch(i){
    case 0: return `<svg viewBox="0 0 40 40" aria-hidden="true"><polygon points="20,4 38,36 2,36" fill="${f}"/></svg>`;
    case 1: return `<svg viewBox="0 0 40 40" aria-hidden="true"><polygon points="20,2 38,20 20,38 2,20" fill="${f}"/></svg>`;
    case 2: return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="${f}"/></svg>`;
    default:return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="4" y="4" width="32" height="32" rx="4" fill="${f}"/></svg>`;
  }
}

/* ---------------------------------------------------------
   MODOS DE PONTUAÇÃO
   --------------------------------------------------------- */
const MODOS = {
  unica:    { nome:'única',     selo:'🥕 única',     desc:'quem acerta ganha 1000 pontos' },
  dupla:    { nome:'dupla',     selo:'✌️ dupla',     desc:'quem acerta ganha 2000 pontos' },
  veloz:    { nome:'veloz',     selo:'⚡ veloz',      desc:'quanto mais rápido, mais pontos (2000 → 1000)' },
  arriscada:{ nome:'arriscada', selo:'🎲 arriscada', desc:'acertou +1500 · errou −200' }
};
const TEMPOS = [20,30,40,60];

/* ---------------------------------------------------------
   PERSONAGENS
   retrato (.jpeg) no carrossel e no lobby
   "com galo" (.png) no ranking e no pódio, recortado em círculo
   --------------------------------------------------------- */
const PERSONAGENS = [
  { nome:'Louise',    retrato:'personagens/LOUISE.jpeg',    galo:'personagens-com-galos/GALO1/LOUISE-GALO1.png' },
  { nome:'Pierre',    retrato:'personagens/PIERRE.jpeg',    galo:'personagens-com-galos/GALO1/PIERRE-GALO1.png' },
  { nome:'Sophie',    retrato:'personagens/SOPHIE.jpeg',    galo:'personagens-com-galos/GALO1/SOPHIE-GALO1.png' },
  { nome:'Rémi',      retrato:'personagens/RÉMI.jpeg',      galo:'personagens-com-galos/GALO1/RÉMI-GALO1.png' },
  { nome:'Cécile',    retrato:'personagens/CÉCILE.jpeg',    galo:'personagens-com-galos/GALO1/CÉCILE-GALO1.png' },
  { nome:'Charlotte', retrato:'personagens/CHARLOTTE.jpeg', galo:'personagens-com-galos/GALO1/CHARLOTTE-GALO1.png' },
  { nome:'Julien',    retrato:'personagens/JULIEN.jpeg',    galo:'personagens-com-galos/GALO1/JULIEN-GALO1.png' },
  { nome:'François',  retrato:'personagens/FRANÇOIS.jpeg',  galo:'personagens-com-galos/GALO1/FRANÇOIS-GALO1.png' },
  { nome:'Gaspard',   retrato:'personagens/GASPARD.jpeg',   galo:'personagens-com-galos/GALO1/GASPARD-GALO1.png' },
  { nome:'Léo',       retrato:'personagens/LÉO.jpeg',       galo:'personagens-com-galos/GALO1/LEO-GALO1.png' },
  { nome:'Adèle',     retrato:'personagens/ADÈLE.jpeg',     galo:'personagens-com-galos/GALO1/ADÈLE-GALO1.png' },
  { nome:'Laurent',   retrato:'personagens/LAURENT.jpeg',   galo:'personagens-com-galos/GALO1/LAURENT-GALO1.png' },
  { nome:'Bastien',   retrato:'personagens/BASTIEN.jpeg',   galo:'personagens-com-galos/GALO1/BASTIEN-GALO1.png' },
  { nome:'Béatrice',  retrato:'personagens/BÉATRICE.jpeg',  galo:'personagens-com-galos/GALO1/BÉATRICE-GALO1.png' },
  { nome:'Élise',     retrato:'personagens/ÉLISE.jpeg',     galo:'personagens-com-galos/GALO1/ÉLISE-GALO1.png' },
  { nome:'Antoine',   retrato:'personagens/ANTOINE.jpeg',   galo:'personagens-com-galos/GALO1/ANTOINE-GALO1.png' },
  { nome:'Julie',     retrato:'personagens/JULIE.jpeg',     galo:'personagens-com-galos/GALO1/JULIE-GALO1.png' },
  { nome:'Marie',     retrato:'personagens/MARIE.jpeg',     galo:'personagens-com-galos/GALO1/MARIE-GALO1.png' },
  { nome:'Florence',  retrato:'personagens/FLORENCE.jpeg',  galo:'personagens-com-galos/GALO1/FLORENCE-GALO1.png' },
  { nome:'Valérie',   retrato:'personagens/VALÉRIE.jpeg',   galo:'personagens-com-galos/GALO1/VALÉRIE-GALO1.png' },
  { nome:'Mathieu',   retrato:'personagens/MATHIEU.jpeg',   galo:'personagens-com-galos/GALO1/MATHIEU-GALO1.png' },
  { nome:'Grégoire',  retrato:'personagens/GREGOIRE.jpeg',  galo:'personagens-com-galos/GALO1/GREGOIRE-GALO1.png' }
];

/* caminhos com acento precisam de encodeURI */
function charSrc(path){ return encodeURI(path); }
function charByName(nome){
  return PERSONAGENS.find(p => p.nome === nome) || PERSONAGENS[0];
}
function retratoDe(nome){ return charSrc(charByName(nome).retrato); }
function galoDe(nome){ return charSrc(charByName(nome).galo); }

/* ---------------------------------------------------------
   PERSISTÊNCIA (localStorage)
   --------------------------------------------------------- */
function saveState(key, obj){
  try{ localStorage.setItem(key, JSON.stringify(obj)); }catch(e){}
}
function loadState(key){
  let raw = null;
  try{ raw = localStorage.getItem(key); }catch(e){ return null; }
  if(!raw) return null;
  try{ return JSON.parse(raw); }catch(e){ clearState(key); return null; }
}
function clearState(key){ try{ localStorage.removeItem(key); }catch(e){} }

/* ---------------------------------------------------------
   TEMPO DE SERVIDOR — justiça entre aparelhos
   --------------------------------------------------------- */
let serverOffset = 0;
function watchServerOffset(db){
  try{
    db.ref('.info/serverTimeOffset').on('value', s => {
      const v = s.val();
      if(typeof v === 'number' && isFinite(v)) serverOffset = v;
    });
  }catch(e){}
}
function serverNow(){ return Date.now() + serverOffset; }

/* ---------------------------------------------------------
   HELPERS DE UI compartilhados
   --------------------------------------------------------- */
function normPergunta(p){
  const opcoes = Array.isArray(p.opcoes) ? p.opcoes.slice(0,4) : [];
  while(opcoes.length < 4) opcoes.push('');
  return {
    enunciado: String(p.enunciado || ''),
    opcoes: opcoes.map(o => String(o)),
    correta: (typeof p.correta === 'number' && p.correta >= 0 && p.correta <= 3) ? p.correta : 0,
    tempo: TEMPOS.indexOf(Number(p.tempo)) !== -1 ? Number(p.tempo) : 20,
    modo: MODOS[p.modo] ? p.modo : 'unica'
  };
}

/* validação amigável do JSON importado — devolve lista de erros */
function validarQuiz(obj){
  const erros = [];
  if(!obj || typeof obj !== 'object'){ erros.push('o arquivo não contém um objeto JSON válido'); return erros; }
  if(!obj.titulo) erros.push('falta o campo "titulo"');
  if(!Array.isArray(obj.perguntas) || obj.perguntas.length === 0){
    erros.push('falta a lista "perguntas" (ou ela está vazia)');
    return erros;
  }
  obj.perguntas.forEach((p,i)=>{
    const n = i+1;
    if(!p || typeof p !== 'object'){ erros.push(`pergunta ${n}: não é um objeto`); return; }
    if(!p.enunciado) erros.push(`pergunta ${n}: falta o "enunciado"`);
    if(!Array.isArray(p.opcoes) || p.opcoes.length !== 4) erros.push(`pergunta ${n}: precisa de exatamente 4 "opcoes"`);
    if(typeof p.correta !== 'number' || p.correta < 0 || p.correta > 3) erros.push(`pergunta ${n}: "correta" precisa ser um número de 0 a 3`);
    if(p.tempo !== undefined && TEMPOS.indexOf(Number(p.tempo)) === -1) erros.push(`pergunta ${n}: "tempo" precisa ser 20, 30, 40 ou 60`);
    if(p.modo !== undefined && !MODOS[p.modo]) erros.push(`pergunta ${n}: "modo" precisa ser unica, dupla, veloz ou arriscada`);
  });
  return erros;
}
