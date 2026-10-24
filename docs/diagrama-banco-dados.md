# Diagrama do banco de dados — Astro

O Astro usa **MongoDB Atlas** (banco `astro`), não um SGBD relacional. As “tabelas” abaixo são **coleções**. Relacionamentos são referências (`Guid`) ou documentos **embutidos**.

Legenda:

- **Verde** — coleção/campo em uso na versão atual
- **Âmbar** — previsto na versão futura (tipos e índices já existem no código)
- Losango **embutido** — vive dentro do documento pai (sem coleção própria)

---

## 1. Visão atual — coleções em uso

A API lê e grava `profiles`, `classes`, `activities`, `answerAttempts` e `reviewProgress`. Matrículas ficam **dentro** da turma (`enrollments[]`). Itens de quiz/flashcard (incluindo imagem em `BinData`) ficam **dentro** da atividade (`items[]`), no padrão documento: dados acessados juntos ficam juntos.

Limite de documento MongoDB: **16 MB**. Imagens são comprimidas no cliente e validadas no servidor.

```mermaid
erDiagram
  PROFILES ||--o{ CLASSES : "leciona (professorId)"
  CLASSES ||--|{ ENROLLMENT : "embute enrollments[]"
  PROFILES ||--o{ ENROLLMENT : "ingressa (studentId)"
  PROFILES ||--o{ ACTIVITIES : "autoria (professorId)"
  ACTIVITIES }o--o{ CLASSES : "classIds[] N turmas"
  ACTIVITIES ||--|{ ACTIVITY_ITEM : "embute items[]"
  ACTIVITY_ITEM ||--o{ QUESTION_OPTION : "embute options[]"
  PROFILES ||--o{ ANSWER_ATTEMPTS : "responde (studentId)"
  ACTIVITIES ||--o{ ANSWER_ATTEMPTS : "avalia (activityId)"
  ACTIVITY_ITEM ||--o{ ANSWER_ATTEMPTS : "itemId"
  PROFILES ||--o{ REVIEW_PROGRESS : "revisa (studentId)"
  ACTIVITIES ||--o{ REVIEW_PROGRESS : "deck (activityId)"
  ACTIVITY_ITEM ||--o{ REVIEW_PROGRESS : "itemId"

  PROFILES {
    guid _id PK "id interno Astro"
    string googleId UK "sub do Google sparse"
    string email UK "normalizado lowercase"
    string username
    string usernameNormalized UK "sparse"
    string passwordHash "conta Astro"
    string fullName
    string avatarUrl
    string role "professor | aluno"
    date createdAt
  }

  CLASSES {
    guid _id PK
    string name
    string code UK "8 chars"
    guid professorId FK
    string professorName "cópia desnormalizada"
    date createdAt
    array enrollments "embutido"
  }

  ENROLLMENT {
    guid studentId FK
    string studentName
    date joinedAt
  }

  ACTIVITIES {
    guid _id PK
    guid professorId FK
    array classIds "N turmas"
    guid classId "legado 1 turma"
    string title
    string type "quiz | flashcards"
    bool isPublic "catálogo da landing"
    guid sourceActivityId "import flashcards"
    date createdAt
    array items "embutido"
  }

  ACTIVITY_ITEM {
    guid id
    string kind "multiple_choice | flashcard"
    string prompt
    string explanation
    int timeLimitSeconds
    int position
    string front
    string back
    bin imageBytes "JPEG/PNG/WebP"
    string imageContentType
  }

  QUESTION_OPTION {
    guid id
    string text
    bool isCorrect
    int position
    string imageUrl "opcional: /api/media/{id} ou http(s)"
  }

  ANSWER_ATTEMPTS {
    guid _id PK
    guid studentId FK
    guid activityId FK
    guid itemId FK
    guid selectedOptionId
    bool isCorrect
    int responseTimeMs
    date answeredAt
  }

  REVIEW_PROGRESS {
    guid _id PK
    guid studentId FK
    guid activityId FK
    guid itemId FK
    int boxLevel "1 a 5 Leitner"
    date nextReviewAt
    date updatedAt
  }
```

```mermaid
flowchart LR
  subgraph Atual["Versão atual — o que a API usa"]
    P[("profiles")]
    C[("classes")]
    A[("activities")]
    T[("answerAttempts")]
    R[("reviewProgress")]
    E[["enrollments[]"]]
    I[["items[] + options[]<br/>+ imageBytes"]]
  end

  P -->|"1 professor : N turmas"| C
  C --> E
  P -->|"aluno referenciado"| E
  P -->|"autoria"| A
  A -->|"classIds[]"| C
  A --> I
  P -->|"tentativas de quiz"| T
  A --> T
  P -->|"Leitner"| R
  A --> R

  classDef atual fill:#d4edda,stroke:#2f6f4e,color:#1b4332
  class P,C,A,T,R,E,I atual
```

