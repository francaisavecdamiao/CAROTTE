/* =========================================================
   CAROTTE — firebase-config.js
   Preencha com os dados do SEU projeto:
   Firebase Console › Configurações do projeto › Seus apps › Web
   Em "databaseURL" use a URL do Realtime Database
   (Build › Realtime Database › copiar a URL no topo).
   ========================================================= */

const firebaseConfig = {
  apiKey: "COLE_AQUI_SUA_API_KEY",
  authDomain: "SEU-PROJETO.firebaseapp.com",
  databaseURL: "https://SEU-PROJETO-default-rtdb.firebaseio.com",
  projectId: "SEU-PROJETO",
  storageBucket: "SEU-PROJETO.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000"
};

/* inicialização (SDK compat carregado por CDN nas páginas) */
let db = null;
try{
  firebase.initializeApp(firebaseConfig);
  db = firebase.database();
  watchServerOffset(db);
}catch(e){
  console.error('Falha ao iniciar o Firebase. Confira o firebase-config.js.', e);
}

/* atalhos usados pelo host e pelo participante */
const SERVER_TS = (typeof firebase !== 'undefined' && firebase.database)
  ? firebase.database.ServerValue.TIMESTAMP
  : Date.now();

function gameRef(pin, sub){
  return db.ref('games/' + pin + (sub ? '/' + sub : ''));
}
