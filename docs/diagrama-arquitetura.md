# Diagrama de arquitetura — Astro

Documento da arquitetura do sistema na **versão atual** (implementada) e na **versão futura** (próximas entregas do TCC).

Legenda usada nos diagramas:

- **Verde** — já implementado e em uso
- **Âmbar** — modelado ou com stub; ainda não é fluxo completo
- **Azul** — serviço externo

---

## 1. Visão de contexto (atual e futura)

O Astro é um ambiente híbrido: o professor conduz sessões ao vivo (estilo Kahoot) e o aluno também estuda no próprio ritmo (quizzes e flashcards). Visitantes sem conta podem estudar conteúdo **público** na página inicial.

```mermaid
flowchart LR
  subgraph Atores
    P[Professor]
    AL[Aluno]
    VIS[Visitante<br/>sem login]
  end

  subgraph Astro["Astro — aplicação"]
    FE["Frontend React + Vite<br/>localhost:5173"]
    API["Backend ASP.NET Core 8<br/>REST + SignalR<br/>localhost:5080"]
  end

  subgraph Externos
    G["Google Identity<br/>OAuth 2.0"]
    DB[("MongoDB Atlas<br/>cluster ClusterTCC<br/>database astro")]
  end

  P --> FE
  AL --> FE
  VIS -->|"estudo público"| FE
  FE -->|"HTTPS / JSON + JWT"| API
  FE -->|"WebSocket SignalR<br/>hub /hubs/live"| API
  FE -->|"redirect OAuth"| API
  API -->|"OAuth 2.0 / OpenID"| G
  API -->|"driver oficial MongoDB"| DB

  classDef atual fill:#d4edda,stroke:#2f6f4e,color:#1b4332
  classDef externo fill:#dbeafe,stroke:#1d4ed8,color:#1e3a8a
  class P,AL,VIS,FE,API atual
  class G,DB externo
```

---

## 2. Arquitetura atual — componentes

Operacional hoje: login Google **ou** conta Astro (e-mail, senha e nome de usuário), turmas, biblioteca de quizzes/flashcards (CRUD, imagens comprimidas, público/privado), estudo off-line autenticado e estudo público anônimo. O hub SignalR e o analytics ainda são stubs.

```mermaid
flowchart TB
  subgraph Frontend["Frontend — React + TypeScript"]
    LP[LandingPage<br/>login + catálogo público]
    CB[AuthCallbackPage]
    AUTH[AuthProvider<br/>JWT no localStorage]
    APIJS["api.ts<br/>Bearer JWT"]
    PROF["Rotas professor<br/>turmas, atividades, editor"]
    ALU["Rotas aluno<br/>turmas, estudar"]
    EXP["Rotas /explorar<br/>estudo sem login"]
    LIVEP["live-page / live-join<br/>stub SignalR"]
    ANUI[analytics<br/>placeholder]
  end

  subgraph Backend["Backend — Astro.Api"]
    AC["AuthController<br/>Google + register/login"]
    PC[ProfilesController]
    CC[ClassesController]
    ACT[ActivitiesController]
    STU[StudyController]
    PUB[PublicController]
    HC[HealthController]
    JWT[JwtTokenService]
    HASH[PasswordHashingService]
    CUS[CurrentUserService]
    CODE[ClassCodeGenerator]
    IMG[ActivityImage]
    LEIT[LeitnerScheduler]
    HUB[LiveSessionHub<br/>Join / Advance / Submit]
    MONGO[MongoDbContext]
  end

  subgraph Atlas["MongoDB Atlas"]
    COL1[("profiles")]
    COL2[("classes<br/>enrollments embutidos")]
    COL3[("activities<br/>items + imagens BinData")]
    COL4[("answerAttempts")]
    COL5[("reviewProgress")]
    COLX[("liveSessions<br/>índices prontos, sem REST")]
  end

  GGL[Google OAuth]

  LP --> AUTH
  LP --> PUB
  AUTH --> CB
  AUTH --> APIJS
  PROF --> APIJS
  ALU --> APIJS
  EXP --> PUB
  LIVEP --> HUB
  APIJS --> AC
  APIJS --> PC
  APIJS --> CC
  APIJS --> ACT
  APIJS --> STU
  APIJS --> PUB
  AC --> GGL
  AC --> JWT
  AC --> HASH
  AC --> MONGO
  PC --> CUS
  PC --> MONGO
  CC --> CODE
  CC --> MONGO
  ACT --> IMG
  ACT --> MONGO
  STU --> LEIT
  STU --> MONGO
  PUB --> IMG
  PUB --> MONGO
  MONGO --> COL1
  MONGO --> COL2
  MONGO --> COL3
  MONGO --> COL4
  MONGO --> COL5
  MONGO -.-> COLX

  classDef atual fill:#d4edda,stroke:#2f6f4e,color:#1b4332
  classDef futuro fill:#fef3c7,stroke:#b45309,color:#7c2d12
  classDef externo fill:#dbeafe,stroke:#1d4ed8,color:#1e3a8a
  class LP,CB,AUTH,APIJS,PROF,ALU,EXP,AC,PC,CC,ACT,STU,PUB,HC,JWT,HASH,CUS,CODE,IMG,LEIT,MONGO,COL1,COL2,COL3,COL4,COL5 atual
  class LIVEP,ANUI,HUB,COLX futuro
  class GGL externo
```

