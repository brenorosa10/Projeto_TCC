# Diagrama do banco de dados — Astro

O Astro usa **MongoDB Atlas** (banco `astro`), não um SGBD relacional. As “tabelas” abaixo são **coleções**. Relacionamentos são referências (`Guid`) ou documentos **embutidos**.

Legenda:

- **Verde** — coleção/campo em uso na versão atual
- **Âmbar** — previsto na versão futura (tipos e índices já existem no código)
- Losango **embutido** — vive dentro do documento pai (sem coleção própria)

---

## 1. Visão atual — coleções em uso

Hoje a API só lê e grava `profiles` e `classes`. Matrículas ficam **dentro** da turma (`enrollments[]`), no padrão documento: dados acessados juntos ficam juntos.

```mermaid
erDiagram
  PROFILES ||--o{ CLASSES : "leciona (professorId)"
  CLASSES ||--|{ ENROLLMENT : "embute enrollments[]"
  PROFILES ||--o{ ENROLLMENT : "ingressa (studentId)"

  PROFILES {
    guid _id PK "id interno Astro"
    string googleId UK "sub do Google"
    string email
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
```

```mermaid
flowchart LR
  subgraph Atual["Versão atual — o que a API usa"]
    P[("profiles")]
    C[("classes")]
    E[["enrollments[]<br/>embutido em classes"]]
    P -->|"1 professor : N turmas<br/>professorId"| C
    C -->|"1 turma : N alunos<br/>array limitado à turma"| E
    P -->|"aluno referenciado"| E
  end

  classDef atual fill:#d4edda,stroke:#2f6f4e,color:#1b4332
  class P,C,E atual
```

### Índices atuais

| Coleção | Índice | Motivo |
|---|---|---|
| `profiles` | `email` | busca / consistência |
| `profiles` | `googleId` unique sparse | login Google |
| `classes` | `code` unique | ingresso do aluno |
| `classes` | `professorId` | listagem do professor |
| `classes` | `enrollments.studentId` | listagem do aluno |

---

## 2. Visão futura — modelo completo

As coleções `activities`, `liveSessions`, `answerAttempts` e `reviewProgress` já estão declaradas em `MongoDbContext` e no domínio. A API REST correspondente ainda não existe.

```mermaid
erDiagram
  PROFILES ||--o{ CLASSES : leciona
  CLASSES ||--|{ ENROLLMENT : embute
  PROFILES ||--o{ ENROLLMENT : matricula
  CLASSES ||--o{ ACTIVITIES : contem
  ACTIVITIES ||--|{ ACTIVITY_ITEM : embute
  ACTIVITY_ITEM ||--o{ QUESTION_OPTION : embute
  ACTIVITIES ||--o{ LIVE_SESSIONS : dispara
  CLASSES ||--o{ LIVE_SESSIONS : contexto
  PROFILES ||--o{ ANSWER_ATTEMPTS : responde
  ACTIVITIES ||--o{ ANSWER_ATTEMPTS : avalia
  ACTIVITY_ITEM ||--o{ ANSWER_ATTEMPTS : item
  LIVE_SESSIONS ||--o{ ANSWER_ATTEMPTS : "opcional ao vivo"
  PROFILES ||--o{ REVIEW_PROGRESS : revisa
  ACTIVITIES ||--o{ REVIEW_PROGRESS : deck
  ACTIVITY_ITEM ||--o{ REVIEW_PROGRESS : cartao

  PROFILES {
    guid _id PK
    string googleId UK
    string email
    string fullName
    string avatarUrl
    string role
    date createdAt
  }

  CLASSES {
    guid _id PK
    string name
    string code UK
    guid professorId FK
    string professorName
    date createdAt
  }

  ENROLLMENT {
    guid studentId FK
    string studentName
    date joinedAt
  }

  ACTIVITIES {
    guid _id PK
    guid classId FK
    string title
    string type "quiz | prova | flashcards"
    string mode "live | async"
    date createdAt
    object extra "campos de tipos novos"
  }

  ACTIVITY_ITEM {
    guid id
    string kind "multiple_choice | true_false | flashcard | short_answer"
    string prompt
    string explanation
    int timeLimitSeconds
    int position
    string front
    string back
    object extra
  }

  QUESTION_OPTION {
    guid id
    string text
    bool isCorrect
    int position
  }

  LIVE_SESSIONS {
    guid _id PK
    guid activityId FK
    guid classId FK
    string pin "6 digitos"
    string status "lobby | running | ended"
    date startedAt
    date endedAt
  }

  ANSWER_ATTEMPTS {
    guid _id PK
    guid studentId FK
    guid activityId FK
    guid itemId FK
    guid liveSessionId FK
    guid selectedOptionId
    string textAnswer
    bool isCorrect
    int responseTimeMs
    int score
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
flowchart TB
  subgraph Colecoes["Coleções futuras e atuais"]
    P[("profiles")]
    C[("classes")]
    A[("activities")]
    L[("liveSessions")]
    T[("answerAttempts")]
    R[("reviewProgress")]
  end

  subgraph Embutidos["Documentos embutidos — sem coleção"]
    E[["enrollments[]"]]
    I[["items[]"]]
    O[["options[]"]]
  end

  P -->|"professorId"| C
  C --> E
  P -->|"studentId"| E
  C -->|"classId"| A
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
  class P,C,E atual
  class A,L,T,R,I,O futuro
```

