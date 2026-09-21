/* =========================================================
   CAROTTE — host.js
   Tela do apresentador: criar/importar, lobby com PIN e QR,
   controle das fases, pontuação, ranking, pódio e relatório.
   O host é a fonte da verdade: só ele calcula pontos.
   ========================================================= */

const HOST_KEY = 'carotte_host_v1';

const H = {
  tela:'abertura',     // abertura | editor | lobby | jogo | podio | relatorio
  pin:null,
  quiz:{ titulo:'', descricao:'', perguntas:[] },
  mostrarNoAparelho:false,
  fase:'lobby',        // lobby | anuncio | pergunta | revelacao | ranking | fim
  indice:0,
  inicioEm:0, fimEm:0,
  jogadores:{},        // id -> dados
  respostasAtuais:{},  // id -> {opcao, timestamp}
  resultados:{},       // indice -> {distribuicao, detalhes}
  erros:[],
  aba:'ranking',
  resumed:false,
  travaRevelacao:false,
  prevTop5:[]          // ordem do ranking anterior, para animar quem ultrapassou quem
};

let hostListeners = [];
let faseTimer = null, tickTimer = null, alertaTocado = false, contagem = 3;

/* =========================================================
   PERSISTÊNCIA DO HOST
   ========================================================= */
function salvarHost(){
  saveState(HOST_KEY, {
    v:1, tela:H.tela, pin:H.pin, quiz:H.quiz,
    mostrarNoAparelho:H.mostrarNoAparelho, indice:H.indice, fase:H.fase
  });
}
function reiniciarHost(){
  if(!confirm('Encerrar este jogo e voltar ao início? Os participantes serão desconectados.')) return;
  playSound('click');
  apagarJogo();
  pararTudo();
  clearState(HOST_KEY);
  location.reload();
}

/* apaga o jogo nó por nó (as regras do banco não permitem apagar a raiz) */
function apagarJogo(){
  if(!H.pin) return;
  try{
    gameRef(H.pin).update({
      meta:null, perguntas:null, estado:null,
      jogadores:null, respostas:null, resultados:null
    });
  }catch(e){}
}

/* =========================================================
   RENDER
   ========================================================= */
function render(){
  renderTopbar();
  const c = document.getElementById('content');
  const rolavel = (H.tela === 'editor' || H.tela === 'relatorio');
  document.body.classList.toggle('scroll-ok', rolavel);
  document.documentElement.style.overflow = rolavel ? '' : 'hidden';
  switch(H.tela){
    case 'editor':    c.innerHTML = telaEditor(); break;
    case 'lobby':     c.innerHTML = telaLobby(); desenharQR(); break;
    case 'jogo':      c.innerHTML = telaJogo(); if(H.fase==='ranking') animarRanking(); break;
    case 'podio':     c.innerHTML = telaPodio(); break;
    case 'relatorio': c.innerHTML = telaRelatorio(); break;
    default:          c.innerHTML = telaAbertura();
  }
  salvarHost();
}

function renderTopbar(){
  const bar = document.getElementById('topbar');
  const total = H.quiz.perguntas.length;
  let label = 'carotte · apresentador';
  let pct = 0;
  if(H.pin && H.tela === 'lobby') label = `carotte · pin ${H.pin}`;
  else if(H.tela === 'jogo'){
    label = `carotte · pin ${H.pin} · pergunta ${H.indice+1}/${total}`;
    pct = Math.round((H.indice + (H.fase === 'pergunta' ? 0 : 1)) / Math.max(1,total) * 100);
  } else if(H.tela === 'podio' || H.tela === 'relatorio'){ label = `carotte · pin ${H.pin} · resultados`; pct = 100; }
  else if(H.tela === 'editor') label = 'carotte · montando o jogo';

  const nJog = Object.keys(H.jogadores).length;
  const botoes = (H.tela === 'abertura' || H.tela === 'editor') ? '' : `
    <button class="mute-btn" title="som de fundo" onclick="alternarSom(this)">${som.icon()}</button>
    <button class="restart-btn" title="encerrar e recomeçar" onclick="reiniciarHost()">&#8634;</button>`;

  bar.innerHTML = `
    ${H.resumed ? `<span class="resume-note">progresso retomado de onde você parou</span>` : ''}
    <div class="topbar-row">
      <img src="images/LOGO.png" alt="Carotte" class="topbar-logo" onerror="this.style.display='none'">
      <span class="level-label">${esc(label)}</span>
      ${botoes}
      <span class="score-badge">👥 ${nJog}</span>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>`;
}

function alternarSom(btn){ btn.innerText = som.toggle() ? '🔇' : '🔊'; }

/* =========================================================
   TELA — ABERTURA
   ========================================================= */
function telaAbertura(){
  const salvo = loadState(HOST_KEY);
  const retomar = (salvo && salvo.pin)
    ? `<button class="btn-ghost btn" onclick="retomarJogo()">retomar o jogo ${esc(salvo.pin)}</button>` : '';
  return `
    <div class="home-card">
      <img src="images/CAROTTELOGO.png" alt="Carotte" class="brand-logo" onerror="this.style.display='none'">
      <h1>carotte</h1>
      <p class="home-sub">Quiz ao vivo para escolas, treinamentos e eventos.<br>
        Você mostra as perguntas na tela grande; a turma responde pelo celular.</p>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn" onclick="criarDoZero()">criar um quiz</button>
        <button class="btn btn-ghost" onclick="document.getElementById('jsonFile').click()">importar json</button>
      </div>
      ${retomar}
      ${H.erros.length ? caixaErros() : ''}
      <img src="images/LOGO-JEUGALO.png" alt="" class="logo-sec" style="margin-top:18px" onerror="this.style.display='none'">
    </div>
    <div class="footer-space"></div>
    <div class="footer-brand">
      <img src="images/logo_fad.png" alt="" onerror="this.style.display='none'">
      <span>carotte · quiz ao vivo</span>
    </div>`;
}