### Endpoints e telas atuais

| Camada | Implementado | Ainda stub / placeholder |
|---|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/google`, callback, JWT | — |
| Perfil | `GET /api/profiles/me`, `POST /api/profiles/ensure` | — |
| Turmas | listar, detalhe, criar, ingressar por código | — |
| Atividades | CRUD quiz/flashcards, imagens, `isPublic`, vínculo N turmas, importar flashcards | tipo `prova` e `kind` V/F ainda não no editor |
| Estudo autenticado | `GET/POST /api/study/quizzes`, `GET/POST /api/study/flashcards` (Leitner) | — |
| Estudo público | `GET /api/public/activities`, respostas e decks anônimos | — |
| Ao vivo | hub `JoinSession`, `AdvanceQuestion`, `SubmitAnswer` | sem persistência, sem pontuação, sem ranking |
| Analytics | rota de UI | sem agregação real |

---

## 3. Sequência atual — autenticação

Duas entradas: **Google** ou **conta Astro**. O papel (professor/aluno) é escolhido na landing e fica fixo na primeira gravação do perfil.

```mermaid
sequenceDiagram
  actor U as Usuário
  participant FE as Frontend
  participant API as Astro.Api
  participant G as Google
  participant DB as MongoDB

  U->>FE: escolhe professor ou aluno
  alt Conta Astro
    U->>FE: criar conta ou entrar
    FE->>API: POST /api/auth/register ou /login
    API->>DB: e-mail/usuário únicos + passwordHash
    API->>API: JwtTokenService.CreateToken
    API-->>FE: { accessToken, profile }
    FE->>FE: localStorage JWT
  else Google
    FE->>FE: sessionStorage.intendedRole
    FE->>API: GET /api/auth/google?returnUrl=...
    API->>G: Challenge OAuth 2.0
    U->>G: Consentimento
    G->>API: /signin-google → /api/auth/google-callback
    API->>DB: upsert profiles por googleId ou e-mail
    API->>FE: redirect /auth/callback#access_token
    FE->>API: POST /api/profiles/ensure { role }
    API->>DB: grava role se ainda vazia
  end
  FE->>U: dashboard professor ou aluno
```

---

## 4. Sequência atual — turmas

```mermaid
sequenceDiagram
  actor P as Professor
  actor A as Aluno
  participant FE as Frontend
  participant API as ClassesController
  participant DB as MongoDB classes

  P->>FE: criar turma
  FE->>API: POST /api/classes { name }
  API->>API: gera código único 8 chars
  API->>DB: insert { professorId, professorName, code }
  API-->>FE: ClassResponse

  A->>FE: informar código
  FE->>API: POST /api/classes/join { code }
  API->>DB: $push enrollments { studentId, studentName }
  API-->>FE: turma + studentCount

  P->>API: GET /api/classes
  Note over API,DB: filtro professorId
  A->>API: GET /api/classes
  Note over API,DB: filtro enrollments.studentId
```

---

## 5. Sequência atual — atividades e visibilidade

```mermaid
sequenceDiagram
  actor P as Professor
  actor A as Aluno
  actor V as Visitante
  participant FE as Frontend
  participant API as REST
  participant DB as MongoDB activities

  P->>FE: criar/editar quiz ou flashcards
  FE->>FE: comprime imagens no canvas
  FE->>API: POST/PUT /api/activities { items, isPublic }
  API->>API: valida itens + tamanho BSON menor que 16 MB
  API->>DB: activities com items e imageBytes
  P->>API: PUT /api/activities/{id}/classes
  API->>DB: classIds[]

  alt Privado
    A->>API: GET /api/study/...
    Note over API,DB: só se matriculado na turma vinculada
  else Público
    V->>FE: seção Estudo público na landing
    FE->>API: GET /api/public/activities
    V->>API: GET /api/public/activities/{id}
    Note over API: gabarito só após responder; sem persistir tentativa
  end
