/* =========================================================
   CAROTTE — player.js
   Tela do participante: entrada por PIN, carrossel de
   personagens, lobby, resposta e resultado.
   ========================================================= */

const PAGE = document.body.dataset.page;   // 'entrada' | 'jogo'
const SAVE_KEY = 'carotte_player_v1';

const P = {
  pin:null, id:null, apelido:'', personagem:null, skin:null,
  etapa:'pin',        // pin | carrossel | apelido | espera
  carIndex:0,
  skinIndex:0,        // índice da skin escolhida dentro de SKINS_DISPONIVEIS
  fase:'lobby',       // lobby | anuncio | pergunta | revelacao | ranking | ovada | fim
  indice:0,
  modo:'unica',
  correta:null,
  fimEm:0, inicioEm:0,
  meta:{ titulo:'', mostrarNoAparelho:false },
  pergunta:null,
  minhaResposta:null,
  eu:{ pontos:0, sequencia:0, maiorSequencia:0, acertos:0, ultimoGanho:0, ultimoAcerto:null },
  erro:'', resumed:false, total:0, posicao:null, jogadores:0, somDe:-1,
  reacoes:{},
  jogadoresSala:{}    // mapa de todos os jogadores para a tela de escolha de ovada
};

let listeners = [];
let tickTimer = null;
let alertaTocado = false;

/* =========================================================
   PERSISTÊNCIA
   ========================================================= */
function salvar(){
  saveState(SAVE_KEY, { v:1, pin:P.pin, id:P.id, apelido:P.apelido, personagem:P.personagem, skin:P.skin });
}
function esquecer(){ clearState(SAVE_KEY); }

function sairDoJogo(){
  if(!confirm('Sair do jogo? Você precisará entrar de novo com o PIN.')) return;
  playSound('click');
  esquecer();
  location.href = 'index.html';
}

/* =========================================================
   RENDER
   ========================================================= */
function render(){
  renderTopbar();
  const c = document.getElementById('content');
  if(PAGE === 'entrada'){ c.innerHTML = telaPin(); focarPin(); return; }

  if(P.etapa === 'carrossel'){ c.innerHTML = telaCarrossel(); montarSwipe(); return; }
  if(P.etapa === 'apelido'){ c.innerHTML = telaApelido(); return; }

  switch(P.fase){
    case 'anuncio':    c.innerHTML = telaAnuncio(); break;
    case 'pergunta':   c.innerHTML = telaPergunta(); break;
    case 'revelacao':  c.innerHTML = telaRevelacao(); break;
    case 'ranking':    c.innerHTML = (P.eu.sequencia >= 5 && !P.jaJogouOvada) ? telaEscolhaOvada() : telaRanking(); break;
    case 'ovada':      c.innerHTML = telaEsperaOvada(); break;
    case 'fim':        c.innerHTML = telaFim(); break;
    default:           c.innerHTML = telaEspera();
  }
}

function renderTopbar(){
  const bar = document.getElementById('topbar');
  if(PAGE === 'entrada'){
    bar.innerHTML = `
      <div class="topbar-row">
        <img src="images/LOGO.png" alt="Carotte" class="topbar-logo" onerror="this.style.display='none'">
        <span class="level-label">carotte</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:0%"></div></div>`;
    return;
  }
  const label = P.pin ? `carotte · pin ${P.pin}` : 'carotte';
  const pct = (P.total && P.fase !== 'lobby') ? Math.round((P.indice + (P.fase==='pergunta'?0:1)) / P.total * 100) : 0;
  bar.innerHTML = `
    ${P.resumed ? `<span class="resume-note">progresso retomado de onde você parou</span>` : ''}
    <div class="topbar-row">
      <span class="level-label">${esc(label)}</span>
      <button class="mute-btn" title="som de fundo" onclick="alternarSom(this)">${som.icon()}</button>
      <button class="restart-btn" title="sair do jogo" onclick="sairDoJogo()">&#8634;</button>
      <span class="score-badge">🥕 ${formatScore(P.eu.pontos)}</span>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>`;
}

function alternarSom(btn){
  btn.innerText = som.toggle() ? '🔇' : '🔊';
}

/* =========================================================
   TELA 1 — ENTRADA POR PIN (index.html)
   ========================================================= */
