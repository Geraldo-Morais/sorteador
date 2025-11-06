# Amigo Secreto (GitHub Pages + Firebase Functions)

Este projeto implementa um sorteador de Amigo Secreto com:
- Frontend estático (GitHub Pages)
- Backend (Firebase Functions + Firestore)
- Login com senha por usuário
- Regras: ninguém tira a si mesmo e cada alvo só pode ser sorteado uma única vez
- Registro de sorteio com horário (no backend)
- O frontend nunca revela mapeamentos globais; apenas o resultado do usuário logado

## Participantes (exemplo)
- GERALDO
- BEATRIZ
- BIANCA
- VINICIUS BIA
- VINICIUS RIAN
- RIAN

Você pode ajustar a lista em `functions/src/config/participants.ts`.

## Visão geral
- O backend gera (na primeira execução) um derangement da lista de participantes (permutação sem pontos fixos), de modo que ninguém tira a si mesmo.
- Cada usuário faz login com `nome` + `senha`. Depois, acessa a página de sorteio para "tirar" seu amigo secreto.
- O backend registra horário, ip aproximado (se disponível via cabeçalhos) e garante idempotência: se o usuário já tirou alguém, retorna sempre o mesmo resultado.
- O backend impede que o mesmo alvo seja retornado para dois usuários.

## Requisitos
- Conta Firebase (Spark/free é suficiente)
- Node 18+
- GitHub para publicar o frontend via GitHub Pages

## Setup Backend (Firebase)
1. Instale Firebase CLI:
   ```bash
   npm i -g firebase-tools
   ```
2. Login na CLI:
   ```bash
   firebase login
   ```
3. Inicializar (se quiser revisar): já deixamos a estrutura pronta. Apenas crie um projeto no console do Firebase e anote o ID.
4. No diretório `functions`:
   - Copie `.env.example` para `.env` e preencha as variáveis:
     - `JWT_SECRET`: uma string aleatória longa
     - `USERS_JSON`: JSON com { "USUARIO": "SENHA" } para cada participante
       Exemplo:
       ```json
       {
         "GERALDO": "senha1",
         "BEATRIZ": "senha2",
         "BIANCA": "senha3",
         "VINICIUS BIA": "senha4",
         "VINICIUS RIAN": "senha5",
         "RIAN": "senha6"
       }
       ```
5. Instale dependências e faça deploy:
   ```bash
   cd functions
   npm install
   firebase use <SEU_PROJECT_ID>
   firebase deploy --only functions,firestore:indexes
   ```

Isso criará endpoints HTTPS como:
- POST /login
- GET /me
- POST /draw
- GET /status (somente contagem agregada, sem revelar pares)

A URL base aparece após o deploy (ex.: `https://<region>-<project>.cloudfunctions.net/api`).

### Firestore
- Será criada a coleção `secretsanta/config` para guardar o derangement e estado.
- Será criada a coleção `secretsanta/assignments` para guardar o que cada usuário tirou e metadados (timestamp, ip, user-agent).

## Setup Frontend (GitHub Pages)
1. Faça fork/clone deste repositório no GitHub.
2. Edite `public/js/config.js` e defina `API_BASE_URL` com a URL do backend.
3. Habilite GitHub Pages para a branch `main` apontando para a pasta `public/` (ou use uma branch `gh-pages` com o conteúdo de `public`).

Após publicar:
- Página de login: `https://<seu-usuario>.github.io/<repo>/`
- Página de sorteio: `https://<seu-usuario>.github.io/<repo>/draw.html`

## Fluxo de Uso
1. Você distribui a cada participante seu `nome` e `senha` definidos em `USERS_JSON`.
2. Cada um acessa a página, faz login e vai para `draw.html`.
3. Clica em "Fazer meu sorteio"; o backend registra e retorna o resultado apenas para o usuário logado.
4. Se tentar novamente, recebe o mesmo resultado (idempotência). Se tentar ver os outros, não consegue.

## Teste Simulado
- Você pode usar o modo de simulação local dos endpoints chamando-os com curl ou via a UI.
- No `draw.html`, há um bloco de estado mostrando se você já realizou o sorteio e quando.

## Privacidade/Admin
- O frontend nunca exibe o mapa completo.
- O backend guarda os dados necessários (resultado e horário). O administrador, tecnicamente, pode ver pelo Firestore (como em qualquer backend), mas não publicamos nenhuma página admin.

## Ajustes
- Estilos em `public/css/styles.css`.
- IDs e classes no HTML prontos para ajustes.
- Lista de participantes em `functions/src/config/participants.ts`.

## Segurança
- Senhas trafegam via HTTPS para o backend. O backend emite um JWT curto (1 dia) guardado no `localStorage`.
- Não exponha `USERS_JSON` no frontend.

## Licença
MIT

