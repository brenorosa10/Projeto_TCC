# Diagrama de arquitetura — Astro

Documento da arquitetura do sistema na **versão atual** (implementada) e na **versão futura** (próximas entregas do TCC).

Legenda usada nos diagramas:

- **Verde** — já implementado e em uso
- **Âmbar** — modelado ou com stub; ainda não é fluxo completo
- **Azul** — serviço externo

---

## 1. Visão de contexto (atual e futura)

O Astro é um ambiente híbrido: o professor conduz sessões ao vivo (estilo Kahoot) e o aluno também estuda no próprio ritmo (quizzes e flashcards).

```mermaid
flowchart LR
  subgraph Atores
    P[Professor]
    AL[Aluno]
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
  FE -->|"HTTPS / JSON + JWT"| API
  FE -->|"WebSocket SignalR<br/>hub /hubs/live"| API
  FE -->|"redirect OAuth"| API
  API -->|"OAuth 2.0 / OpenID"| G
  API -->|"driver oficial MongoDB"| DB

  classDef atual fill:#d4edda,stroke:#2f6f4e,color:#1b4332
  classDef externo fill:#dbeafe,stroke:#1d4ed8,color:#1e3a8a
  class P,AL,FE,API,G,DB atual
  class G,DB externo
```

---

## 2. Arquitetura atual — componentes

O que está operacional hoje: autenticação Google, perfil fixo (professor/aluno) e gestão de turmas. O hub SignalR existe, mas a sessão ao vivo ainda é um stub (PIN + grupo, sem persistir atividade nem pontuar).

```mermaid
flowchart TB
  subgraph Frontend["Frontend — React + TypeScript"]
    LP[LandingPage<br/>escolha de papel]
    CB[AuthCallbackPage]
    AUTH[AuthProvider<br/>JWT no localStorage]
    APIJS["api.ts<br/>Bearer JWT"]
    PROF["Rotas professor<br/>dashboard, turmas, detalhe"]
    ALU["Rotas aluno<br/>dashboard, entrar, turmas"]
    LIVEP["live-page / live-join<br/>stub SignalR"]
    STUB["analytics / estudar<br/>telas placeholder"]
  end

  subgraph Backend["Backend — Astro.Api"]
    AC[AuthController<br/>/api/auth/google]
    PC[ProfilesController<br/>/api/profiles]
    CC[ClassesController<br/>/api/classes]
    HC[HealthController]
    JWT[JwtTokenService]
    CUS[CurrentUserService]
    CODE[ClassCodeGenerator]
    HUB[LiveSessionHub<br/>Join / Advance / Submit]
    MONGO[MongoDbContext]
  end

  subgraph Atlas["MongoDB Atlas"]
    COL1[("profiles")]
    COL2[("classes<br/>enrollments embutidos")]
    COLX[("activities, liveSessions,<br/>answerAttempts, reviewProgress<br/>coleções prontas, sem API")]
  end

  GGL[Google OAuth]

  LP --> AUTH
  AUTH --> CB
  AUTH --> APIJS
  PROF --> APIJS
  ALU --> APIJS
  LIVEP --> HUB
  APIJS --> AC
  APIJS --> PC
  APIJS --> CC
  AC --> GGL
  AC --> JWT
  AC --> MONGO
  PC --> CUS
  PC --> MONGO
  CC --> CODE
  CC --> MONGO
  MONGO --> COL1
  MONGO --> COL2
  MONGO -.-> COLX

  classDef atual fill:#d4edda,stroke:#2f6f4e,color:#1b4332
  classDef futuro fill:#fef3c7,stroke:#b45309,color:#7c2d12
  classDef externo fill:#dbeafe,stroke:#1d4ed8,color:#1e3a8a
  class LP,CB,AUTH,APIJS,PROF,ALU,AC,PC,CC,HC,JWT,CUS,CODE,MONGO,COL1,COL2 atual
  class LIVEP,STUB,HUB,COLX futuro
  class GGL externo
```

### Endpoints e telas atuais

| Camada | Implementado | Ainda stub / placeholder |
|---|---|---|
| Auth | `GET /api/auth/google`, callback, JWT | — |
| Perfil | `GET /api/profiles/me`, `POST /api/profiles/ensure` | — |
| Turmas | listar, detalhe, criar, ingressar por código | — |
| Ao vivo | hub `JoinSession`, `AdvanceQuestion`, `SubmitAnswer` | sem persistência, sem pontuação, sem ranking |
| Atividades | modelo no domínio | sem controller REST |
| Estudo / analytics | rotas de UI | sem dados reais |

---

## 3. Sequência atual — login com Google

