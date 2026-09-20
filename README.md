# CAROTTE — quiz gamificado ao vivo

Plataforma de quiz ao vivo para escolas, treinamentos e eventos. O apresentador
mostra as perguntas na tela compartilhada; os participantes respondem no celular,
tablet ou computador. Visual da mesma família do **Galolingo**.

HTML, CSS e JavaScript puros. Tempo real no Firebase Realtime Database.

## Arquivos

```
index.html            entrada do participante (PIN)
player.html           lobby, jogo e resultado do participante
host.html             criar/importar, lobby, jogo, pódio, relatório
styles.css            tokens e componentes compartilhados
app.js                utilitários, sons, personagens, persistência
host.js               fases, pontuação, ranking, relatório Excel
player.js             PIN, carrossel, envio da resposta
firebase-config.js    credenciais e inicialização (preencher)
database.rules.json   regras do Realtime Database
```

Pastas de mídia esperadas (caminhos relativos, como no Galolingo):

```
fonts/     Feather-Bold.ttf · Nunito-Regular.ttf
images/    LOGO.png · LOGO-JEUGALO.png · logo_fad.png · galo.png · happygalo.png · sadgalo.png
sounds/    click.mp3 ok.mp3 falha.mp3 modo.mp3 questionsound.mp3 alert.mp3
           level.mp3 levelfail.mp3 losing.mp3 win01.mp3 game-backsound.mp3
personagens/               22 retratos .jpeg
personagens-com-galos/GALO1/   22 imagens .png
```

Toda `<img>` usa `onerror="this.style.display='none'"`, então a interface continua
funcionando mesmo antes de as imagens entrarem no repositório.

## Como publicar (GitHub + Vercel)

1. **Firebase** — crie um projeto no [console](https://console.firebase.google.com),
   vá em *Build › Realtime Database › Criar banco de dados* (modo bloqueado) e copie a
   URL do banco. Em *Configurações do projeto › Seus apps › Web*, registre um app e
   copie o objeto de configuração para o `firebase-config.js`.
2. **Regras** — em *Realtime Database › Regras*, cole o conteúdo de
   `database.rules.json` e publique.
3. **GitHub** — crie o repositório e suba os arquivos na raiz
   (`git init`, `git add .`, `git commit -m "carotte"`, `git push`).
4. **Vercel** — *Add New › Project*, importe o repositório, framework **Other**,
   build command vazio, output directory `.` e *Deploy*. O endereço final
   (`https://seu-projeto.vercel.app`) é o que entra no QR code automaticamente.
5. **Domínio autorizado** — em *Firebase › Authentication › Settings › Domínios
   autorizados*, acrescente o domínio da Vercel (necessário se você ativar login
   depois; o Realtime Database em si já funciona).

O apresentador abre `/host.html`; os participantes abrem a raiz `/` e digitam o PIN,
ou apontam a câmera para o QR code (`/player.html?pin=123456`).

## Regras do Realtime Database

As regras de `database.rules.json` fazem o essencial para um jogo sem contas:

- qualquer pessoa com o PIN lê o jogo (é assim que o participante acompanha o estado);
- cada participante grava a própria resposta **uma única vez**
  (`".write": "!data.exists()"`), então não dá para trocar de opção depois;
- a resposta precisa ser um número de 0 a 3;
- o apelido precisa ter de 2 a 18 caracteres e os pontos nunca ficam negativos;
- o nó `respostas` só pode ser apagado inteiro (limpeza feita pelo host).

**Limite conhecido:** sem autenticação, alguém com o console do navegador aberto
consegue ler `games/{pin}/perguntas`, onde fica o campo `correta`. Para uma turma
comum isso não é problema; se quiser fechar, ative *Authentication › Anônimo*,
grave o `uid` do host em `meta/hostUid` e troque as regras de `perguntas` para
`".read": "auth.uid === data.parent().child('meta/hostUid').val()"`. O host já
guarda o quiz no `localStorage`, então continua funcionando após um F5.

Jogos antigos ficam no banco. Vale apagar de tempos em tempos (o botão **novo jogo**
já limpa o jogo atual) ou criar uma rotina que remova `games` com `meta/criadoEm`
antigo.

## Pontuação

| modo | como conta |
| --- | --- |
| única | acertou: 1000 |
| dupla | acertou: 2000 |
| veloz | 1º acerto 2000, depois −200 por posição, piso de 1000 |
| arriscada | acertou: +1500 · errou: −200 (o total nunca fica abaixo de 0) |

Sem resposta vale 0. A ordem dos acertos usa `ServerValue.TIMESTAMP` e o
`.info/serverTimeOffset`, então aparelhos com relógio adiantado não levam vantagem.
Quem calcula é sempre o host.

## Formato do JSON de perguntas

```json
{
  "titulo": "Les légumes",
  "descricao": "opcional",
  "perguntas": [
    {
      "enunciado": "Comment dit-on « cenoura » en français ?",
      "opcoes": ["la carotte", "le chou", "la laitue", "le maïs"],
      "correta": 0,
      "tempo": 20,
      "modo": "unica"
    }
  ]
}
```

`correta` vai de 0 a 3, `tempo` é 20, 30, 40 ou 60 e `modo` é
`unica`, `dupla`, `veloz` ou `arriscada`. Campos ausentes viram 20 e `unica`.
O editor do host valida o arquivo, permite reordenar e devolve o JSON editado
pelo botão **baixar json**.
