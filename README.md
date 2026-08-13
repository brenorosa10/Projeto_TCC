# Astro

Ambiente virtual de aprendizagem híbrido: gamificação em tempo real (estilo Kahoot) + estudo assíncrono personalizado.

Stack:

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** ASP.NET Core 8 + SignalR
- **Dados:** MongoDB Atlas (documentos polimórficos para quizzes, flashcards e novos tipos)
- **Auth:** Google OAuth no ASP.NET Core (JWT próprio)

Coleções: `profiles`, `classes` (matrículas embutidas), `activities` (itens polimórficos por `type`/`kind`), `liveSessions`, `answerAttempts` e `reviewProgress`. Novos formatos de questão entram como documentos com campos extras, sem migration SQL.

No Google Cloud Console, crie um cliente OAuth **Web** e coloque `ClientId`/`ClientSecret` em `backend/appsettings.Development.json`. URI de redirecionamento: `http://localhost:5080/signin-google`.

## Funcionalidades

A plataforma combina sessões síncronas gamificadas com materiais de fixação para estudo individual. Professores criam turmas, elaboram avaliações e acompanham o desempenho; alunos entram por código, participam ao vivo e revisam no próprio ritmo.

### Perfis e autenticação

- **Professor:** cria turmas, elabora e gerencia atividades (quizzes, provas e flashcards), inicia/controla sessões ao vivo e acessa o painel analítico.
- **Aluno:** ingressa em turmas por código, participa de sessões síncronas e usa o módulo de estudo assíncrono.
- **Login obrigatório com Google (OAuth2 no ASP.NET):** o perfil (professor ou aluno) é definido na primeira entrada e permanece fixo.

### Gestão de turmas

- Código único alfanumérico de 8 caracteres por turma (ex.: `X7B9K2`).
- Ingresso do aluno somente autenticado, mediante o código da turma.
- Histórico de acertos, erros e tempo de resposta vinculado permanentemente ao perfil.

### Atividades e questões

- **Múltipla escolha:** 2 a 5 alternativas, com exatamente 1 resposta correta.
- **Verdadeiro ou falso:** questões binárias com justificativa/gabarito.
- **Flashcards:** cartões bifaces (frente: conceito/pergunta; verso: resposta/explicação).
- Tempo configurável por questão em quizzes/provas (padrão: 30 segundos).

### Sessões ao vivo (tempo real via SignalR)

- PIN de 6 dígitos para cada sala temporária (ex.: `839201`).
- Transição de tela automática (fim do tempo) ou manual (“Avançar” pelo professor).
- **Modo Quiz (gamificado):** pontuação por acerto e velocidade; ranking parcial e gabarito ao fim de cada questão.
- **Modo Prova (avaliativo):** sem ranking/gabarito durante a aplicação; pontuação apenas por acertos.

### Estudo assíncrono

- Quizzes off-line com feedback e explicação imediata após cada resposta.
- Flashcards com repetição espaçada (Leitner simplificado, caixas 1–5): acerto avança o cartão; erro retorna ao nível 1.

### Analytics do professor

- Índice de erros consolidado por questão.
- Destaque visual de questões com taxa de erro superior a 50%, para orientar revisão de conteúdo.

<img width="925" height="364" alt="image" src="https://github.com/user-attachments/assets/e2ee022e-d513-4c46-a344-0448f4c2a0c1" />