### Índices atuais

| Coleção | Índice | Motivo |
|---|---|---|
| `profiles` | `email` unique (`email_unique`) | login e cadastro sem duplicata |
| `profiles` | `usernameNormalized` unique sparse | nome de usuário da conta Astro |
| `profiles` | `googleId` unique sparse | login Google |
| `classes` | `code` unique | ingresso do aluno |
| `classes` | `professorId` | listagem do professor |
| `classes` | `enrollments.studentId` | listagem do aluno |
| `activities` | `{ professorId, createdAt desc }` | biblioteca do professor |
| `activities` | `classIds` | atividades da turma |
| `activities` | `{ classId, type }` / `{ classId, createdAt desc }` | legado de 1 turma |
| `activities` | `{ isPublic, type, createdAt desc }` | catálogo público |
| `answerAttempts` | `{ studentId, activityId }` | histórico do aluno |
| `answerAttempts` | `{ activityId, itemId }` | analytics futuro por questão |
| `reviewProgress` | `{ studentId, activityId, itemId }` unique | uma caixa Leitner por cartão |
| `reviewProgress` | `{ studentId, nextReviewAt }` | fila do dia |

---

## 2. Visão futura — o que ainda não entra no fluxo

A coleção `liveSessions` já está no domínio e tem índices. O tipo `prova` e `kind` extra (`true_false`, `short_answer`) cabem no mesmo documento polimórfico, sem migration.

```mermaid
erDiagram
  ACTIVITIES ||--o{ LIVE_SESSIONS : dispara
  CLASSES ||--o{ LIVE_SESSIONS : contexto
  LIVE_SESSIONS ||--o{ ANSWER_ATTEMPTS : "opcional ao vivo"

  LIVE_SESSIONS {
    guid _id PK
    guid activityId FK
    guid classId FK
    string pin "6 digitos"
    string status "lobby | running | ended"
    date startedAt
    date endedAt
  }

  ACTIVITIES {
    string type "quiz | prova | flashcards"
  }

  ACTIVITY_ITEM {
    string kind "multiple_choice | true_false | flashcard | short_answer"
    object extra "campos de tipos novos"
  }
```

```mermaid
flowchart TB
  subgraph Colecoes["Coleções"]
    P[("profiles")]
    C[("classes")]
    A[("activities")]
    T[("answerAttempts")]
    R[("reviewProgress")]
    L[("liveSessions")]
  end

  subgraph Embutidos["Documentos embutidos"]
    E[["enrollments[]"]]
    I[["items[]"]]
    O[["options[]"]]
  end

  P -->|"professorId"| C
  C --> E
  P -->|"studentId"| E
  P -->|"professorId"| A
  A -->|"classIds"| C
  A --> I
  I --> O
  A -->|"activityId"| L
  C -->|"classId"| L
  P -->|"studentId"| T
  A -->|"activityId"| T
  I -->|"itemId"| T
  L -->|"liveSessionId opcional"| T
  P -->|"studentId"| R
  A -->|"activityId"| R
  I -->|"itemId"| R

  classDef atual fill:#d4edda,stroke:#2f6f4e,color:#1b4332
  classDef futuro fill:#fef3c7,stroke:#b45309,color:#7c2d12
  class P,C,A,T,R,E,I,O atual
  class L futuro
```

---

## 3. Embutir versus referenciar

Decisões do modelo (padrão MongoDB: *data accessed together is stored together*):

| Relação | Cardinalidade | Estratégia | Por quê |
|---|---|---|---|
| Turma → matrículas | 1 : poucos/dezenas | **Embutir** em `classes` | Sempre listadas com a turma; turma escolar não explode o documento |
| Atividade → itens/opções/imagem | 1 : dezenas | **Embutir** em `activities` | Quiz/flashcard é lido e editado como um todo; cabe em 16 MB com compressão |
| Professor → turmas | 1 : N | **Referência** `professorId` | Turmas são listadas e abertas sozinhas |
| Atividade ↔ turmas | N : N | Array `classIds` | O mesmo quiz/deck em várias turmas |
| Aluno ↔ turma | N : N | Ref. no array `enrollments` + índice | Consulta nos dois sentidos sem coleção-junção |
| Sessão ao vivo | 1 atividade : N sessões | **Referência** | Ciclo de vida próprio (lobby → ended) — futuro |
| Tentativas de resposta | ilimitado | **Coleção própria** | Cresce sem bound; estudo off-line já grava aqui |
| Progresso Leitner | 1 por aluno+item | **Coleção própria** unique | Atualizado a cada revisão, independente do deck |

