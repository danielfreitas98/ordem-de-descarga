# Sistema de Ordem de Descarga

Sistema web completo para registro e gerenciamento de ordens de descarga, com tela pública para motoristas e painel administrativo.

## Tecnologias

- **Backend**: Node.js + Express
- **Banco de Dados**: PostgreSQL (Supabase)
- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Autenticação**: JWT

## Funcionalidades

### Tela Pública (Motoristas)
- Abertura de ordem de descarga
- Cadastro automático de motorista via CPF
- Consulta de status da ordem pelo número

### Painel Administrativo
- **Dashboard** com indicadores em tempo real
- **Gestão de Ordens** com filtros e alteração de status
- **Cadastros** de transportadoras, empresas destino e motoristas
- **Controle de Usuários** com perfis de acesso

### Perfis de Usuário
| Perfil | Permissões |
|--------|------------|
| **Admin** | Acesso total ao sistema |
| **Portaria** | Iniciar descarga, cadastros básicos |
| **Operador** | Finalizar descarga |
| **Financeiro** | Faturar e registrar pagamento |

---

## Configuração do Supabase

### 1. Criar projeto no Supabase

1. Acesse https://supabase.com e faça login
2. Clique em **New Project**
3. Escolha um nome e senha para o banco
4. Aguarde a criação (cerca de 2 minutos)

### 2. Obter a Connection String

1. No dashboard do projeto, vá em **Settings** > **Database**
2. Copie a **Connection string (URI)**
3. Substitua `[YOUR-PASSWORD]` pela senha do projeto

Exemplo:
```
postgresql://postgres:SuaSenha123@db.abcdefghij.supabase.co:5432/postgres
```

### 3. Configurar o arquivo .env

Crie ou edite o arquivo `.env` na raiz do projeto:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:SuaSenha@db.seuproject.supabase.co:5432/postgres
JWT_SECRET=sua_chave_secreta_forte
JWT_EXPIRES_IN=24h
```

---

## Instalação Local

### 1. Instalar dependências

```bash
npm install
```

### 2. Inicializar o banco de dados

```bash
npm run init-db
```

Isso cria as tabelas e o usuário admin padrão.

### 3. Iniciar o servidor

```bash
npm start
```

### 4. Acessar o sistema

- Tela pública: http://localhost:3000
- Painel admin: http://localhost:3000/admin/

### Credenciais padrão
- **Email**: `admin@sistema.com`
- **Senha**: `admin123`

---

## Deploy (Vercel, Railway, Render)

### Variáveis de ambiente necessárias

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Connection string do Supabase |
| `JWT_SECRET` | Chave secreta para tokens JWT |
| `JWT_EXPIRES_IN` | Tempo de expiração (ex: 24h) |
| `NODE_ENV` | `production` |

### Deploy no Vercel

1. Conecte seu repositório GitHub ao Vercel
2. Configure as variáveis de ambiente
3. Deploy automático!

### Deploy no Railway

1. Conecte seu repositório
2. Configure as variáveis de ambiente
3. O Railway detecta automaticamente o Node.js

---

## Estrutura do Projeto

```
ordem_de_descarga/
├── public/                 # Frontend
│   ├── index.html         # Tela pública
│   ├── admin/             # Painel administrativo
│   ├── css/
│   └── js/
├── src/                    # Backend
│   ├── app.js             # Servidor Express
│   ├── database/
│   │   ├── init.js        # Inicialização do BD
│   │   └── connection.js  # Pool de conexões
│   ├── middleware/
│   │   └── auth.js
│   └── routes/
│       ├── auth.js
│       ├── ordens.js
│       ├── usuarios.js
│       ├── transportadoras.js
│       ├── empresas.js
│       └── motoristas.js
├── supabase_schema.sql    # Schema para executar no Supabase
├── package.json
├── .env                   # Configurações locais
└── README.md
```

---

## API Endpoints

### Públicos
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/transportadoras/publico` | Lista transportadoras |
| GET | `/api/empresas/publico` | Lista empresas destino |
| GET | `/api/motoristas/buscar-cpf/:cpf` | Busca motorista por CPF |
| POST | `/api/motoristas/publico` | Cadastra motorista |
| POST | `/api/ordens/publica` | Cria nova ordem |
| GET | `/api/ordens/consulta/:numero` | Consulta ordem por número |

### Autenticados
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login |
| GET | `/api/ordens` | Lista ordens (com filtros) |
| GET | `/api/ordens/dashboard` | Dados do dashboard |
| PUT | `/api/ordens/:id/status` | Altera status |

---

## Licença

MIT