function telaPin(){
  const salvo = loadState(SAVE_KEY);
  const retomar = (salvo && salvo.pin && salvo.id)
    ? `<button class="btn-ghost btn" style="margin-top:10px" onclick="retomarSessao()">voltar ao jogo ${esc(salvo.pin)}</button>`
    : '';
  const url = new URL(location.href);
  const pinUrl = (url.searchParams.get('pin') || '').replace(/\D/g,'').slice(0,6);
  return `
    <div class="home-card">
      <img src="images/CAROTTELOGO.png" alt="Carotte" class="brand-logo" onerror="this.style.display='none'">
      <h1>carotte</h1>
      <p class="home-sub">Digite o PIN que aparece na tela do apresentador.</p>
      <input id="pinInput" class="pin-input" inputmode="numeric" pattern="[0-9]*"
             maxlength="6" placeholder="000000" value="${esc(pinUrl)}"
             oninput="this.value=this.value.replace(/\\D/g,'')"
             onkeydown="if(event.key==='Enter') entrarPorPin()">
      ${P.erro ? `<div class="gabarito">${P.erro}</div>` : ''}
      ${retomar}
    </div>
    <div class="footer-space"></div>
    <button class="btn btn-block" onclick="entrarPorPin()">entrar</button>
    <button class="btn-ghost btn" style="margin-top:10px" onclick="irParaHost()">sou professor / apresentador</button>`;
}

function irParaHost(){
  playSound('click');
  location.href = 'host.html';
}

function focarPin(){
  const el = document.getElementById('pinInput');
  if(el && !el.value) setTimeout(()=>el.focus(), 120);
  if(el && el.value.length === 6) entrarPorPin();
}

function retomarSessao(){
  const salvo = loadState(SAVE_KEY);
  if(!salvo || !salvo.pin) return;
  playSound('click');
  location.href = 'player.html?pin=' + encodeURIComponent(salvo.pin);
}

async function entrarPorPin(){
  playSound('click');
  const el = document.getElementById('pinInput');
  const pin = (el ? el.value : '').replace(/\D/g,'');
  if(pin.length !== 6){ P.erro = 'O PIN tem 6 dígitos. Confira na tela do apresentador.'; render(); return; }
  if(!db){ P.erro = 'Sem conexão com o servidor. Recarregue a página.'; render(); return; }
  try{
    const snap = await gameRef(pin,'meta').get();
    if(!snap.exists()){ P.erro = `Nenhum jogo encontrado com o PIN ${pin}.`; render(); return; }
    location.href = 'player.html?pin=' + encodeURIComponent(pin);
  }catch(e){
    P.erro = 'Não foi possível consultar o jogo. Verifique a conexão.';
    render();
  }
}

/* =========================================================
   TELA 2 — CARROSSEL DE PERSONAGENS
   ========================================================= */
function telaCarrossel(){
  const n = PERSONAGENS.length;
  const i = P.carIndex;
  const esqI = (i - 1 + n) % n, dirI = (i + 1) % n;
  const item = (idx, cls) => {
    const p = PERSONAGENS[idx];
    return `
      <div class="car-item ${cls}" onclick="irPara(${idx})">
        ${cls === 'car-center' ? `<span class="carousel-name">${esc(p.nome)}</span>` : ''}
        <img src="${charSrc(p.retrato)}" alt="${esc(p.nome)}" onerror="this.style.display='none'">
      </div>`;
  };
  const dots = PERSONAGENS.map((_,k)=>`<span class="car-dot ${k===i?'on':''}"></span>`).join('');
  return `
    <div class="question-card">
      <p class="instruction">escolha o seu personagem</p>
      <div class="carousel" id="carousel">
        <button class="car-arrow" onclick="girar(-1)" aria-label="anterior">‹</button>
        <div class="carousel-stage">
          ${item(esqI,'car-side')}
          ${item(i,'car-center')}
          ${item(dirI,'car-side')}
        </div>
        <button class="car-arrow" onclick="girar(1)" aria-label="próximo">›</button>
      </div>
      <div class="car-dots">${dots}</div>
    </div>
    <div class="footer-space"></div>
    <button class="btn btn-block" onclick="escolherPersonagem()">escolher</button>`;
}