```

---

## 6. Sequência atual — estudo assíncrono (aluno logado)

```mermaid
sequenceDiagram
  actor A as Aluno
  participant FE as Frontend estudo
  participant API as StudyController
  participant DB as MongoDB

  A->>API: GET /api/study/quizzes ou /flashcards
  API->>DB: turmas do aluno ∪ isPublic
  alt quiz off-line
    A->>API: POST /api/study/quizzes/{id}/answers
    API->>DB: insert answerAttempts
    API-->>A: isCorrect + explanation
  else flashcard Leitner
    A->>API: GET /api/study/flashcards/{id}
    API->>DB: reviewProgress nextReviewAt
    A->>API: POST /api/study/flashcards/{id}/reviews
    API->>API: caixa 1..5 ou reset para 1
    API->>DB: upsert reviewProgress
  end
```

---

## 7. Arquitetura futura — o que ainda falta

A stack permanece a mesma. Entram sessão ao vivo completa, tipo prova, analytics e pontuação em tempo real.

```mermaid
flowchart TB
  subgraph FrontendFuturo["Frontend"]
    FEA[Auth, turmas, editor,<br/>estudo — já existentes]
    LIVEUI[Sala ao vivo<br/>PIN, timer, ranking]
    ANUI[Analytics do professor<br/>taxa de erro por item]
    PROVA[Editor de prova]
  end

  subgraph BackendFuturo["Backend"]
    REST1[Controllers atuais]
    REST3[LiveSessionsController]
    REST5[AnalyticsController]
    HUB2[LiveSessionHub completo<br/>lobby, questão, gabarito, ranking]
    SCORE[Motor de pontuação<br/>acerto + velocidade]
  end

  subgraph Dados["MongoDB Atlas — astro"]
    DNOW[("profiles, classes, activities,<br/>answerAttempts, reviewProgress")]
    D4[("liveSessions")]
  end

  FEA --> REST1
  LIVEUI --> REST3
  LIVEUI --> HUB2
  ANUI --> REST5
  PROVA --> REST1
  REST1 --> DNOW
  REST3 --> D4
  HUB2 --> SCORE
  HUB2 --> D4
  HUB2 --> DNOW
  REST5 --> DNOW

  classDef atual fill:#d4edda,stroke:#2f6f4e,color:#1b4332
  classDef futuro fill:#fef3c7,stroke:#b45309,color:#7c2d12
  class FEA,REST1,DNOW atual
  class LIVEUI,ANUI,PROVA,REST3,REST5,HUB2,SCORE,D4 futuro
```

### Módulos futuros (requisitos do TCC ainda abertos)

| Módulo | Comportamento previsto |
|---|---|
| Prova | Tipo `prova`; sem ranking/gabarito durante a aplicação; nota só por acertos |
| Ao vivo — quiz | PIN 6 dígitos, pontuação por acerto e velocidade, ranking e gabarito |
| Analytics | Índice de erros por questão; destaque se erro > 50% |

---

## 8. Sequência futura — sessão ao vivo

```mermaid
sequenceDiagram
  actor P as Professor
  actor A as Aluno
  participant FE as Frontend
  participant API as REST
  participant HUB as SignalR
  participant DB as MongoDB

  P->>API: POST /api/live-sessions { activityId, classId }
  API->>DB: insert liveSessions { pin, status: lobby }
  P->>HUB: JoinSession(pin)
  A->>HUB: JoinSession(pin)
  P->>HUB: Start / AdvanceQuestion
  HUB-->>A: QuestionAdvanced + payload
  A->>HUB: SubmitAnswer
  HUB->>DB: persiste answerAttempts
  HUB->>HUB: calcula score
  alt modo quiz
    HUB-->>P: ranking parcial + gabarito
    HUB-->>A: gabarito
  else modo prova
    HUB-->>P: contagem de respostas
    Note over A: sem gabarito até o fim
  end
  P->>HUB: Encerrar
  API->>DB: liveSessions.status = ended
```

---

## 9. Implantação atual (desenvolvimento)

```mermaid
flowchart LR
  subgraph Dev["Máquina local"]
    VITE["Vite :5173"]
    KESTREL["Kestrel :5080"]
  end

  subgraph Nuvem
    GOOGLE[Google Cloud<br/>cliente OAuth Web]
    ATLAS[MongoDB Atlas<br/>clustertcc]
  end

  Browser --> VITE
  VITE --> KESTREL
  KESTREL --> GOOGLE
  KESTREL --> ATLAS
```

A versão futura mantém os mesmos três blocos. O que muda é o hub ao vivo, o analytics e o uso efetivo de `liveSessions`.
