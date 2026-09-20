/* =========================================================
   CAROTTE — firebase-config.js
   Preencha com os dados do SEU projeto:
   Firebase Console › Configurações do projeto › Seus apps › Web
   Em "databaseURL" use a URL do Realtime Database
   (Build › Realtime Database › copiar a URL no topo).
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyAPYqLlIcRRHL_YQXAAbcYcvv9p1efRtdk",
  authDomain: "carotte-c42b0.firebaseapp.com",
  projectId: "carotte-c42b0",
  storageBucket: "carotte-c42b0.firebasestorage.app",
  messagingSenderId: "837486267401",
  appId: "1:837486267401:web:3136c41f101702a8673cd8",
  measurementId: "G-T8G4LV3N8M"
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