function girar(d){
  playSound('click');
  const n = PERSONAGENS.length;
  P.carIndex = (P.carIndex + d + n) % n;
  render();
}
function irPara(idx){
  if(idx === P.carIndex) return;
  playSound('click');
  P.carIndex = idx; render();
}
function montarSwipe(){
  const el = document.getElementById('carousel');
  if(!el) return;
  let x0 = null;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive:true });
  el.addEventListener('touchend', e => {
    if(x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if(Math.abs(dx) > 40) girar(dx < 0 ? 1 : -1);
    x0 = null;
  }, { passive:true });
}
function escolherPersonagem(){
  playSound('click');
  P.personagem = PERSONAGENS[P.carIndex].nome;
  P.apelido = P.personagem;
  P.skinIndex = 0;
  P.etapa = 'apelido';
  render();
}

/* =========================================================
   TELA 3 — APELIDO E ESCOLHA DE SKIN
   ========================================================= */
function girarSkin(d){
  playSound('click');
  const n = SKINS_DISPONIVEIS.length;
  P.skinIndex = (P.skinIndex + d + n) % n;
  render();
}

function telaApelido(){
  const skinAtual = SKINS_DISPONIVEIS[P.skinIndex];
  return `
    <div class="question-card">
      <p class="instruction">escolha seu apelido e skin</p>
      <div class="skin-selector-row" style="display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:12px;">
        <button class="car-arrow" onclick="girarSkin(-1)">‹</button>
        <img src="${charSrc(skinAtual)}" alt="Skin" style="width:120px;height:120px;border-radius:50%;object-fit:cover;border:3px solid var(--amarelo)" onerror="this.style.display='none'">
        <button class="car-arrow" onclick="girarSkin(1)">›</button>
      </div>
      <p class="field-label">seu apelido (máx. 14 caracteres, sem espaços)</p>
      <input id="nickInput" class="text-input" maxlength="14" value="${esc(P.apelido)}"
             oninput="this.value = this.value.replace(/\\s/g, '').slice(0, 14)"
             onkeydown="if(event.key==='Enter') entrarNoJogo()">
      ${P.erro ? `<div class="gabarito">${P.erro}</div>` : ''}
    </div>
    <button class="btn-ghost btn" onclick="voltarCarrossel()">voltar aos personagens</button>
    <div class="footer-space"></div>
    <button class="btn btn-block" id="joinBtn" onclick="entrarNoJogo()">entrar no jogo</button>`;
}
function voltarCarrossel(){ playSound('click'); P.erro=''; P.etapa='carrossel'; render(); }

async function entrarNoJogo(){
  playSound('click');
  const el = document.getElementById('nickInput');
  const nome = (el ? el.value : '').trim();
  if(nome.length < 2){ P.erro = 'Escolha um apelido com pelo menos 2 caracteres.'; render(); return; }
  if(/\s/.test(nome)){ P.erro = 'O apelido não pode conter espaços.'; render(); return; }
  if(nome.length > 14){ P.erro = 'O apelido pode ter no máximo 14 caracteres.'; render(); return; }

  const btn = document.getElementById('joinBtn');
  if(btn){ btn.disabled = true; btn.innerText = 'entrando…'; }
  try{
    const estado = (await gameRef(P.pin,'estado').get()).val() || {};
    if(estado.fase && estado.fase !== 'lobby'){
      P.erro = 'Este jogo já começou. Peça ao apresentador para abrir um novo.';
      render(); return;
    }
    const jog = (await gameRef(P.pin,'jogadores').get()).val() || {};
    const existe = Object.values(jog).some(j => (j.apelido||'').toLowerCase() === nome.toLowerCase());
    if(existe){ P.erro = `Já existe alguém chamado "${esc(nome)}" nesse jogo. Escolha outro apelido.`; render(); return; }

    const skinEscolhida = SKINS_DISPONIVEIS[P.skinIndex];
    const ref = gameRef(P.pin,'jogadores').push();
    P.id = ref.key;
    P.apelido = nome;
    P.skin = skinEscolhida;
    await ref.set({
      apelido: nome, personagem: P.personagem, skin: skinEscolhida,
      pontos: 0, sequencia: 0, maiorSequencia: 0, acertos: 0,
      ultimoGanho: 0, ultimoAcerto: null, entrouEm: SERVER_TS
    });
    ref.onDisconnect().update({ online:false });
    salvar();
    P.erro = ''; P.etapa = 'espera';
    ouvirJogo();
    render();
  }catch(e){
    P.erro = 'Não foi possível entrar. Verifique a conexão e tente de novo.';
    render();
  }
}