function caixaErros(){
  return `<div class="gabarito">Não consegui usar esse arquivo:
    <ul>${H.erros.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`;
}

/* =========================================================
   CRIAÇÃO / IMPORTAÇÃO
   ========================================================= */
function perguntaVazia(){
  return { enunciado:'', opcoes:['','','',''], correta:0, tempo:20, modo:'unica' };
}
function criarDoZero(){
  playSound('click');
  H.erros = [];
  H.quiz = { titulo:'', descricao:'', perguntas:[perguntaVazia()] };
  H.tela = 'editor';
  render();
}
function importarArquivo(ev){
  const file = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if(!file) return;
  playSound('click');
  const fr = new FileReader();
  fr.onload = () => {
    let obj = null;
    try{ obj = JSON.parse(fr.result); }
    catch(e){ H.erros = ['o arquivo não é um JSON válido (confira vírgulas e aspas)']; H.tela='abertura'; render(); return; }
    const erros = validarQuiz(obj);
    if(erros.length){ H.erros = erros; H.tela='abertura'; render(); return; }
    H.erros = [];
    H.quiz = {
      titulo: String(obj.titulo || ''),
      descricao: String(obj.descricao || ''),
      perguntas: obj.perguntas.map(normPergunta)
    };
    H.tela = 'editor';
    render();
  };
  fr.readAsText(file);
}

