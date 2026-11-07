# Backend — Fiscalize

API REST da plataforma de demandas urbanas **Fiscalize**, construída com **Express 5**, **TypeScript**, **Prisma ORM 7** e **PostgreSQL**.

> Este é o único guia do backend. Ele reúne o que antes estava espalhado em `README.md`, `SETUP.md` e `COMO_RODAR_O_BACK.md`.

---

## 📑 Índice

1. [Requisitos](#1-requisitos)
2. [Setup rápido (script automático)](#2-setup-rápido-script-automático)
3. [Setup manual (passo a passo)](#3-setup-manual-passo-a-passo)
4. [Variáveis de ambiente](#4-variáveis-de-ambiente)
5. [Rodar o servidor](#5-rodar-o-servidor)
6. [Explorar a API](#6-explorar-a-api)
7. [Perfis e autorização](#7-perfis-e-autorização)
8. [Banco de dados](#8-banco-de-dados)
9. [Scripts disponíveis](#9-scripts-disponíveis)
10. [Testes](#10-testes)
11. [Deploy](#11-deploy)
12. [Estrutura do projeto](#12-estrutura-do-projeto)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Requisitos

| Ferramenta | Versão | Observação |
|------------|--------|------------|
| **Node.js** | `22.14.0` | Fixada em `engines` do `package.json` |
| **npm** | 10+ | Vem com o Node.js |
| **PostgreSQL** | 14+ | Local, Docker ou serviço gerenciado |
| **Redis** | qualquer | **Opcional** — usado só como cache de métricas |

Confira o que já está instalado:

```bash
node --version   # v22.14.0
npm --version
psql --version
```

Não tem PostgreSQL local? Suba um com Docker:

```bash
docker run --name fiscalize-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=fiscalize \
  -p 5432:5432 -d postgres:16
```

---

## 2. Setup rápido (script automático)

O `setup.sh` cuida de tudo: instala dependências, cria o `.env`, cria o banco, aplica as migrações e roda o seed.

```bash
git clone https://github.com/seu-usuario/fiscalize-backend.git
cd fiscalize-backend

chmod +x setup.sh
./setup.sh
```

> **Atenção:** na primeira execução o script cria o `.env` a partir do `.env.example` e **para**, para que você preencha os valores. Edite o `.env` (veja a [seção 4](#4-variáveis-de-ambiente)) e rode `./setup.sh` novamente.

No Windows, use **Git Bash** (`bash setup.sh`). O script depende de `psql`, então ele precisa estar no `PATH`.

Terminou? Pule para [rodar o servidor](#5-rodar-o-servidor).

---

## 3. Setup manual (passo a passo)

Use este caminho se o script falhar ou se você preferir controlar cada etapa.

### 3.1. Instalar dependências

```bash
npm ci        # instalação limpa, respeitando o package-lock.json
```

> Use `npm install` em vez de `npm ci` se você acabou de alterar o `package.json`. O `npm ci` falha de propósito quando o `package-lock.json` está fora de sincronia.

### 3.2. Criar o arquivo `.env`

```bash
cp .env.example .env
```

Agora edite o `.env` — no mínimo `DATABASE_URL` e `JWT_SECRET`. Detalhes na [seção 4](#4-variáveis-de-ambiente).

### 3.3. Criar o banco de dados

```bash
psql -U postgres -c "CREATE DATABASE fiscalize;"
psql -U postgres -d fiscalize -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
```

A extensão `uuid-ossp` é necessária para a geração de UUIDs no banco.

### 3.4. Gerar o Prisma Client e aplicar as migrações

```bash
npx prisma generate      # gera o client tipado a partir do schema
npx prisma migrate deploy # aplica as migrações já versionadas
```

> `migrate deploy` apenas aplica o que existe em `prisma/migrations/`. Use `npx prisma migrate dev` só quando estiver **criando** uma migração nova durante o desenvolvimento.

### 3.5. Popular o banco (seed)

```bash
npm run seed
```

O seed cria categorias e usuários de demonstração — veja as [credenciais](#83-credenciais-criadas-pelo-seed).

---

## 4. Variáveis de ambiente

O arquivo `.env.example` é a referência completa e comentada. Resumo:

### Obrigatórias

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | String de conexão do PostgreSQL, usada pelo Prisma e pelo pool `pg`. Ex.: `postgresql://postgres:postgres@localhost:5432/fiscalize?schema=public` |
| `JWT_SECRET` | Chave usada para assinar os tokens JWT. **O servidor não inicia sem ela** — use uma string longa e aleatória em produção |
| `ALLOWED_ORIGINS` | Origens liberadas no CORS, separadas por vírgula. **Obrigatória apenas quando `NODE_ENV=production`** |

### Opcionais

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `NODE_ENV` | `development` | `development` \| `production` \| `test` |
| `PORT` | `3000` | Porta HTTP do Express (em produção a Railway define automaticamente) |
| `JWT_EXPIRATION` | `30m` | Validade curta do JWT de acesso (mantenha entre 15 e 60 minutos) |
| `REFRESH_TOKEN_EXPIRATION_DAYS` | `30` | Validade do refresh token; cada renovação revoga o token anterior |
| `OTP_EMAIL_FROM` | `GMAIL_USER` | Remetente usado no envio dos códigos MFA. Em produção não pode ser `*.local` |
| `GMAIL_USER` | — | Conta Gmail usada como remetente e autenticação SMTP |
| `GMAIL_APP_PASSWORD` | — | Senha de app do Gmail (16 caracteres). Exige 2FA ativa; não use a senha da conta |
| `REDIS_URL` | — | Cache de métricas e armazenamento compartilhado dos contadores de rate limiting |
| `RATE_LIMIT_REDIS_REQUIRED` | `false` fora de produção | Exige Redis para os contadores distribuídos de rate limiting |
| `RATE_LIMIT_GENERAL_MAX` | `100` | Requisições por janela nas rotas gerais |
| `RATE_LIMIT_AUTH_MAX` | `10` | Requisições por janela nas rotas de autenticação |
| `RATE_LIMIT_OTP_MAX` | `5` | Requisições por janela nas rotas de OTP |
| `RATE_LIMIT_DEMAND_MAX` | `10` | Requisições por janela na submissão de denúncias |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Duração da janela de rate limiting em milissegundos |
| `TRUST_PROXY` | `0` | Quantidade ou identificação dos proxies reversos confiáveis |
| `CRON_METRICS_SCHEDULE` | `0 * * * *` | Expressão cron do job de consolidação de métricas |
| `FRONTEND_URL` | `http://localhost:3001` | Origem extra liberada no CORS durante o desenvolvimento |
| `SEED_ADMIN_EMAIL` | `admin@fiscalize.gov.br` | Email do admin criado pelo seed |
| `SEED_ADMIN_PASSWORD` | `Admin@123456` | Senha do admin criado pelo seed |
| `SEED_ADMIN_NAME` | `Administrador` | Nome do admin criado pelo seed |

---

### Dashboard ETL no aplicativo

O endpoint público `GET /dashboard/etl/population` lê a tabela final
`chamados_populacao` no Neon e é consumido pela tela **Dashboard ETL** do
mobile. Configure `ETL_DATABASE_URL` com a mesma conexão usada em
`etl/.env` como `DATABASE_URL`. Essa conexão deve ser somente leitura.

O dashboard mobile oferece filtro por bairro, indicadores de chamados,
população e média por 1.000 habitantes, gráfico responsivo e atualização
manual por reload ou gesto de arrastar para baixo.

### MFA/OTP

O primeiro login em cada dispositivo exige um código de seis dígitos enviado ao
e-mail cadastrado. O código é válido por cinco minutos, pode ser usado uma vez
e possui limite de cinco tentativas. A aplicação armazena apenas hashes do
código e do desafio. As ações críticas (`password`, `export`, `delete` e
`anonymization`) usam o mesmo fluxo, mas exigem uma verificação adicional
recente.

O envio usa o SMTP do Gmail (`smtp.gmail.com:587`), gratuito e sem domínio
próprio. É preciso configurar `GMAIL_USER` e `GMAIL_APP_PASSWORD` — uma senha de
app de 16 caracteres, que exige verificação em duas etapas ativa na conta. O
remetente é o próprio Gmail (`OTP_EMAIL_FROM` vazio herda `GMAIL_USER`).

Limites do Google: 500 destinatários por dia, e o uso automatizado pode
bloquear a conta — adequado para desenvolvimento e demonstração, não para
volume de produção.

Em desenvolvimento, quando as credenciais não estão configuradas, o código é
registrado no log do backend. Em produção, a ausência das credenciais ou um
remetente inválido impede a inicialização do servidor, e uma falha do Gmail
interrompe a solicitação sem criar um desafio utilizável.

### Rate limiting e proteção contra DDoS

As rotas gerais são limitadas a 100 requisições por minuto e por IP. As rotas
de autenticação usam limite de 10 requisições por minuto; OTP usa 5; e a
submissão de denúncias usa 10. O excesso retorna HTTP 429 com headers de limite
e `Retry-After`.

Em produção, o Redis deve estar configurado para que os contadores sejam
compartilhados entre instâncias. `TRUST_PROXY` deve corresponder à topologia
real do provedor, evitando confiar cegamente em `X-Forwarded-For`.

Na suíte de testes de API, execute o backend com `NODE_ENV=test` ou
`TRUST_PROXY=1`. A suíte injeta um IP sintético diferente por cenário para
impedir que os contadores de um teste contaminem outro. Essa configuração é
exclusiva do ambiente de testes e não deve ser usada para mascarar a topologia
real em produção.

Esse controle protege a aplicação contra abuso e excesso de requisições, mas
não substitui WAF, CDN ou proteção anti-DDoS do provedor. Essas camadas externas
devem ser comprovadas separadamente por configuração, evidência do provedor e
procedimentos operacionais.

---

## 5. Rodar o servidor

```bash
npm run dev     # desenvolvimento, com auto-reload (ts-node-dev)
```

Saída esperada:

```
[Server] Running on port 3000
[Server] NODE_ENV=development
[Server] Redis: unavailable
[Server] Health check: http://localhost:3000/health
[Server] API docs (Swagger): http://localhost:3000/docs
```

> `Redis: unavailable` não é um erro — significa apenas que o cache de métricas está desligado.

Para produção:

```bash
npm run build   # prisma generate + tsc → dist/
npm start       # node dist/server.js
```

---

## 6. Explorar a API

A documentação **Swagger é a fonte da verdade** para os endpoints, parâmetros e schemas. Com o servidor rodando:

| Endpoint | Descrição |
|----------|-----------|
| `GET /docs` | Interface Swagger UI (carregada via CDN, sem autenticação) |
| `GET /docs.json` | Especificação OpenAPI 3.0 crua — importável no Postman, Insomnia ou <https://editor.swagger.io> |
| `GET /health` | Health check da aplicação e da conexão com o banco |

### Grupos de rotas montados

| Prefixo | Conteúdo |
|---------|----------|
| `/auth` | Registro, login, logout e dados do usuário autenticado |
| `/users` | Gestão de usuários |
| `/demands` | Demandas / chamados urbanos |
| `/categories` | Categorias de demanda |
| `/gestor` | Dashboard e chamados do gestor |
| `/admin` | Rotas exclusivas de administrador |
| `/metrics` | Métricas e indicadores consolidados |

### Exemplo rápido com cURL

```bash
# Login — grava o cookie httpOnly em cookies.txt
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fiscalize.gov.br","senha":"Admin@123456"}' \
  -c cookies.txt

# Requisição autenticada reaproveitando o cookie
curl http://localhost:3000/auth/me -b cookies.txt
```

> **Não versione o `cookies.txt`** — ele contém um token de sessão válido.

### Endereço estruturado dos chamados

Ao criar uma demanda (`POST /demands`), o cliente deve enviar o endereço
estruturado e as coordenadas obtidas automaticamente pelo aplicativo:

```json
{
  "title": "Buraco na via",
  "description": "Buraco grande próximo à esquina.",
  "category_id": 1,
  "cep": "51020000",
  "rua": "Rua dos Navegantes",
  "numero": null,
  "bairro": "Boa Viagem",
  "cidade": "Recife",
  "estado": "PE",
  "complemento": null,
  "latitude": -8.1264,
  "longitude": -34.9036
}
```

Regras do contrato:

- `bairro`, `cep`, `rua`, `cidade`, `estado`, `latitude` e `longitude` são
  obrigatórios na criação.
- `numero` e `complemento` são opcionais no chamado.
- `latitude` e `longitude` devem ser coordenadas válidas obtidas pelo CEP/GPS;
  não devem ser digitadas manualmente pelo usuário.
- O backend normaliza o bairro (maiúsculas e sem acentos) e mantém `endereco`
  como texto composto para compatibilidade com clientes existentes.
- O cadastro do cidadão continua exigindo `numero` e não recebe coordenadas.

Na atualização (`PUT /demands/:id`), os campos podem ser enviados
parcialmente. Se o endereço for alterado, envie também novas coordenadas para
que elas continuem correspondendo ao local do chamado. A documentação
interativa e o esquema completo estão disponíveis em `GET /docs`.

---

## 7. Perfis e autorização

A autenticação usa **JWT**. Após o login o token vai no corpo da resposta **e** em um cookie `httpOnly` chamado `token`. Envie-o de uma das duas formas:

- Cookie `token=<jwt>` (automático no navegador), ou
- Header `Authorization: Bearer <jwt>`

Os perfis são **hierárquicos** — um perfil superior acessa tudo do inferior:

```
Admin    → rotas de Admin + Gestor + Cidadão
Gestor   → rotas de Gestor + Cidadão
Cidadão  → apenas rotas de Cidadão
```

| Perfil | Responsabilidade |
|--------|------------------|
| **Admin** | Gerenciar o sistema, usuários e relatórios globais |
| **Gestor** | Gerenciar os chamados atribuídos à sua unidade |
| **Cidadão** | Abrir e acompanhar os próprios chamados |

### Respostas de erro

Todo erro segue o mesmo formato (`src/middlewares/errorMiddleware.ts`):

```json
{
  "error": "Mensagem de erro",
  "statusCode": 400,
  "timestamp": "2026-06-03T12:00:00.000Z"
}
```

| Código | Significado |
|--------|-------------|
| `400` | Requisição inválida (validação, dados faltando) |
| `401` | Não autenticado ou token expirado |
| `403` | Autenticado, mas sem permissão para o recurso |
| `404` | Recurso não encontrado |
| `409` | Conflito (ex.: email já cadastrado) |
| `500` | Erro interno do servidor |

---

## 8. Banco de dados

### 8.1. Configuração

O Prisma lê a conexão de `DATABASE_URL` através do `prisma.config.ts`. O schema fica em `prisma/schema.prisma` e as migrações versionadas em `prisma/migrations/`.

### 8.2. Comandos do dia a dia

```bash
npx prisma studio         # interface gráfica em http://localhost:5555
npx prisma migrate dev    # cria e aplica uma nova migração
npx prisma migrate deploy # aplica migrações existentes (usado em produção)
npx prisma generate       # regenera o client após mudar o schema
```

### 8.3. Credenciais criadas pelo seed

O seed cria usuários de demonstração para cada perfil:

| Perfil | Email | Senha |
|--------|-------|-------|
| Admin | `admin@fiscalize.gov.br` (ou `SEED_ADMIN_EMAIL`) | `Admin@123456` (ou `SEED_ADMIN_PASSWORD`) |
| Gestor | ver saída do seed | `Gestor@123456` |
| Cidadão | ver saída do seed | `Cidadao@123456` |

> ⚠️ Essas são credenciais de **desenvolvimento**. Sempre defina `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` antes de rodar o seed em produção.

---

## 9. Scripts disponíveis

| Script | O que faz |
|--------|-----------|
| `npm run dev` | Sobe o servidor com auto-reload |
| `npm run build` | `prisma generate` + `tsc` → `dist/` |
| `npm start` | Executa a build (`node dist/server.js`) |
| `npm run migrate:deploy` | Aplica as migrações pendentes |
| `npm run seed` | Popula o banco com dados iniciais |
| `npm run prisma:generate` | Regenera o Prisma Client |
| `npm run prisma:migrate` | Cria/aplica migração em desenvolvimento |
| `npm test` | Roda o Jest — veja a ressalva abaixo |
| `npm run test:watch` | Jest em modo watch |

---

## 10. Testes

O Jest está configurado (`jest.config.ts` + `ts-jest`), mas **ainda não há arquivos de teste neste branch** — `npm test` termina com "no tests found". A suíte de testes ainda precisa ser escrita ou trazida de um branch de feature.

---

## 11. Deploy

O deploy é feito na **Railway** via `railway.toml`, usando o builder `nixpacks`:

```toml
[build]
buildCommand = "npm install && npm run build"

[deploy]
startCommand = "npm run migrate:deploy && npm run seed && npm run start"
```

Na plataforma, configure no mínimo `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS` e `NODE_ENV=production`. O `PORT` é injetado automaticamente.

---

## 12. Estrutura do projeto

```
fiscalize-backend/
├── src/
│   ├── config/         # env, cors, prisma, redis, cron, health, swagger
│   ├── controllers/    # camada HTTP (request → response)
│   ├── middlewares/    # autenticação, autorização, tratamento de erros
│   ├── repositories/   # acesso a dados
│   ├── routes/         # definição e montagem das rotas
│   ├── services/       # regras de negócio
│   ├── utils/          # utilitários (cache, etc.)
│   └── server.ts       # ponto de entrada
├── prisma/
│   ├── schema.prisma   # modelo de dados
│   ├── migrations/     # migrações versionadas
│   └── seed.ts         # dados iniciais
├── .env.example        # referência das variáveis de ambiente
├── jest.config.ts      # configuração de testes
├── prisma.config.ts    # configuração do Prisma CLI
├── railway.toml        # configuração de deploy
├── setup.sh            # setup automatizado
└── tsconfig.json
```

---

## 13. Troubleshooting

**`Missing required environment variable: JWT_SECRET`**
O `.env` não existe ou está sem `JWT_SECRET`. Rode `cp .env.example .env` e preencha o valor.

**`Missing required environment variable: ALLOWED_ORIGINS`**
Acontece só com `NODE_ENV=production`. Defina as origens do frontend separadas por vírgula.

**`Cannot find module '@prisma/client'`**
```bash
npx prisma generate
```

**`ECONNREFUSED ... 5432`**
O PostgreSQL não está rodando ou a `DATABASE_URL` aponta para o lugar errado.
```bash
# macOS (Homebrew)
brew services start postgresql@16
# Linux
sudo systemctl start postgresql
# Docker
docker start fiscalize-postgres
```

**`database "fiscalize" does not exist`**
```bash
psql -U postgres -c "CREATE DATABASE fiscalize;"
```

**`npm ci` falha com `EUSAGE ... not in sync`**
O `package-lock.json` está defasado em relação ao `package.json`. Rode `npm install` e comite o lockfile atualizado.

**Porta 3000 já em uso** — o servidor detecta isso e encerra com uma mensagem clara.
```bash
PORT=3001 npm run dev     # usar outra porta
lsof -i :3000             # ou descobrir e encerrar o processo
```

**`permission denied: ./setup.sh`**
```bash
chmod +x setup.sh
```

---

## 🤝 Contribuindo

1. Crie uma branch (`git checkout -b feature/MinhaFeature`)
2. Commit as mudanças (`git commit -m "feat: minha feature"`)
3. Push (`git push origin feature/MinhaFeature`)
4. Abra um Pull Request

## 📄 Licença

ISC