/* =========================================================
   TELAS DO JOGO
   ========================================================= */
function telaEspera(){
  const img = P.skin
    ? `<img src="${charSrc(P.skin)}" alt="${esc(P.apelido)}" class="mascot-img" style="border-radius:50%;object-fit:cover;border:3px solid var(--amarelo)" onerror="this.onerror=null;this.src=avatarFallback('${jsStr(P.apelido||'')}')">`
    : `<img src="images/galo.png" alt="" class="mascot-img" onerror="this.style.display='none'">`;
  return `
    <div class="home-card">
      ${img}
      <h1>aguardando o anfitrião iniciar…</h1>
      <p class="home-sub">Você está no jogo como <strong>${esc(P.apelido)}</strong>.</p>
      <div class="level-preview">
        <div class="level-chip"><span class="chip-num">👤</span> ${esc(P.apelido)} <span class="chip-pts">${P.jogadores} na sala</span></div>
      </div>
    </div>
    <div class="footer-space"></div>
    <div class="footer-brand">
      <img src="images/logo_fad.png" alt="" onerror="this.style.display='none'">
      <span>${esc(P.meta.titulo || 'carotte')}</span>
    </div>`;
}

function telaAnuncio(){
  const modo = MODOS[P.modo] ? P.modo : 'unica';
  return `
    <div class="home-card">
      <p class="instruction">prepare-se</p>
      <h1>pergunta ${P.indice+1}${P.total?` de ${P.total}`:''}</h1>
      <span class="mode-selo ${modo}">${MODOS[modo].selo}</span>
      <p class="home-sub">${MODOS[modo].desc}</p>
      <img src="images/galo.png" alt="" class="mascot-sm" onerror="this.style.display='none'">
    </div>
    <div class="footer-space"></div>`;
}

function telaPergunta(){
  if(P.minhaResposta !== null) return telaEnviada();
  const mostrar = P.meta.mostrarNoAparelho && P.pergunta;
  const modo = MODOS[P.modo] ? P.modo : 'unica';
  const rest = Math.max(0, Math.ceil((P.fimEm - serverNow())/1000));
  const botoes = SHAPES.map((s,i)=>`
    <button class="shape-btn ${s.cls}" onclick="responder(${i})">
      ${shapeSvg(i)}
      ${mostrar ? `<span>${esc(P.pergunta.opcoes[i])}</span>` : ''}
    </button>`).join('');
  return `
    <div class="question-card">
      <p class="instruction">pergunta ${P.indice+1}${P.total?`/${P.total}`:''} · ${esc(MODOS[modo].nome)} · <span class="timer-num ${rest<=5?'alerta':''}" id="tick">${rest}s</span></p>
      ${mostrar ? `<p class="fr-sentence">${esc(P.pergunta.enunciado)}</p>` : `<p class="home-sub">Olhe a pergunta na tela e toque na forma da sua resposta.</p>`}
      <div class="shapes-grid" style="margin-top:12px">${botoes}</div>
    </div>
    <div class="footer-space"></div>`;
}

function telaEnviada(){
  const s = SHAPES[P.minhaResposta];
  return `
    <div class="question-card">
      <p class="instruction">resposta enviada</p>
      <div class="sent-box">
        <div class="sent-shape ${s.cls}">${shapeSvg(P.minhaResposta)}</div>
        <p class="home-sub">Você escolheu o <strong>${s.nome}</strong>.</p>
        <img src="images/galo.png" alt="" class="mascot-img" onerror="this.style.display='none'">
        <p class="home-sub">Aguardando os outros participantes…</p>
      </div>
    </div>
    <div class="footer-space"></div>`;
}