function baixarJson(){
  playSound('click');
  const data = JSON.stringify({
    titulo: H.quiz.titulo, descricao: H.quiz.descricao,
    perguntas: H.quiz.perguntas.map(p => ({
      enunciado:p.enunciado, opcoes:p.opcoes, correta:p.correta, tempo:p.tempo, modo:p.modo
    }))
  }, null, 2);
  const blob = new Blob([data], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (H.quiz.titulo || 'carotte').toLowerCase().replace(/[^a-z0-9]+/g,'-') + '.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
}

/* =========================================================
   TELA — EDITOR
   ========================================================= */
function telaEditor(){
  const cards = H.quiz.perguntas.map((p,i)=>{
    const opts = p.opcoes.map((o,k)=>`
      <div class="opt-edit">
        <span class="shape-dot ${SHAPES[k].cls}">${shapeSvg(k)}</span>
        <input type="text" value="${esc(o)}" placeholder="opção ${k+1}"
               oninput="setOpcao(${i},${k},this.value)">
        <input type="radio" class="radio-correct" name="correta-${i}" ${p.correta===k?'checked':''}
               title="marcar como correta" onchange="setCorreta(${i},${k})">
      </div>`).join('');
    const tempos = TEMPOS.map(t=>`<option value="${t}" ${p.tempo===t?'selected':''}>${t}s</option>`).join('');
    const modos = Object.keys(MODOS).map(m=>`<option value="${m}" ${p.modo===m?'selected':''}>${MODOS[m].nome}</option>`).join('');
    return `
      <div class="q-card">
        <div class="q-head">
          <span class="chip-num">${i+1}</span>
          <span class="mini-label">pergunta</span>
          <span class="q-tools">
            <button class="icon-btn" title="subir" onclick="moverPergunta(${i},-1)">↑</button>
            <button class="icon-btn" title="descer" onclick="moverPergunta(${i},1)">↓</button>
            <button class="icon-btn danger" title="remover" onclick="removerPergunta(${i})">✕</button>
          </span>
        </div>
        <input type="text" class="text-input" style="text-align:left" value="${esc(p.enunciado)}"
               placeholder="escreva o enunciado" oninput="setEnunciado(${i},this.value)">
        ${opts}
        <div class="q-meta">
          <span class="mini-label">tempo</span>
          <select class="pill-select" onchange="setTempo(${i},this.value)">${tempos}</select>
          <span class="mini-label">pontuação</span>
          <select class="pill-select" onchange="setModo(${i},this.value)">${modos}</select>
          <span class="mini-label" style="margin-left:auto">${esc(MODOS[p.modo].desc)}</span>
        </div>
      </div>`;
  }).join('');

  const aplicar = TEMPOS.map(t=>`<button class="btn btn-ghost btn-sm" onclick="aplicarTempoATodas(${t})">${t}s em todas</button>`).join('');

  return `
    <div class="intro-card">
      <span class="intro-tag">passo 1 · o conteúdo</span>
      <p class="field-label">título do jogo</p>
      <input type="text" class="text-input" style="text-align:left" value="${esc(H.quiz.titulo)}"
             placeholder="ex.: Les légumes" oninput="H.quiz.titulo=this.value; salvarHost()">
      <p class="field-label">descrição (opcional)</p>
      <input type="text" class="text-input" style="text-align:left" value="${esc(H.quiz.descricao)}"
             placeholder="uma linha sobre o quiz" oninput="H.quiz.descricao=this.value; salvarHost()">
      <div class="switch-row">
        <input type="checkbox" id="mostrar" ${H.mostrarNoAparelho?'checked':''} onchange="H.mostrarNoAparelho=this.checked; salvarHost()">
        <label for="mostrar">mostrar a pergunta também no aparelho do participante</label>
      </div>
    </div>

    <div class="editor-list">${cards}</div>

    <div class="btn-row">
      <button class="btn btn-ghost" onclick="adicionarPergunta()">+ adicionar pergunta</button>
      <button class="btn btn-ghost" onclick="baixarJson()">baixar json</button>
      <button class="btn btn-ghost" onclick="document.getElementById('jsonFile').click()">trocar por outro json</button>
    </div>
    <div class="tab-row">${aplicar}</div>
    ${H.erros.length ? caixaErros() : ''}
    <div class="footer-space"></div>
    <button class="btn btn-block" onclick="abrirSala()">abrir a sala</button>`;
}

function setEnunciado(i,v){ H.quiz.perguntas[i].enunciado = v; salvarHost(); }
function setOpcao(i,k,v){ H.quiz.perguntas[i].opcoes[k] = v; salvarHost(); }
function setCorreta(i,k){ H.quiz.perguntas[i].correta = k; salvarHost(); }
function setTempo(i,v){ H.quiz.perguntas[i].tempo = Number(v); salvarHost(); render(); }
function setModo(i,v){ H.quiz.perguntas[i].modo = v; salvarHost(); render(); }
function aplicarTempoATodas(t){ playSound('click'); H.quiz.perguntas.forEach(p=>p.tempo=t); render(); }
function adicionarPergunta(){ playSound('click'); H.quiz.perguntas.push(perguntaVazia()); render(); }
function removerPergunta(i){
  if(H.quiz.perguntas.length === 1){ alert('O jogo precisa de pelo menos uma pergunta.'); return; }
  if(!confirm(`Remover a pergunta ${i+1}?`)) return;
  playSound('click'); H.quiz.perguntas.splice(i,1); render();
}
function moverPergunta(i,d){
  const j = i + d;
  if(j < 0 || j >= H.quiz.perguntas.length) return;
  playSound('click');
  const a = H.quiz.perguntas;
  [a[i],a[j]] = [a[j],a[i]];
  render();
}

function validarAntesDeAbrir(){
  const erros = [];
  if(!H.quiz.titulo.trim()) erros.push('dê um título ao jogo');
  H.quiz.perguntas.forEach((p,i)=>{
    if(!p.enunciado.trim()) erros.push(`pergunta ${i+1}: falta o enunciado`);
    if(p.opcoes.some(o => !String(o).trim())) erros.push(`pergunta ${i+1}: preencha as 4 opções`);
  });
  return erros;
}

/* =========================================================
   ABRIR A SALA — gera PIN e publica o jogo
   ========================================================= */
async function gerarPin(){
  for(let tentativa=0; tentativa<25; tentativa++){
    const pin = String(Math.floor(100000 + Math.random()*900000));
    const snap = await gameRef(pin,'meta').get();
    if(!snap.exists()) return pin;
  }
  throw new Error('sem pin livre');
}

async function abrirSala(){
  playSound('click');
  const erros = validarAntesDeAbrir();
  if(erros.length){ H.erros = erros; render(); return; }
  H.erros = [];
  if(!db){ H.erros = ['sem conexão com o Firebase — confira o firebase-config.js']; render(); return; }
  try{
    H.pin = await gerarPin();
    await gameRef(H.pin).update({
      meta:{
        titulo:H.quiz.titulo, descricao:H.quiz.descricao,
        criadoEm: SERVER_TS, mostrarNoAparelho: H.mostrarNoAparelho,
        totalPerguntas: H.quiz.perguntas.length
      },
      perguntas: H.quiz.perguntas,
      estado:{ fase:'lobby', indice:0, total:H.quiz.perguntas.length }
    });
    gameRef(H.pin).onDisconnect().update({ 'meta/hostOnline': false });
    H.fase = 'lobby'; H.indice = 0; H.tela = 'lobby'; H.prevTop5 = [];
    ouvirJogo();
    render();
  }catch(e){
    H.erros = ['não consegui criar a sala; verifique a conexão e as regras do banco'];
    render();
  }
}

/* =========================================================
   TELA — LOBBY
   ========================================================= */
function linkDoJogador(){
  const base = location.href.split('?')[0].replace(/host\.html$/,'');
  return base + 'player.html?pin=' + H.pin;
}

function telaLobby(){
  const lista = Object.entries(H.jogadores).map(([id,j])=>`
    <div class="player-chip">
      <img src="${retratoDe(j.personagem)}" alt="${esc(j.apelido)}" onerror="this.onerror=null;this.src=avatarFallback('${jsStr(j.personagem||'')}')">
      <span class="player-name">${esc(j.apelido)}</span>
    </div>`).join('');
  const n = Object.keys(H.jogadores).length;
  return `
    <div class="question-card">
      <p class="instruction">${esc(H.quiz.titulo)} · ${H.quiz.perguntas.length} perguntas</p>
      <div class="lobby-split">
        <div style="text-align:center">
          <p class="instruction">entre em <strong>${esc(linkDoJogador().replace(/^https?:\/\//,'').split('?')[0])}</strong></p>
          <div class="pin-big">${esc(H.pin||'')}</div>
        </div>
        <div class="qr-box"><div id="qrcode"></div></div>
      </div>
      <p class="home-sub" style="margin-top:10px">ou aponte a câmera para o QR code</p>
    </div>

    <div class="question-card">
      <p class="instruction">${n === 0 ? 'ninguém entrou ainda' : `${n} na sala`}</p>
      <div class="lobby-grid">${lista || ''}</div>
    </div>
    <div class="footer-space"></div>
    <button class="btn btn-block" onclick="iniciarJogo()" ${n===0?'disabled':''}>
      ${n===0 ? 'aguardando participantes…' : 'iniciar o jogo'}
    </button>`;
}

let qrFeito = null;
function desenharQR(){
  const el = document.getElementById('qrcode');
  if(!el || typeof QRCode === 'undefined') return;
  if(qrFeito === H.pin && el.childElementCount) return;
  el.innerHTML = '';
  try{
    new QRCode(el, { text: linkDoJogador(), width:200, height:200, correctLevel: QRCode.CorrectLevel.M });
    qrFeito = H.pin;
  }catch(e){}
}

/* =========================================================
   CONTROLE DAS FASES
   ========================================================= */
function pararTudo(){
  if(faseTimer){ clearTimeout(faseTimer); faseTimer = null; }
  if(tickTimer){ clearInterval(tickTimer); tickTimer = null; }
}

async function escrever(estado){
  try{ await gameRef(H.pin,'estado').set(estado); }catch(e){}
}

function iniciarJogo(){
  playSound('click');
  if(!Object.keys(H.jogadores).length) return;
  H.tela = 'jogo';
  anunciar(0);
}

async function anunciar(i){
  pararTudo();
  H.indice = i; H.fase = 'anuncio'; H.travaRevelacao = false;
  H._rankAnimKey = null; /* permite animar o ranking desta pergunta */
  contagem = 3;
  const p = H.quiz.perguntas[i];
  await escrever({
    fase:'anuncio', indice:i, total:H.quiz.perguntas.length,
    modo:p.modo, pergunta: null
  });
  playSound('modo');
  render();
  tickTimer = setInterval(()=>{
    contagem--;
    const el = document.getElementById('contagem');
    if(el) el.innerText = contagem > 0 ? contagem : '🥕';
    if(contagem <= 0){ clearInterval(tickTimer); tickTimer = null; }
  }, 1000);
  faseTimer = setTimeout(()=>perguntar(i), 3000);
}

async function perguntar(i, retomando){
  pararTudo();
  const p = H.quiz.perguntas[i];
  H.fase = 'pergunta'; H.indice = i; H.travaRevelacao = false; alertaTocado = false;
  if(!retomando){
    H.inicioEm = serverNow();
    H.fimEm = H.inicioEm + p.tempo*1000;
    H.respostasAtuais = {};
    await escrever({
      fase:'pergunta', indice:i, total:H.quiz.perguntas.length, modo:p.modo,
      inicioEm:H.inicioEm, fimEm:H.fimEm,
      pergunta: H.mostrarNoAparelho ? { enunciado:p.enunciado, opcoes:p.opcoes } : null
    });
    playSound('question');
  }
  render();
  tickTimer = setInterval(()=>{
    const restMs = Math.max(0, H.fimEm - serverNow());
    const rest = Math.ceil(restMs/1000);
    const num = document.getElementById('tick');
    const barra = document.getElementById('timerFill');
    if(num){ num.innerText = rest + 's'; num.className = 'timer-num' + (rest<=5?' alerta':''); }
    if(barra){
      barra.style.width = Math.max(0, restMs / (p.tempo*1000) * 100) + '%';
      barra.className = 'progress-fill timer' + (rest<=5?' alerta':'');
    }
    if(rest <= 5 && rest > 0 && !alertaTocado){ alertaTocado = true; playSound('alert'); }
    if(restMs <= 0) revelar();
  }, 200);
}

/* revela automaticamente quando todos já responderam */
function talvezRevelarCedo(){
  if(H.fase !== 'pergunta') return;
  const nJog = Object.keys(H.jogadores).length;
  const nResp = Object.keys(H.respostasAtuais).length;
  if(nJog > 0 && nResp >= nJog) setTimeout(revelar, 600);
}

async function revelar(){
  if(H.fase !== 'pergunta' || H.travaRevelacao) return;
  H.travaRevelacao = true;
  pararTudo();
  const i = H.indice;
  const p = H.quiz.perguntas[i];

  let respostas = {}, jogadores = {};
  try{
    respostas = (await gameRef(H.pin,'respostas/'+i).get()).val() || {};
    jogadores = (await gameRef(H.pin,'jogadores').get()).val() || {};
  }catch(e){ jogadores = H.jogadores; }

  /* ---- distribuição por opção ---- */
  const distribuicao = [0,0,0,0];
  Object.values(respostas).forEach(r => {
    if(typeof r.opcao === 'number' && r.opcao >= 0 && r.opcao <= 3) distribuicao[r.opcao]++;
  });

  /* ---- ordem dos acertos pelo timestamp do servidor ---- */
  const acertosOrdenados = Object.entries(respostas)
    .filter(([id,r]) => r.opcao === p.correta)
    .sort((a,b) => (a[1].timestamp||0) - (b[1].timestamp||0));

  const ganhoPorId = {};
  acertosOrdenados.forEach(([id], pos) => {
    if(p.modo === 'dupla')          ganhoPorId[id] = 2000;
    else if(p.modo === 'veloz')     ganhoPorId[id] = Math.max(1000, 2000 - 200*pos);
    else if(p.modo === 'arriscada') ganhoPorId[id] = 1500;
    else                            ganhoPorId[id] = 1000;
  });

  /* ---- atualização de todos os jogadores ---- */
  const updates = {};
  const detalhes = {};
  Object.entries(jogadores).forEach(([id,j]) => {
    const r = respostas[id];
    const respondeu = !!r && typeof r.opcao === 'number';
    const acertou = respondeu && r.opcao === p.correta;
    let ganho = 0;
    if(acertou) ganho = ganhoPorId[id] || 1000;
    else if(p.modo === 'arriscada' && respondeu) ganho = -200;

    const pontos = Math.max(0, (j.pontos||0) + ganho);
    const sequencia = acertou ? (j.sequencia||0) + 1 : 0;
    const maior = Math.max(j.maiorSequencia||0, sequencia);
    const acertosTot = (j.acertos||0) + (acertou ? 1 : 0);

    updates[`jogadores/${id}/pontos`] = pontos;
    updates[`jogadores/${id}/sequencia`] = sequencia;
    updates[`jogadores/${id}/maiorSequencia`] = maior;
    updates[`jogadores/${id}/acertos`] = acertosTot;
    updates[`jogadores/${id}/ultimoGanho`] = ganho;
    updates[`jogadores/${id}/ultimoAcerto`] = acertou;

    detalhes[id] = {
      apelido:j.apelido, personagem:j.personagem,
      opcao: respondeu ? r.opcao : null,
      acertou, pontos: ganho,
      ms: (respondeu && r.timestamp) ? Math.max(0, r.timestamp - H.inicioEm) : null
    };
  });

  updates[`resultados/${i}`] = { distribuicao, detalhes, correta:p.correta, modo:p.modo, tempo:p.tempo, enunciado:p.enunciado };
  try{ await gameRef(H.pin).update(updates); }catch(e){}

  H.resultados[i] = { distribuicao, detalhes };
  H.fase = 'revelacao';
  await escrever({
    fase:'revelacao', indice:i, total:H.quiz.perguntas.length,
    modo:p.modo, correta:p.correta,
    pergunta: H.mostrarNoAparelho ? { enunciado:p.enunciado, opcoes:p.opcoes } : null
  });
  render();
}

async function mostrarRanking(){
  playSound('click');
  H.fase = 'ranking';
  await escrever({ fase:'ranking', indice:H.indice, total:H.quiz.perguntas.length });
  playSound('level');
  render();
}

function proximaPergunta(){
  playSound('click');
  if(H.indice + 1 < H.quiz.perguntas.length) anunciar(H.indice + 1);
  else finalizar();
}

async function finalizar(){
  pararTudo();
  H.fase = 'fim'; H.tela = 'podio';
  await escrever({ fase:'fim', indice:H.indice, total:H.quiz.perguntas.length });
  playSound('win');
  render();
}

/* =========================================================
   TELA — JOGO (anúncio · pergunta · revelação · ranking)
   ========================================================= */
function telaJogo(){
  if(H.fase === 'anuncio')   return blocoAnuncio();
  if(H.fase === 'pergunta')  return blocoPergunta();
  if(H.fase === 'revelacao') return blocoRevelacao();
  if(H.fase === 'ranking')   return blocoRanking();
  return blocoAnuncio();
}

function blocoAnuncio(){
  const p = H.quiz.perguntas[H.indice];
  return `
    <div class="home-card">
      <p class="instruction">prepare-se</p>
      <h1>pergunta ${H.indice+1} de ${H.quiz.perguntas.length}</h1>
      <span class="mode-selo ${p.modo}">${MODOS[p.modo].selo}</span>
      <p class="home-sub">${MODOS[p.modo].desc} · ${p.tempo} segundos</p>
      <div class="count-num" id="contagem">3</div>
    </div>
    <div class="footer-space"></div>`;
}

function blocoPergunta(){
  const p = H.quiz.perguntas[H.indice];
  const rest = Math.max(0, Math.ceil((H.fimEm - serverNow())/1000));
  const nResp = Object.keys(H.respostasAtuais).length;
  const opts = p.opcoes.map((o,k)=>`
    <div class="host-option ${SHAPES[k].cls}">${shapeSvg(k)}<span>${esc(o)}</span></div>`).join('');
  return `
    <div class="question-card">
      <p class="instruction">${esc(MODOS[p.modo].nome)} · <span class="timer-num ${rest<=5?'alerta':''}" id="tick">${rest}s</span></p>
      <div class="progress-track" style="width:100%;margin-bottom:18px">
        <div class="progress-fill timer${rest<=5?' alerta':''}" id="timerFill" style="width:${Math.max(0, Math.min(100,(H.fimEm-serverNow())/(p.tempo*10)))}%"></div>
      </div>
      <p class="fr-sentence">${esc(p.enunciado)}</p>
      <div class="host-options">${opts}</div>
      <p class="instruction" style="margin-top:18px">${nResp} de ${Object.keys(H.jogadores).length} já responderam</p>
    </div>
    <div class="footer-space"></div>
    <button class="btn btn-block" onclick="revelar()">mostrar a resposta agora</button>`;
}

function blocoRevelacao(){
  const p = H.quiz.perguntas[H.indice];
  const res = H.resultados[H.indice] || { distribuicao:[0,0,0,0] };
  const totalResp = res.distribuicao.reduce((a,b)=>a+b,0) || 1;
  const barras = p.opcoes.map((o,k)=>{
    const n = res.distribuicao[k] || 0;
    const pct = Math.round(n/totalResp*100);
    const cor = k === p.correta ? 'var(--green-correct)' : SHAPES[k].cor;
    return `
      <div class="bar-row">
        <span class="bar-shape ${k===p.correta?'':SHAPES[k].cls}" style="${k===p.correta?'background:var(--green-correct)':''}">${shapeSvg(k)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${cor}"></div></div>
        <span class="bar-count">${n}</span>
      </div>`;
  }).join('');
  const opts = p.opcoes.map((o,k)=>`
    <div class="host-option ${SHAPES[k].cls} ${k===p.correta?'correct':'dim'}">${shapeSvg(k)}<span>${esc(o)}</span></div>`).join('');
  return `
    <div class="question-card">
      <p class="instruction">resposta certa</p>
      <p class="fr-sentence">${esc(p.enunciado)}</p>
      <div class="host-options">${opts}</div>
      <div style="width:100%;margin-top:22px">${barras}</div>
    </div>
    <div class="footer-space"></div>
    <button class="btn btn-block" onclick="mostrarRanking()">ver o ranking</button>`;
}

function listaOrdenada(){
  return Object.entries(H.jogadores)
    .map(([id,j]) => ({ id, ...j }))
    .sort((a,b) => (b.pontos||0) - (a.pontos||0) || String(a.apelido).localeCompare(String(b.apelido)));
}

/* anima a fileira de quem ultrapassou outro participante no ranking,
   comparando a ordem atual com a do ranking anterior (técnica FLIP).
   Roda no máximo uma vez por pergunta para não misturar imagens em re-renders. */
function animarRanking(){
  const chave = H.indice + ':' + (H.fase || '');
  if(H._rankAnimKey === chave) return; /* já animou este ranking */
  const reduzido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rows = Array.prototype.slice.call(document.querySelectorAll('.rank-row[data-id]'));
  if(!rows.length) return;
  const prev = H.prevTop5 || [];
  const atual = rows.map(r => r.dataset.id);
  const mudou = prev.length && atual.some((id, i) => prev.indexOf(id) !== i);
  if(!reduzido && mudou){
    let rowH = 74;
    if(rows.length > 1){
      const a = rows[0].getBoundingClientRect();
      const b = rows[1].getBoundingClientRect();
      rowH = b.top - a.top;
    }
    rows.forEach((row, newIndex) => {
      const id = row.dataset.id;
      const oldIndex = prev.indexOf(id);
      if(oldIndex === -1 || oldIndex === newIndex) return;
      const delta = (oldIndex - newIndex) * rowH;
      /* trava o conteúdo da linha (imagem+nome) ao personagem certo durante o slide */
      row.style.willChange = 'transform';
      row.style.transition = 'none';
      row.style.transform = `translateY(${delta}px)`;
      row.style.zIndex = oldIndex > newIndex ? '3' : '1';
      void row.offsetHeight; /* reflow */
      requestAnimationFrame(()=>{
        row.style.transition = 'transform .6s cubic-bezier(.34,1.56,.64,1)';
        row.style.transform = 'translateY(0)';
        if(oldIndex > newIndex){
          row.classList.add('rank-move-up');
          setTimeout(()=>{
            row.classList.remove('rank-move-up');
            row.style.willChange = '';
            row.style.zIndex = '';
            row.style.transition = '';
            row.style.transform = '';
          }, 700);
        } else {
          setTimeout(()=>{
            row.style.willChange = '';
            row.style.zIndex = '';
            row.style.transition = '';
            row.style.transform = '';
          }, 700);
        }
      });
    });
  }
  H.prevTop5 = atual;
  H._rankAnimKey = chave;
}

function blocoRanking(){
  const lista = listaOrdenada();
  const top = lista.slice(0,5);
  const linhas = top.map((j,i)=>{
    const g = Number(j.ultimoGanho)||0;
    const cls = g > 0 ? '' : (g < 0 ? 'neg' : 'zero');
    /* data-personagem ajuda a depurar e garante que img acompanha o id da linha */
    return `
      <div class="rank-row" data-id="${esc(j.id)}" data-personagem="${esc(j.personagem||'')}">
        <span class="chip-num">${i+1}</span>
        <img src="${galoDe(j.personagem)}" alt="${esc(j.apelido)}" decoding="sync" onerror="this.onerror=null;this.src=avatarFallback('${jsStr(j.personagem||'')}')">
        <span class="rank-name">${esc(j.apelido)}</span>
        <span class="rank-gain ${cls}">${g>0?'+':''}${formatScore(g)}</span>
        <span class="rank-pts">${formatScore(j.pontos||0)}</span>
      </div>`;
  }).join('');

  const fogo = lista.slice().sort((a,b)=>(b.sequencia||0)-(a.sequencia||0))[0];
  const destaque = (fogo && (fogo.sequencia||0) >= 2) ? `
    <div class="streak-card">
      <img src="${galoDe(fogo.personagem)}" alt="" onerror="this.style.display='none'">
      <div class="streak-text">
        <strong>🔥 ${fogo.sequencia} acertos seguidos</strong>
        ${esc(fogo.apelido)} · ${esc(fogo.personagem)} está embalado!
      </div>
    </div>` : `
    <div class="streak-card">
      <img src="images/galo.png" alt="" onerror="this.style.display='none'">
      <div class="streak-text"><strong>ninguém emendou duas ainda</strong>a próxima pergunta pode começar uma sequência.</div>
    </div>`;

  const ultima = H.indice + 1 >= H.quiz.perguntas.length;
  return `
    <div class="question-card">
      <p class="instruction">ranking depois da pergunta ${H.indice+1}</p>
      <div class="rank-list">${linhas}</div>
      ${destaque}
    </div>
    <div class="footer-space"></div>
    <button class="btn btn-block" onclick="proximaPergunta()">${ultima ? 'ver o pódio' : 'próxima pergunta'}</button>`;
}

/* =========================================================
   TELA — PÓDIO
   ========================================================= */
function telaPodio(){
  const lista = listaOrdenada();
  const col = (j,pos) => j ? `
    <div class="podium-col podium-${pos}">
      <img src="${galoDe(j.personagem)}" alt="" onerror="this.style.display='none'">
      <span class="podium-name">${esc(j.apelido)}</span>
      <span class="podium-pts">${formatScore(j.pontos||0)} pts</span>
      <div class="podium-block"><span class="podium-place">${pos}º</span></div>
    </div>` : '';
  return `
    <div class="question-card">
      <p class="instruction">${esc(H.quiz.titulo)} · fim de jogo</p>
      <img src="images/happygalo.png" alt="" class="mascot-img" onerror="this.style.display='none'">
      <h1 style="text-transform:lowercase;font-size:30px;margin:0 0 6px">pódio</h1>
      <div class="podium">
        ${col(lista[1],2)}
        ${col(lista[0],1)}
        ${col(lista[2],3)}
      </div>
    </div>
    <div class="btn-row">
      <button class="btn" onclick="baixarExcel()">baixar relatório (excel)</button>
      <button class="btn btn-ghost" onclick="abrirRelatorio()">ver relatório</button>
      <button class="btn btn-ghost" onclick="novoJogo()">novo jogo</button>
    </div>
    <div class="footer-space"></div>
    <div class="footer-brand">
      <img src="images/logo_fad.png" alt="" onerror="this.style.display='none'">
      <span>carotte</span>
    </div>`;
}

function novoJogo(){
  if(!confirm('Começar um novo jogo? O jogo atual será encerrado.')) return;
  playSound('click');
  apagarJogo();
  pararTudo();
  clearState(HOST_KEY);
  location.reload();
}

/* =========================================================
   TELA — RELATÓRIO NA PLATAFORMA
   ========================================================= */
function abrirRelatorio(){ playSound('click'); H.tela='relatorio'; render(); }
function trocarAba(a){ playSound('click'); H.aba = a; render(); }

function pctAcerto(j){
  const total = H.quiz.perguntas.length || 1;
  return Math.round((j.acertos||0)/total*100);
}

function telaRelatorio(){
  const abas = [['ranking','ranking final'],['respostas','respostas'],['perguntas','por pergunta']]
    .map(([k,n])=>`<button class="btn ${H.aba===k?'':'btn-ghost'} btn-sm" onclick="trocarAba('${k}')">${n}</button>`).join('');

  let corpo = '';
  const lista = listaOrdenada();

  if(H.aba === 'ranking'){
    corpo = `
      <table class="rep">
        <tr><th>#</th><th>apelido</th><th>personagem</th><th>pontos</th><th>acertos</th><th>% de acerto</th><th>maior sequência</th></tr>
        ${lista.map((j,i)=>`<tr>
          <td>${i+1}</td><td>${esc(j.apelido)}</td><td>${esc(j.personagem)}</td>
          <td>${formatScore(j.pontos||0)}</td><td>${j.acertos||0}</td>
          <td>${pctAcerto(j)}%</td><td>${j.maiorSequencia||0}</td></tr>`).join('')}
      </table>`;
  } else if(H.aba === 'respostas'){
    const cab = H.quiz.perguntas.map((p,i)=>`<th>p${i+1}</th>`).join('');
    corpo = `
      <table class="rep">
        <tr><th>apelido</th>${cab}<th>total</th></tr>
        ${lista.map(j=>`<tr><td>${esc(j.apelido)}</td>${
          H.quiz.perguntas.map((p,i)=>{
            const d = (H.resultados[i]||{}).detalhes || {};
            const r = d[j.id];
            if(!r || r.opcao === null || r.opcao === undefined) return `<td>—</td>`;
            const seg = r.ms !== null && r.ms !== undefined ? (r.ms/1000).toFixed(1)+'s' : '—';
            return `<td>${SHAPES[r.opcao].nome} · ${r.acertou?'✔':'✘'} · ${seg} · ${r.pontos>0?'+':''}${r.pontos}</td>`;
          }).join('')
        }<td>${formatScore(j.pontos||0)}</td></tr>`).join('')}
      </table>`;
  } else {
    corpo = `
      <table class="rep">
        <tr><th>#</th><th>enunciado</th><th>modo</th><th>tempo</th>
            <th>triângulo</th><th>losango</th><th>círculo</th><th>quadrado</th><th>% de acerto</th></tr>
        ${H.quiz.perguntas.map((p,i)=>{
          const r = H.resultados[i] || { distribuicao:[0,0,0,0], detalhes:{} };
          const nResp = r.distribuicao.reduce((a,b)=>a+b,0);
          const acertos = r.distribuicao[p.correta] || 0;
          const pct = nResp ? Math.round(acertos/Object.keys(H.jogadores).length*100) : 0;
          return `<tr><td>${i+1}</td><td>${esc(p.enunciado)}</td><td>${MODOS[p.modo].nome}</td><td>${p.tempo}s</td>
            ${r.distribuicao.map((n,k)=>`<td>${n}${k===p.correta?' ✔':''}</td>`).join('')}
            <td>${pct}%</td></tr>`;
        }).join('')}
      </table>`;
  }

  return `
    <div class="question-card">
      <p class="instruction">relatório · ${esc(H.quiz.titulo)} · pin ${esc(H.pin||'')}</p>
      <div class="tab-row">${abas}</div>
      <div class="table-wrap">${corpo}</div>
    </div>
    <div class="btn-row">
      <button class="btn" onclick="baixarExcel()">baixar relatório (excel)</button>
      <button class="btn btn-ghost" onclick="voltarPodio()">voltar ao pódio</button>
    </div>
    <div class="footer-space"></div>`;
}
function voltarPodio(){ playSound('click'); H.tela='podio'; render(); }

/* =========================================================
   RELATÓRIO EM EXCEL (SheetJS · 3 abas)
   ========================================================= */
function baixarExcel(){
  playSound('click');
  if(typeof XLSX === 'undefined'){ alert('A biblioteca de Excel não carregou. Verifique a conexão.'); return; }
  const lista = listaOrdenada();
  const wb = XLSX.utils.book_new();

  /* aba 1 — ranking final */
  const a1 = [['posição','apelido','personagem','pontos','acertos','% de acerto','maior sequência']];
  lista.forEach((j,i)=> a1.push([i+1, j.apelido, j.personagem, j.pontos||0, j.acertos||0, pctAcerto(j)+'%', j.maiorSequencia||0]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a1), 'ranking final');

  /* aba 2 — respostas por participante x pergunta */
  const a2 = [['apelido','pergunta','enunciado','opção escolhida','correta?','tempo de resposta (s)','pontos']];
  lista.forEach(j=>{
    H.quiz.perguntas.forEach((p,i)=>{
      const d = (H.resultados[i]||{}).detalhes || {};
      const r = d[j.id];
      a2.push([
        j.apelido, i+1, p.enunciado,
        (r && r.opcao !== null && r.opcao !== undefined) ? `${SHAPES[r.opcao].nome} — ${p.opcoes[r.opcao]}` : 'sem resposta',
        r && r.acertou ? 'sim' : 'não',
        (r && r.ms !== null && r.ms !== undefined) ? Number((r.ms/1000).toFixed(2)) : '',
        r ? r.pontos : 0
      ]);
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a2), 'respostas');

  /* aba 3 — por pergunta */
  const nJog = Object.keys(H.jogadores).length || 1;
  const a3 = [['pergunta','enunciado','modo','tempo (s)','resposta certa','triângulo','losango','círculo','quadrado','sem resposta','% de acerto']];
  H.quiz.perguntas.forEach((p,i)=>{
    const r = H.resultados[i] || { distribuicao:[0,0,0,0] };
    const respondentes = r.distribuicao.reduce((a,b)=>a+b,0);
    a3.push([
      i+1, p.enunciado, MODOS[p.modo].nome, p.tempo,
      `${SHAPES[p.correta].nome} — ${p.opcoes[p.correta]}`,
      r.distribuicao[0], r.distribuicao[1], r.distribuicao[2], r.distribuicao[3],
      Math.max(0, nJog - respondentes),
      Math.round((r.distribuicao[p.correta]||0)/nJog*100) + '%'
    ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a3), 'por pergunta');

  const nome = 'carotte-' + (H.quiz.titulo||'jogo').toLowerCase().replace(/[^a-z0-9]+/g,'-') + '-' + (H.pin||'') + '.xlsx';
  XLSX.writeFile(wb, nome);
}

/* =========================================================
   ESCUTA DO FIREBASE
   ========================================================= */
function ouvirJogo(){
  hostListeners.forEach(l => { try{ l.ref.off(l.ev, l.cb); }catch(e){} });
  hostListeners = [];
  const on = (sub, ev, cb) => {
    const ref = gameRef(H.pin, sub);
    ref.on(ev, cb);
    hostListeners.push({ ref, ev, cb });
  };

  on('jogadores','value', s => {
    H.jogadores = s.val() || {};
    render();
  });

  on('respostas','value', s => {
    const todas = s.val() || {};
    H.respostasAtuais = todas[H.indice] || {};
    if(H.fase === 'pergunta'){ render(); talvezRevelarCedo(); }
  });

  on('resultados','value', s => {
    const r = s.val() || {};
    Object.keys(r).forEach(k => { H.resultados[Number(k)] = r[k]; });
  });
}

/* =========================================================
   RETOMADA
   ========================================================= */
async function retomarJogo(){
  const salvo = loadState(HOST_KEY);
  if(!salvo || !salvo.pin) return;
  playSound('click');
  try{
    const snap = await gameRef(salvo.pin).get();
    if(!snap.exists()){ clearState(HOST_KEY); H.erros=['o jogo salvo não existe mais no servidor']; render(); return; }
    const g = snap.val();
    H.pin = salvo.pin;
    H.quiz = { titulo:(g.meta||{}).titulo||'', descricao:(g.meta||{}).descricao||'', perguntas:(g.perguntas || (salvo.quiz && salvo.quiz.perguntas) || []).map(normPergunta) };
    H.mostrarNoAparelho = !!(g.meta||{}).mostrarNoAparelho;
    H.jogadores = g.jogadores || {};
    H.resultados = g.resultados || {};
    const est = g.estado || {};
    H.indice = est.indice || 0;
    H.fase = est.fase || 'lobby';
    H.inicioEm = est.inicioEm || 0;
    H.fimEm = est.fimEm || 0;
    H.resumed = true;
    ouvirJogo();

    if(H.fase === 'lobby'){ H.tela = 'lobby'; }
    else if(H.fase === 'fim'){ H.tela = 'podio'; }
    else {
      H.tela = 'jogo';
      if(H.fase === 'pergunta'){
        /* volta o cronômetro de onde parou */
        if(serverNow() >= H.fimEm){ render(); revelar(); return; }
        perguntar(H.indice, true); return;
      }
      if(H.fase === 'anuncio'){ anunciar(H.indice); return; }
    }
    render();
  }catch(e){
    H.erros = ['não consegui retomar o jogo; verifique a conexão'];
    render();
  }
}

/* =========================================================
   BOOT
   ========================================================= */
(function boot(){
  const salvo = loadState(HOST_KEY);
  if(salvo && salvo.quiz && !salvo.pin){
    /* rascunho do editor guardado */
    H.quiz = { titulo:salvo.quiz.titulo||'', descricao:salvo.quiz.descricao||'', perguntas:(salvo.quiz.perguntas||[]).map(normPergunta) };
    H.mostrarNoAparelho = !!salvo.mostrarNoAparelho;
    if(H.quiz.perguntas.length && salvo.tela === 'editor'){ H.tela = 'editor'; H.resumed = true; }
  }
  render();
})();
