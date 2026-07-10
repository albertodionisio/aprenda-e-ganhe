# Aprenda e Ganhe — Plataforma Completa

Este projeto foi construído com base no `DOCUMENTO DE ESPECIFICAÇÃO DA PLATAFORMA`
e no código anterior enviado (`Pratique_e_ganhe.zip`), corrigindo os bugs
encontrados e implementando o máximo de etapas possível dentro de um MVP
funcional, honesto sobre o que ainda depende de serviços externos reais.

## ✅ O que está implementado e funcional

- **Autenticação** (Etapa 4): registo, login, JWT, bcrypt, estados de conta
- **Carteira** (Etapa 9): saldo, histórico, pedido de saque com valor mínimo
- **Quiz** (Etapa 5/6): perguntas múltipla escolha e verdadeiro/falso,
  anti-repetição, anti-fraude por tempo de resposta
- **Gamificação** (Etapa 8): XP, níveis, sequência diária (streak), missões
  diárias/semanais, conquistas
- **Indicações** (Etapa 11): código único, bónus de 15% vitalício, painel
- **Painel Admin** (Etapa 13): dashboard com métricas, gestão de usuários,
  aprovação/rejeição de saques, cadastro de perguntas — protegido por
  permissão de `role` (admin/moderador/financeiro)
- **Perfil e Configurações** (Etapa 12): editar dados, trocar senha, ver
  conquistas
- **Notificações internas** (Etapa 17): tabela e endpoints (in-app; envio por
  push/e-mail real não está incluído — veja limitações)
- **Página inicial pública** (Etapa 3): landing page com "como funciona" e FAQ
- **Banco de dados** (Etapa 14): schema completo cobrindo praticamente todas
  as entidades do documento

## ⚠️ Limitações honestas (o que precisa de contas/serviços reais)

Estas partes têm a estrutura de código pronta, mas **não podem funcionar de
verdade sem você conectar um serviço externo com credenciais próprias**:

- **Pagamentos reais** (M-Pesa, e-Mola, PayPal, Stripe): os saques e as
  assinaturas Premium ficam em estado `pending` até alguém confirmar
  manualmente (ou até você integrar o SDK/API do gateway escolhido)
- **Anúncios reais** (AdSense/Adcash): existe apenas o registo de "impressão"
  no banco; não há SDK de anúncios de verdade
- **Notificações push/e-mail/SMS**: as notificações ficam guardadas no banco
  e aparecem dentro da plataforma, mas não são enviadas para fora
- **Multi-idioma**: existem arquivos `locales/pt.json` e `en.json` como
  ponto de partida, mas as telas HTML ainda têm o texto fixo em português
- **Dificuldade adaptativa dos quizzes**: o campo `difficulty_level` existe
  no banco, mas a lógica de ajustar dificuldade automaticamente conforme o
  desempenho do usuário não foi implementada

## 🐛 Bugs do código anterior que foram corrigidos

1. `WalletController.js` era uma cópia do `AuthController.js` — reescrito
2. `Quiz/index.html` era uma cópia do `Dashboard/index.html` — reescrito com
   fluxo real de pergunta → resposta → recompensa
3. Bug de SQL (aspas duplas em vez de simples em `INSERT INTO transactions`)
4. Rota `/quiz/add` sem checagem de permissão — agora exige `role` de staff
5. Cadastro de usuário não era atômico (usuário/carteira podiam ser criados
   mesmo se o resto do registo falhasse) — agora tudo roda na mesma transação
6. Página da Carteira mostrava sempre MTN, ignorando o país do usuário
7. Anti-fraude confiava no horário enviado pelo próprio navegador — agora o
   servidor regista quando a pergunta foi entregue (tabela `quiz_issued`) e
   valida o tempo de resposta com base nisso
8. Backend e frontend agora rodam como um único serviço (o Express serve os
   HTMLs também), facilitando a hospedagem em um único domínio

## Como rodar (localmente)

### Backend + Frontend juntos (um único servidor)
O `server.js` agora serve tanto a API quanto os arquivos do frontend —
não é mais preciso rodar dois serviços separados.

```bash
cd backend
npm install
cp .env.example .env
# edite o .env com os dados do seu PostgreSQL e um JWT_SECRET forte

# crie o banco de dados manualmente antes, ex:
# createdb aprenda_e_ganhe

psql -d aprenda_e_ganhe -f database/schema.sql
npm run seed      # popula categorias, perguntas de exemplo, missões, etc.
npm run dev        # ou: npm start
```

Abra `http://localhost:3000` — a página inicial já carrega direto, e todas
as chamadas de API funcionam automaticamente (o `frontend/src/services/api.js`
usa um caminho relativo `/api`, então não precisa editar nada).

### Criar um usuário administrador
Não existe tela de "criar admin" por segurança. Depois de registar uma
conta normal, promova-a manualmente no banco:
```sql
UPDATE users SET role = 'admin' WHERE email = 'seu@email.com';
```

## Como hospedar (Render, Railway ou Fly.io)

Como backend e frontend agora são um único serviço Node, o deploy é simples
e tudo fica no mesmo domínio:

1. Suba a pasta do projeto para um repositório no GitHub.
2. Crie um banco PostgreSQL gerenciado no Render/Railway (ele te dá host,
   usuário, senha e porta prontos).
3. Crie um "Web Service" apontando para a pasta `backend/`, com:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Variáveis de ambiente:** as mesmas do `.env.example` (`DB_HOST`,
     `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `JWT_SECRET`, `PORT`),
     preenchidas com os dados do banco criado no passo 2.
4. Rode o `schema.sql` no banco (o Render/Railway costuma oferecer um
   "shell"/console web para isso, ou você conecta via `psql` usando as
   credenciais fornecidas) e depois `node database/seed.js` uma vez.
5. Pronto — o serviço te dá uma URL única (ex: `aprendaeganhe.onrender.com`)
   que já serve tanto o site quanto a API. Se quiser domínio próprio, basta
   apontar o DNS dele para essa mesma URL.

## Estrutura de pastas

```
backend/
  app/
    Controllers/   -- lógica de cada módulo (Auth, Wallet, Quiz, Admin...)
    Middleware/     -- autenticação (JWT + roles) e anti-fraude
    Models/         -- acesso ao banco de dados
  database/
    schema.sql      -- todas as tabelas
    seed.js         -- dados iniciais
  routes/           -- uma rota por módulo
  server.js         -- ponto de entrada

frontend/
  src/
    assets/style.css
    services/api.js  -- chamadas à API + gestão de sessão
    views/
      Public/         -- landing page
      Auth/           -- login e registo
      Dashboard/      -- início com XP, missões, saldo
      Quiz/           -- fluxo de quiz real
      Wallet/         -- saldo, saque, histórico
      Profile/        -- dados pessoais, senha, conquistas
      Referral/       -- indicações
      Premium/        -- planos e assinatura
      Admin/          -- dashboard, saques, usuários, cadastro de quiz
```

## Próximos passos sugeridos

1. Conectar um gateway de pagamento real para saques e Premium
2. Implementar envio de notificações push/e-mail de verdade
3. Completar a tradução das telas (usar os arquivos `locales/*.json`)
4. Adicionar mais tipos de pergunta (arrastar, imagem, áudio) se necessário
5. Implementar dificuldade adaptativa com base no desempenho do usuário