function telaRevelacao(){
  const acertou = P.eu.ultimoAcerto === true;
  const ganho = Number(P.eu.ultimoGanho) || 0;
  const img = acertou ? 'images/happygalo.png' : 'images/sadgalo.png';
  const semResposta = P.minhaResposta === null;
  const corretaTxt = (P.correta !== null && P.correta !== undefined)
    ? `A resposta certa era o <strong>${SHAPES[P.correta].nome}</strong>.` : '';
  return `
    <div class="home-card">
      <img src="${img}" alt="" class="mascot-img" onerror="this.style.display='none'">
      <h1>${acertou ? 'acertou!' : (semResposta ? 'tempo esgotado' : 'quase!')}</h1>
      <p class="final-score">${ganho >= 0 ? '+' : ''}${formatScore(ganho)}<span> pontos</span></p>
      <p class="home-sub">${acertou ? 'Mandou bem!' : corretaTxt}</p>
      <div class="breakdown">
        <div class="breakdown-row"><span>pontuação total</span><span>${formatScore(P.eu.pontos)}</span></div>
        <div class="breakdown-row"><span>acertos</span><span>${P.eu.acertos}</span></div>
        <div class="breakdown-row"><span>sequência atual</span><span>${P.eu.sequencia > 0 ? '🔥 ' + P.eu.sequencia : '—'}</span></div>
      </div>
    </div>
    <div class="footer-space"></div>`;
}

function blocoReacoes(){
  const enviado = P.reacoes[P.indice] || null;
  const botoes = REACOES.map((e,k)=>`
    <button class="emoji-btn ${enviado ? (enviado===e ? 'on' : 'dim') : ''}" ${enviado ? 'disabled' : ''}
            onclick="reagir(${k})" aria-label="reagir com ${e}">${e}</button>`).join('');
  return `
      <p class="instruction" style="margin:6px 0 0">${enviado ? 'reação enviada!' : 'mande uma reação para a tela'}</p>
      <div class="emoji-grid">${botoes}</div>`;
}

async function reagir(k){
  const emoji = REACOES[k];
  if(!emoji || P.fase !== 'ranking' || P.reacoes[P.indice] || !P.id) return;
  playSound('click');
  const idx = P.indice;
  P.reacoes[idx] = emoji;
  render();
  try{
    await gameRef(P.pin, `reacoes/${idx}/${P.id}`).set({ emoji: emoji, timestamp: SERVER_TS });
  }catch(e){
    delete P.reacoes[idx];
    render();
  }
}

function telaRanking(){
  return `
    <div class="home-card">
      <p class="instruction">ranking parcial</p>
      <h1>${P.posicao ? `você está em ${P.posicao}º` : 'olhe a tela principal'}</h1>
      <p class="final-score">${formatScore(P.eu.pontos)}<span> pontos</span></p>
      <p class="home-sub">${P.eu.sequencia > 1 ? `🔥 ${P.eu.sequencia} acertos seguidos!` : 'A próxima pergunta vem aí.'}</p>
      ${blocoReacoes()}
      <img src="${P.skin ? charSrc(P.skin) : 'images/galo.png'}" alt="" class="mascot-sm" style="border-radius:50%;object-fit:cover;border:3px solid var(--amarelo)" onerror="this.style.display='none'">
    </div>
    <div class="footer-space"></div>`;
}

/* =========================================================
   TELA — ESCOLHER OVADA (5 ACERTOS SEGUIDOS)
   ========================================================= */
function telaEscolhaOvada(){
  const outros = Object.entries(P.jogadoresSala || {}).filter(([id]) => id !== P.id);
  const listaHtml = outros.map(([id, j]) => `
    <div class="ovada-alvo-chip" onclick="lancarOvada('${id}')">
      <img src="${skinDe(j)}" alt="${esc(j.apelido)}" onerror="this.src=avatarFallback('${jsStr(j.apelido)}')">
      <span>${esc(j.apelido)}</span>
    </div>
  `).join('');

  return `
    <div class="question-card">
      <p class="instruction">🥚 5 acertos seguidos! hora da ovada!</p>
      <p class="home-sub">Escolha um participante da sala para sofrer a ovada (−300 pontos):</p>
      <div class="ovada-alvos-grid">${listaHtml || '<p>Nenhum outro jogador na sala.</p>'}</div>
    </div>
    <div class="footer-space"></div>`;
}

