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
   O som "question" funciona como som de fundo da pergunta:
   toca uma vez, sozinho, sempre que uma pergunta abre — sem loop.
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
const SOUND_VOLUMES = { question:0.5 };  // mais baixo que os demais efeitos (0.85)

/* controle global de som — um único botão de mudo cobre todos os efeitos */
const som = {
  muted:false,
  init(){ try{ this.muted = localStorage.getItem('carotte_mute') === '1'; }catch(e){} },
  toggle(){
    this.muted = !this.muted;
    try{ localStorage.setItem('carotte_mute', this.muted ? '1' : '0'); }catch(e){}
    return this.muted;
  },
  icon(){ return this.muted ? '🔇' : '🔊'; }
};
som.init();

function playSound(name){
  if(som.muted) return;
  try{
    const src = SOUND_FILES[name]; if(!src) return;
    const a = new Audio(src);
    a.volume = SOUND_VOLUMES[name] !== undefined ? SOUND_VOLUMES[name] : 0.85;
    a.play().catch(()=>{});
  }catch(e){}
}

/* ---------------------------------------------------------
   AVATAR DE RESERVA
   Se a foto do personagem não carregar, mostra um círculo
   colorido com a inicial do nome, para o lugar nunca ficar vazio.
   --------------------------------------------------------- */
function avatarFallback(nome){
  const letra = (String(nome||'?').trim().charAt(0) || '?').toUpperCase();
  const cores = ['#F2A7AD','#8EC2C9','#F2A444','#F2B28D','#EF7211'];
  let hash = 0;
  for(let i=0;i<String(nome).length;i++) hash = (hash*31 + String(nome).charCodeAt(i)) | 0;
  const cor = cores[Math.abs(hash) % cores.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="${cor}"/><text x="50" y="58" font-family="Nunito, sans-serif" font-size="46" font-weight="800" fill="#ffffff" text-anchor="middle">${letra}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

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
   REAÇÕES (ranking parcial) — um emoji por participante por ranking
   --------------------------------------------------------- */
const REACOES = ['😂','🫠','😘','🥺','🥹','🤯','😵','😡','👻'];

/* ---------------------------------------------------------
   PERSONAGENS E LISTA COMPLETA DE SKINS (pasta personagens/skin01/)
   --------------------------------------------------------- */
const PERSONAGENS = [
  { nome:'Louise',    retrato:'personagens/LOUISE.jpeg' },
  { nome:'Pierre',    retrato:'personagens/PIERRE.jpeg' },
  { nome:'Sophie',    retrato:'personagens/SOPHIE.jpeg' },
  { nome:'Rémi',      retrato:'personagens/RÉMI.jpeg' },
  { nome:'Cécile',    retrato:'personagens/CÉCILE.jpeg' },
  { nome:'Charlotte', retrato:'personagens/CHARLOTTE.jpeg' },
  { nome:'Julien',    retrato:'personagens/JULIEN.jpeg' },
  { nome:'François',  retrato:'personagens/FRANÇOIS.jpeg' },
  { nome:'Gaspard',   retrato:'personagens/GASPARD.jpeg' },
  { nome:'Léo',       retrato:'personagens/LÉO.jpeg' },
  { nome:'Adèle',     retrato:'personagens/ADÈLE.jpeg' },
  { nome:'Laurent',   retrato:'personagens/LAURENT.jpeg' },
  { nome:'Bastien',   retrato:'personagens/BASTIEN.jpeg' },
  { nome:'Béatrice',  retrato:'personagens/BÉATRICE.jpeg' },
  { nome:'Élise',     retrato:'personagens/ÉLISE.jpeg' },
  { nome:'Antoine',   retrato:'personagens/ANTOINE.jpeg' },
  { nome:'Julie',     retrato:'personagens/JULIE.jpeg' },
  { nome:'Marie',     retrato:'personagens/MARIE.jpeg' },
  { nome:'Florence',  retrato:'personagens/FLORENCE.jpeg' },
  { nome:'Valérie',   retrato:'personagens/VALÉRIE.jpeg' },
  { nome:'Mathieu',   retrato:'personagens/MATHIEU.jpeg' },
  { nome:'Grégoire',  retrato:'personagens/GREGOIRE.jpeg' }
];

const SKINS_DISPONIVEIS = [
  "personagens/skin01/JULIEN03.jpeg",
  "personagens/skin01/BASTIEN02.jpeg",
  "personagens/skin01/ANTOINE03.jpeg",
  "personagens/skin01/VALÉRIE03.jpeg",
  "personagens/skin01/FLORENCE03.jpeg",
  "personagens/skin01/BÉATRICE02.jpeg",
  "personagens/skin01/CÉCILE02.jpeg",
  "personagens/skin01/JULIE03.jpeg",
  "personagens/skin01/GREGOIRE03.jpeg",
  "personagens/skin01/CHARLOTTE02.jpeg",
  "personagens/skin01/LÉO02.jpeg",
  "personagens/skin01/LOUISE02.jpeg",
  "personagens/skin01/ÉLISE02.jpeg",
  "personagens/skin01/ADÈLE03.jpeg",
  "personagens/skin01/SOPHIE03.jpeg",
  "personagens/skin01/FRANÇOIS03.jpeg",
  "personagens/skin01/FLORENCE02.jpeg",
  "personagens/skin01/MATHIEU03.jpeg",
  "personagens/skin01/CÉCILE03.jpeg",
  "personagens/skin01/CHARLOTTE03.jpeg",
  "personagens/skin01/FRANÇOIS02.jpeg",
  "personagens/skin01/PIERRE03.jpeg",
  "personagens/skin01/MARIE03.jpeg",
  "personagens/skin01/LOUISE03.jpeg",
  "personagens/skin01/LÉO03.jpeg",
  "personagens/skin01/BASTIEN03.jpeg",
  "personagens/skin01/GASPARD03.jpeg",
  "personagens/skin01/RÉMI02.jpeg",
  "personagens/skin01/JULIE02.jpeg",
  "personagens/skin01/SOPHIE02.jpeg",
  "personagens/skin01/RÉMI03.jpeg",
  "personagens/skin01/GASPARD02.jpeg",
  "personagens/skin01/MARIE02.jpeg",
  "personagens/skin01/BÉATRICE03.jpeg",
  "personagens/skin01/ÉLISE03.jpeg",
  "personagens/skin01/ADÈLE02.jpeg",
  "personagens/skin01/GREGOIRE02.jpeg",
  "personagens/skin01/ANTOINE02.jpeg",
  "personagens/skin01/LAURENT02.jpeg",
  "personagens/skin01/PIERRE02.jpeg",
  "personagens/skin01/MATHIEU02.jpeg",
  "personagens/skin01/JULIEN02.jpeg",
  "personagens/skin01/LAURENT03.jpeg",
  "personagens/skin01/VALÉRIE02.jpeg"
];

/* caminhos com acento precisam de encodeURI */
function charSrc(path){ return encodeURI(path); }
function charByName(nome){
  return PERSONAGENS.find(p => p.nome === nome) || PERSONAGENS[0];
}
function retratoDe(nome){ return charSrc(charByName(nome).retrato); }

/* Retorna a skin do usuário ou o retrato padrão caso não tenha skin escolhida */
function skinDe(j){
  if(j && j.skin) return charSrc(j.skin);
  return retratoDe(j ? j.personagem : '');
}

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