```mermaid
sequenceDiagram
  actor U as Usuário
  participant FE as Frontend
  participant API as Astro.Api
  participant G as Google
  participant DB as MongoDB

  U->>FE: Entrar como professor ou aluno
  FE->>FE: sessionStorage.intendedRole
  FE->>API: GET /api/auth/google?returnUrl=...
  API->>G: Challenge OAuth 2.0
  U->>G: Consentimento da conta
  G->>API: GET /signin-google
  API->>API: Cookie externo + /api/auth/google-callback
  API->>DB: upsert profiles por googleId
  API->>API: JwtTokenService.CreateToken
  API->>FE: redirect /auth/callback#access_token
  FE->>FE: localStorage JWT
  FE->>API: POST /api/profiles/ensure { role }
  API->>DB: grava role (fixo na 1ª entrada)
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

## 5. Arquitetura futura — componentes

A stack permanece a mesma. Entram os módulos de conteúdo polimórfico, sessão ao vivo completa, estudo assíncrono (Leitner) e analytics.

```mermaid
flowchart TB
  subgraph FrontendFuturo["Frontend"]
    FEA[Auth + turmas<br/>já existentes]
    ACTUI[Editor de atividades<br/>quiz / prova / flashcards]
    LIVEUI[Sala ao vivo<br/>PIN, timer, ranking]
    STUDYUI[Estudo assíncrono<br/>quiz offline + Leitner]
    ANUI[Analytics do professor<br/>taxa de erro por item]
  end

  subgraph BackendFuturo["Backend"]
    REST1[Profiles + Classes]
    REST2[ActivitiesController]
    REST3[LiveSessionsController]
    REST4[Attempts + Review]
    REST5[AnalyticsController]
    HUB2[LiveSessionHub completo<br/>lobby, questão, gabarito, ranking]
    SCORE[Motor de pontuação<br/>acerto + velocidade]
    LEIT[Leitner caixas 1 a 5]
  end

  subgraph Dados["MongoDB Atlas — astro"]
    D1[("profiles")]
    D2[("classes")]
    D3[("activities + items")]
    D4[("liveSessions")]
    D5[("answerAttempts")]
    D6[("reviewProgress")]
  end

  FEA --> REST1
  ACTUI --> REST2
  LIVEUI --> REST3
  LIVEUI --> HUB2
  STUDYUI --> REST4
  ANUI --> REST5
  REST1 --> D1
  REST1 --> D2
  REST2 --> D3
  REST3 --> D4
  HUB2 --> SCORE
  HUB2 --> D4
  HUB2 --> D5
  REST4 --> D5
  REST4 --> LEIT
  LEIT --> D6
  REST5 --> D5
  REST5 --> D3

  classDef atual fill:#d4edda,stroke:#2f6f4e,color:#1b4332
  classDef futuro fill:#fef3c7,stroke:#b45309,color:#7c2d12
  class FEA,REST1,D1,D2 atual
  class ACTUI,LIVEUI,STUDYUI,ANUI,REST2,REST3,REST4,REST5,HUB2,SCORE,LEIT,D3,D4,D5,D6 futuro
```

### Módulos futuros (requisitos do TCC)

| Módulo | Comportamento previsto |
|---|---|
| Atividades | Professor cria quiz, prova ou flashcards; itens polimórficos (`kind`) |
| Questões | Múltipla escolha (2–5, 1 correta), V/F, tempo padrão 30 s |
| Ao vivo — quiz | PIN 6 dígitos, pontuação por acerto e velocidade, ranking e gabarito |
| Ao vivo — prova | Sem ranking/gabarito durante a aplicação; nota só por acertos |
| Estudo assíncrono | Feedback imediato; flashcards Leitner (acerto avança, erro volta à caixa 1) |
| Analytics | Índice de erros por questão; destaque se erro > 50% |

---

## 6. Sequência futura — sessão ao vivo

```mermaid
sequenceDiagram
  actor P as Professor
  actor A as Aluno
  participant FE as Frontend
  participant API as REST
  participant HUB as SignalR
  participant DB as MongoDB

  P->>API: POST /api/activities { type, items }
  API->>DB: insert activities
  P->>API: POST /api/live-sessions { activityId }
  API->>DB: insert liveSessions { pin, status: lobby }
  P->>HUB: JoinSession(pin)
  A->>HUB: JoinSession(pin)
  P->>HUB: Start / AdvanceQuestion
  HUB-->>A: QuestionAdvanced + payload
  A->>HUB: SubmitAnswer
  HUB->>API: persiste answerAttempts
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

## 7. Sequência futura — estudo assíncrono

```mermaid
sequenceDiagram
  actor A as Aluno
  participant FE as Frontend estudo
  participant API as REST
  participant DB as MongoDB

  A->>API: GET /api/classes/{id}/activities
  API->>DB: activities por classId
  alt quiz offline
    A->>API: POST /api/attempts { itemId, resposta }
    API->>DB: insert answerAttempts
    API-->>A: isCorrect + explanation
  else flashcard Leitner
    A->>API: GET /api/review/due
    API->>DB: reviewProgress nextReviewAt <= agora
    A->>API: POST /api/review { itemId, acertou }
    API->>API: caixa 1..5 ou reset para 1
    API->>DB: upsert reviewProgress
  end
```

---

## 8. Implantação atual (desenvolvimento)

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

A versão futura mantém os mesmos três blocos. O que muda é o conjunto de APIs e o uso efetivo das coleções já previstas no Atlas.