async function lancarOvada(alvoId){
  playSound('click');
  P.jaJogouOvada = true;
  try {
    await gameRef(P.pin, 'ovadas').push({
      atribuidor: P.id,
      vitima: alvoId,
      timestamp: SERVER_TS
    });
  } catch(e){}
  render();
}

function telaEsperaOvada(){
  return `
    <div class="question-card">
      <p class="instruction">🥚 ovada em andamento!</p>
      <img src="images/happygalo.png" alt="" class="mascot-img" onerror="this.style.display='none'">
      <h1>olhe a tela principal!</h1>
      <p class="home-sub">A ovada está voando…</p>
    </div>
    <div class="footer-space"></div>`;
}

function telaFim(){
  const total = P.total || 1;
  const pct = Math.round(P.eu.acertos / total * 100);
  const bom = pct >= 70;
  const img = bom ? 'images/happygalo.png' : 'images/sadgalo.png';
  return `
    <div class="question-card">
      <img src="${img}" alt="" class="mascot-img" onerror="this.style.display='none'">
      <h1>fim de jogo</h1>
      <p class="final-score">${formatScore(P.eu.pontos)}<span> pontos</span></p>
      <div class="breakdown">
        <div class="breakdown-row"><span>posição final</span><span>${P.posicao ? P.posicao + 'º' : '—'}</span></div>
        <div class="breakdown-row"><span>acertos</span><span>${P.eu.acertos} / ${total} (${pct}%)</span></div>
        <div class="breakdown-row"><span>maior sequência</span><span>🔥 ${P.eu.maiorSequencia}</span></div>
      </div>
      <p class="home-sub">${bom ? 'Esse galo está orgulhoso de você!' : 'Esse galo ficou apreensivo… bora treinar mais um pouco!'}</p>
    </div>
    <div class="footer-space"></div>
    <button class="btn btn-block" onclick="sairDoJogo()">sair</button>`;
}

/* =========================================================
   RESPOSTA
   ========================================================= */
async function responder(opcao){
  if(P.fase !== 'pergunta' || P.minhaResposta !== null) return;
  if(serverNow() > P.fimEm + 600) return;
  playSound('click');
  P.minhaResposta = opcao;
  render();
  try{
    await gameRef(P.pin, `respostas/${P.indice}/${P.id}`).set({
      opcao: opcao, timestamp: SERVER_TS
    });
  }catch(e){
    P.minhaResposta = null;
    render();
  }
}

/* =========================================================
   CRONÔMETRO
   ========================================================= */
function pararTick(){ if(tickTimer){ clearInterval(tickTimer); tickTimer = null; } }
function iniciarTick(){
  pararTick(); alertaTocado = false;
  tickTimer = setInterval(()=>{
    const rest = Math.max(0, Math.ceil((P.fimEm - serverNow())/1000));
    const el = document.getElementById('tick');
    if(el){
      el.innerText = rest + 's';
      el.className = 'timer-num' + (rest <= 5 ? ' alerta' : '');
    }
    if(rest <= 5 && rest > 0 && !alertaTocado && P.minhaResposta === null){
      alertaTocado = true; playSound('alert');
    }
    if(rest <= 0) pararTick();
  }, 250);
}

/* =========================================================
   ESCUTA DO FIREBASE
   ========================================================= */
