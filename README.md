# Sistema de Ordem de Descarga

Sistema web completo para registro e gerenciamento de ordens de descarga, com tela pública para motoristas e painel administrativo.

## Funcionalidades

### Tela Pública (Motoristas)
- Abertura de ordem de descarga
- Cadastro automático de motorista via CPF
- Consulta de status da ordem pelo número
- Interface responsiva e intuitiva

### Painel Administrativo
- **Dashboard** com indicadores em tempo real:
  - Ordens aguardando e em descarga
  - Total faturado no mês
  - Tempo médio de descarga
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

### Status da Ordem
1. **Aguardando** - Ordem criada, aguardando início
2. **Em Descarga** - Descarga em andamento
3. **Finalizada** - Descarga concluída
4. **Faturada** - Valor definido, aguardando pagamento
5. **Paga** - Pagamento confirmado
6. **Cancelada** - Ordem cancelada

## Tecnologias

- **Backend**: Node.js + Express
- **Banco de Dados**: SQLite (arquivo local)
- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Autenticação**: JWT

## Instalação

### Pré-requisitos
- Node.js 18+ instalado
- npm ou yarn

### Passos

1. **Instalar dependências**
```bash
npm install
```

2. **Inicializar o banco de dados**
```bash
npm run init-db
```

3. **Iniciar o servidor**
```bash
npm start
```

4. **Acessar o sistema**
- Tela pública: http://localhost:3000
- Painel admin: http://localhost:3000/admin/

### Usuário padrão
- **Email**: admin@sistema.com
- **Senha**: admin123

> ⚠️ **Importante**: Altere a senha do admin após o primeiro acesso!

## Desenvolvimento

Para rodar com hot-reload:
```bash
npm run dev
```

## Estrutura do Projeto

```
ordem_de_descarga/
├── public/                 # Frontend
│   ├── index.html         # Tela pública
│   ├── admin/             # Painel administrativo
│   │   ├── index.html
│   │   └── login.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── utils.js
│       ├── motorista.js
│       └── admin.js
├── src/                    # Backend
│   ├── app.js             # Servidor Express
│   ├── database/
│   │   ├── init.js        # Inicialização do BD
│   │   └── connection.js
│   ├── middleware/
│   │   └── auth.js        # Autenticação JWT
│   └── routes/
│       ├── auth.js
│       ├── ordens.js
│       ├── usuarios.js
│       ├── transportadoras.js
│       ├── empresas.js
│       └── motoristas.js
├── database.db            # Banco SQLite (gerado)
├── package.json
├── .env                   # Configurações
└── README.md
```

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
| GET | `/api/auth/me` | Dados do usuário logado |
| GET | `/api/ordens` | Lista ordens (com filtros) |
| GET | `/api/ordens/dashboard` | Dados do dashboard |
| GET | `/api/ordens/:id` | Detalhes da ordem |
| PUT | `/api/ordens/:id/status` | Altera status |
| GET/POST/PUT | `/api/usuarios` | CRUD de usuários (admin) |
| GET/POST/PUT | `/api/transportadoras` | CRUD de transportadoras |
| GET/POST/PUT | `/api/empresas` | CRUD de empresas |
| GET/POST/PUT | `/api/motoristas` | CRUD de motoristas |

## Configuração

Arquivo `.env`:
```env
PORT=3000
JWT_SECRET=sua_chave_secreta_aqui
JWT_EXPIRES_IN=24h
```

## Licença

MIT