---

## 3. Embutir versus referenciar

Decisões do modelo (padrão MongoDB: *data accessed together is stored together*):

| Relação | Cardinalidade | Estratégia | Por quê |
|---|---|---|---|
| Turma → matrículas | 1 : poucos/dezenas | **Embutir** em `classes` | Sempre listadas com a turma; turma escolar não explode o documento |
| Atividade → itens/opções | 1 : dezenas | **Embutir** em `activities` | Quiz/prova/flashcard é lido e editado como um todo; cabe em 16 MB |
| Professor → turmas | 1 : N | **Referência** `professorId` | Turmas são listadas e abertas sozinhas |
| Aluno ↔ turma | N : N | Ref. no array `enrollments` + índice | Consulta nos dois sentidos sem coleção-junção |
| Sessão ao vivo | 1 atividade : N sessões | **Referência** | Ciclo de vida próprio (lobby → ended) |
| Tentativas de resposta | ilimitado | **Coleção própria** | Cresce sem bound; analytics agrega à parte |
| Progresso Leitner | 1 por aluno+item | **Coleção própria** unique | Atualizado a cada revisão, independente do deck |

---

## 4. Polimorfismo de `activities` (versão futura)

Uma única coleção aceita quiz, prova, flashcards e tipos novos, sem migration. O discriminador é `type` no documento e `kind` em cada item. Campos extras entram em `extra` (`BsonExtraElements`).

```mermaid
flowchart TB
  ACT["activities<br/>type + mode + items[]"]

  ACT --> Q["type: quiz<br/>mode: live ou async"]
  ACT --> PR["type: prova<br/>mode: live ou async"]
  ACT --> F["type: flashcards<br/>mode: async"]
  ACT --> X["type futuro<br/>ex.: associacao, codigo"]

  Q --> MC["kind: multiple_choice<br/>prompt, options[], timeLimitSeconds"]
  Q --> TF["kind: true_false<br/>prompt, options[], explanation"]
  PR --> MC
  PR --> TF
  PR --> SA["kind: short_answer<br/>prompt + extra"]
  F --> FC["kind: flashcard<br/>front / back"]
  X --> EX["kind novo + extra{}"]

  classDef futuro fill:#fef3c7,stroke:#b45309,color:#7c2d12
  class ACT,Q,PR,F,X,MC,TF,SA,FC,EX futuro
```

### Exemplo de documento futuro — quiz

```json
{
  "_id": "…",
  "classId": "…",
  "title": "Sistema Solar",
  "type": "quiz",
  "mode": "live",
  "createdAt": "2026-08-13T00:00:00Z",
  "items": [
    {
      "id": "…",
      "kind": "multiple_choice",
      "prompt": "Qual o maior planeta?",
      "explanation": "Júpiter é um gigante gasoso.",
      "timeLimitSeconds": 30,
      "position": 0,
      "options": [
        { "id": "…", "text": "Marte", "isCorrect": false, "position": 0 },
        { "id": "…", "text": "Júpiter", "isCorrect": true, "position": 1 }
      ]
    }
  ]
}
```

### Exemplo de documento futuro — flashcard

```json
{
  "_id": "…",
  "classId": "…",
  "title": "Vocabulário — cap. 2",
  "type": "flashcards",
  "mode": "async",
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

## 5. Índices previstos (já criados na subida da API)

| Coleção | Índice | Uso futuro |
|---|---|---|
| `activities` | `{ classId, type }` | listar quizzes/provas/flashcards da turma |
| `activities` | `{ classId, createdAt desc }` | linha do tempo da turma |
| `liveSessions` | `pin` | aluno entra na sala |
| `liveSessions` | `activityId` | sessões de uma atividade |
| `answerAttempts` | `{ studentId, activityId }` | histórico do aluno |
| `answerAttempts` | `{ activityId, itemId }` | analytics por questão |
| `reviewProgress` | `{ studentId, activityId, itemId }` unique | uma caixa Leitner por cartão |
| `reviewProgress` | `{ studentId, nextReviewAt }` | fila do dia |

---

## 6. Comparativo atual × futuro

| Coleção | Versão atual | Versão futura |
|---|---|---|
| `profiles` | login Google + role fixo | mesmo documento; vira âncora de tentativas e Leitner |
| `classes` | CRUD + matrícula embutida | ganha lista de `activities` por `classId` |
| `activities` | só no domínio / índices | editor do professor; itens polimórficos |
| `liveSessions` | só no domínio / índices | PIN, lobby, running, ended |
| `answerAttempts` | só no domínio / índices | ao vivo e assíncrono; score e tempo |
| `reviewProgress` | só no domínio / índices | Leitner 1–5 por aluno/item |

Não há tabelas-junção SQL. Relacionamentos N:N (aluno–turma, aluno–item) usam array embutido ou coleção de fatos (`answerAttempts`, `reviewProgress`) com referências e índice composto.