function ouvirJogo(){
  listeners.forEach(l => { try{ l.ref.off(l.ev, l.cb); }catch(e){} });
  listeners = [];
  const on = (sub, ev, cb) => {
    const ref = gameRef(P.pin, sub);
    ref.on(ev, cb);
    listeners.push({ ref, ev, cb });
  };

  on('meta','value', s => {
    const m = s.val();
    if(!m){
      esquecer(); alert('O apresentador encerrou este jogo.'); location.href='index.html'; return;
    }
    P.meta.titulo = m.titulo || '';
    P.meta.mostrarNoAparelho = !!m.mostrarNoAparelho;
    render();
  });

  on('estado','value', s => {
    const e = s.val() || {};
    const faseAnterior = P.fase, indiceAnterior = P.indice;
    P.fase = e.fase || 'lobby';
    P.indice = typeof e.indice === 'number' ? e.indice : 0;
    P.inicioEm = e.inicioEm || 0;
    P.fimEm = e.fimEm || 0;
    P.correta = (typeof e.correta === 'number') ? e.correta : null;
    P.total = e.total || P.total;
    P.modo = MODOS[e.modo] ? e.modo : 'unica';
    P.pergunta = e.pergunta || null;

    if(P.indice !== indiceAnterior){
      P.minhaResposta = null;
      P.jaJogouOvada = false; // reseta a ovada para a nova pergunta
    }

    if(P.fase === 'pergunta'){
      if(faseAnterior !== 'pergunta'){ P.minhaResposta = null; }
      iniciarTick();
    } else {
      pararTick();
    }
    render();
  });

  on('jogadores/' + P.id, 'value', s => {
    const j = s.val();
    if(!j) return;
    P.eu = {
      pontos: j.pontos || 0, sequencia: j.sequencia || 0,
      maiorSequencia: j.maiorSequencia || 0, acertos: j.acertos || 0,
      ultimoGanho: j.ultimoGanho || 0, ultimoAcerto: j.ultimoAcerto
    };
    if(P.fase === 'revelacao' && j.ultimoAcerto !== null && j.ultimoAcerto !== undefined && P.somDe !== P.indice){
      P.somDe = P.indice;
      playSound(P.eu.ultimoAcerto === true ? 'ok' : 'falha');
      if(P.eu.ultimoGanho < 0) setTimeout(()=>playSound('losing'), 400);
    }
    render();
  });

  on('jogadores','value', s => {
    const j = s.val() || {};
    P.jogadoresSala = j;
    const lista = Object.entries(j).map(([id,v]) => ({ id, pontos:v.pontos||0 }))
      .sort((a,b)=> b.pontos - a.pontos);
    P.jogadores = lista.length;
    const idx = lista.findIndex(x => x.id === P.id);
    P.posicao = idx >= 0 ? idx + 1 : null;
    if(P.fase === 'ranking' || P.fase === 'fim' || P.fase === 'lobby') render();
  });

  on('ovadas','child_added', s => {
    const ov = s.val();
    if(!ov) return;
    if(ov.vitima === P.id || ov.atribuidor === P.id){
      P.fase = 'ovada';
      render();
      setTimeout(() => {
        P.fase = 'ranking';
        render();
      }, 4000);
    }
  });
}

/* =========================================================
   BOOT
   ========================================================= */
async function boot(){
  if(PAGE === 'entrada'){ render(); return; }

  const url = new URL(location.href);
  const pinUrl = (url.searchParams.get('pin') || '').replace(/\D/g,'');
  const salvo = loadState(SAVE_KEY);
  P.pin = pinUrl || (salvo ? salvo.pin : null);

  if(!P.pin || !db){ location.href = 'index.html'; return; }

  if(salvo && salvo.pin === P.pin && salvo.id){
    try{
      const snap = await gameRef(P.pin, 'jogadores/' + salvo.id).get();
      if(snap.exists()){
        const j = snap.val();
        P.id = salvo.id; P.apelido = j.apelido; P.personagem = j.personagem; P.skin = j.skin;
        P.eu = { pontos:j.pontos||0, sequencia:j.sequencia||0, maiorSequencia:j.maiorSequencia||0,
                 acertos:j.acertos||0, ultimoGanho:j.ultimoGanho||0, ultimoAcerto:j.ultimoAcerto };
        P.etapa = 'espera'; P.resumed = true;
        const est = (await gameRef(P.pin,'estado').get()).val() || {};
        const idx = typeof est.indice === 'number' ? est.indice : 0;
        const r = await gameRef(P.pin, `respostas/${idx}/${P.id}`).get();
        if(r.exists()) P.minhaResposta = r.val().opcao;
        const rx = await gameRef(P.pin, `reacoes/${idx}/${P.id}`).get();
        if(rx.exists()) P.reacoes[idx] = rx.val().emoji;
        ouvirJogo(); render(); return;
      }
    }catch(e){}
  }

  try{
    const meta = await gameRef(P.pin,'meta').get();
    if(!meta.exists()){ esquecer(); location.href = 'index.html'; return; }
    P.meta.titulo = (meta.val()||{}).titulo || '';
  }catch(e){ location.href = 'index.html'; return; }

  P.carIndex = Math.floor(Math.random() * PERSONAGENS.length);
  P.skinIndex = 0;
  P.etapa = 'carrossel';
  render();
}

boot();
