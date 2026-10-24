# Astro

Ambiente virtual de aprendizagem híbrido: gamificação em tempo real (estilo Kahoot) + estudo assíncrono personalizado.

Stack:

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** ASP.NET Core 8 + SignalR
- **Dados:** MongoDB Atlas (documentos polimórficos para quizzes, flashcards e novos tipos)
- **Auth:** Google OAuth no ASP.NET Core (JWT próprio)

Coleções: `profiles`, `classes` (matrículas embutidas), `activities` (itens polimórficos por `type`/`kind`), `liveSessions`, `answerAttempts` e `reviewProgress`. Novos formatos de questão entram como documentos com campos extras, sem migration SQL.

No Google Cloud Console, crie um cliente OAuth **Web** e coloque `ClientId`/`ClientSecret` em `backend/appsettings.Development.json`. URI de redirecionamento: `http://localhost:5080/signin-google`.

## Deploy na VPS (junto com o ScoreHistory)

O nginx de borda fica num diretório próprio (`~/proxy`), não dentro do Astro nem do ScoreHistory. Ele escuta 80/443, emite HTTPS (Let’s Encrypt) e encaminha cada domínio ao container certo na rede Docker `proxy`.

1. DNS: `astroarq.online` e `scorehistory.tech` → IP da VPS (sem AAAA de parking).
2. Google OAuth: origem e redirect `https://astroarq.online` e `https://astroarq.online/signin-google`.
3. Uma vez na VPS: `docker network create proxy`
4. Copie `deploy/proxy/` para `~/proxy`, preencha `CERTBOT_EMAIL` e rode `./obter-certs.sh`.
5. Se ainda existir Caddy (ou outro processo) nas portas 80/443, pare-o. Os dois frontends precisam estar na rede `proxy`.
6. Neste repositório: copie `.env.example` para `.env`, preencha Mongo/Google/JWT e `Auth__FrontendUrl` / `Cors__Origins` com `https://astroarq.online`.
7. `./scripts/deploy.sh` (ou `docker compose up -d --build --remove-orphans`)

O nginx de borda encaminha o domínio do Astro para o container `astro-frontend`. O nginx interno do container encaminha `/api`, `/hubs` e `/signin-google` para a API. Imagens enviadas nas alternativas de quiz passam por `POST /api/media` e são servidas em `/api/media/{id}`, então o proxy atual já cobre o upload (limite de corpo 21 MB). Os arquivos ficam no volume Docker `backend-media` (`/data/media` no container). O `docker compose up` cria o volume; ele sobrevive a rebuild. Não rode `docker compose down -v`, senão as imagens enviadas são apagadas. O endereço da imagem (upload ou link http/https) fica no documento da questão no MongoDB.

## Requisitos

Requisitos principais do Astro, no recorte usado na escrita do TCC. O perfil é escolhido na primeira entrada e permanece fixo.

### Requisitos funcionais

| Código | Descrição | Perfil |
| --- | --- | --- |
| RF01 | Autenticar-se com conta própria ou Google e manter o perfil definido na primeira entrada. | Aluno e professor |
| RF02 | Criar turmas identificadas por um código de ingresso. | Professor |
| RF03 | Ingressar em uma turma informando o código. | Aluno |
| RF04 | Elaborar quizzes, provas e flashcards e vinculá-los às turmas. | Professor |
| RF05 | Aplicar quiz ou prova ao vivo, com PIN, avanço das questões, ranking no quiz e gabarito oculto na prova. | Professor |
| RF06 | Entrar na sessão ao vivo pelo PIN e responder às questões. | Aluno |
| RF07 | Estudar quizzes no próprio ritmo, com feedback após cada resposta. | Aluno |
| RF08 | Revisar flashcards com repetição espaçada (Leitner). | Aluno |
| RF09 | Acompanhar acertos e erros por questão, com destaque para taxa de erro acima de 50%. | Professor |

### Requisitos não funcionais

| Código | Descrição | Perfil |
| --- | --- | --- |
| RNF01 | Autenticar o acesso com JWT e armazenar senha apenas como hash. | Aluno e professor |
| RNF02 | Restringir cada função ao perfil autorizado. | Aluno e professor |
| RNF03 | Atualizar a sessão ao vivo em tempo real. | Aluno e professor |
| RNF04 | Persistir turmas, atividades, sessões e o desempenho dos alunos. | Aluno e professor |
| RNF05 | Proteger a comunicação em produção com HTTPS. | Aluno e professor |
| RNF06 | Oferecer interface web utilizável em diferentes tamanhos de tela. | Aluno e professor |

<img width="925" height="364" alt="image" src="https://github.com/user-attachments/assets/e2ee022e-d513-4c46-a344-0448f4c2a0c1" />