---

## 4. Polimorfismo de `activities` (atual e futuro)

Uma única coleção aceita quiz, flashcards e tipos novos, sem migration. O discriminador é `type` no documento e `kind` em cada item. Campos extras entram em `extra` (`BsonExtraElements`).

```mermaid
flowchart TB
  ACT["activities<br/>type + isPublic + classIds[] + items[]"]

  ACT --> Q["type: quiz<br/>estudo off-line e futuro ao vivo"]
  ACT --> PR["type: prova<br/>previsto"]
  ACT --> F["type: flashcards<br/>Leitner assíncrono"]
  ACT --> X["type futuro"]

  Q --> MC["kind: multiple_choice<br/>prompt, options[], timeLimitSeconds, image"]
  Q --> TF["kind: true_false<br/>previsto"]
  PR --> MC
  PR --> TF
  PR --> SA["kind: short_answer<br/>previsto"]
  F --> FC["kind: flashcard<br/>front / back / image"]
  X --> EX["kind novo + extra{}"]

  classDef atual fill:#d4edda,stroke:#2f6f4e,color:#1b4332
  classDef futuro fill:#fef3c7,stroke:#b45309,color:#7c2d12
  class ACT,Q,F,MC,FC atual
  class PR,X,TF,SA,EX futuro
```

Visibilidade:

```mermaid
flowchart LR
  ACT["activities.isPublic"]
  ACT -->|false privado| PRIV["só alunos das turmas em classIds[]"]
  ACT -->|true público| PUB["GET /api/public<br/>landing sem login"]

  classDef atual fill:#d4edda,stroke:#2f6f4e,color:#1b4332
  class ACT,PRIV,PUB atual
```

### Exemplo de documento atual — quiz público

```json
{
  "_id": "…",
  "professorId": "…",
  "classIds": ["…"],
  "title": "Sistema Solar",
  "type": "quiz",
  "isPublic": true,
  "createdAt": "2026-08-16T00:00:00Z",
  "items": [
    {
      "id": "…",
      "kind": "multiple_choice",
      "prompt": "Qual o maior planeta?",
      "explanation": "Júpiter é um gigante gasoso.",
      "timeLimitSeconds": 30,
      "position": 0,
      "imageContentType": "image/jpeg",
      "imageBytes": "<BinData>",
      "options": [
        { "id": "…", "text": "Marte", "isCorrect": false, "position": 0 },
        { "id": "…", "text": "Júpiter", "isCorrect": true, "position": 1 }
      ]
    }
  ]
}
```

### Exemplo de documento atual — flashcard privado

```json
{
  "_id": "…",
  "professorId": "…",
  "classIds": ["…"],
  "title": "Vocabulário — cap. 2",
  "type": "flashcards",
  "isPublic": false,
  "createdAt": "2026-08-16T00:00:00Z",
  "items": [
    {
      "id": "…",
      "kind": "flashcard",
      "front": "Fotossíntese",
      "back": "Conversão de luz em energia química",
      "position": 0
    }
  ]
}
```

---

## 5. Índices da sessão ao vivo (já criados, uso futuro)

| Coleção | Índice | Uso futuro |
|---|---|---|
| `liveSessions` | `pin` | aluno entra na sala |
| `liveSessions` | `activityId` | sessões de uma atividade |

---

## 6. Comparativo atual × futuro

| Coleção | Versão atual | Versão futura |
|---|---|---|
| `profiles` | Google **e** e-mail/senha/usuário; role fixo | âncora de tentativas ao vivo e analytics |
| `classes` | CRUD + matrícula embutida | contexto da sessão ao vivo (`classId`) |
| `activities` | editor quiz/flashcards, imagens, `isPublic`, N turmas | tipo prova e `kind` adicionais |
| `answerAttempts` | quiz off-line autenticado | também ao vivo; score e `liveSessionId` |
| `reviewProgress` | Leitner 1–5 por aluno/item | mesmo documento |
| `liveSessions` | só no domínio / índices | PIN, lobby, running, ended |

Não há tabelas-junção SQL. Relacionamentos N:N (aluno–turma, atividade–turma, aluno–item) usam array embutido ou coleção de fatos (`answerAttempts`, `reviewProgress`) com referências e índice composto.
