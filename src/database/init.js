const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'database.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

const schema = `
-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    perfil TEXT NOT NULL CHECK(perfil IN ('admin', 'portaria', 'operador', 'financeiro')),
    ativo INTEGER DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Transportadoras
CREATE TABLE IF NOT EXISTS transportadoras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    razao_social TEXT NOT NULL,
    cnpj TEXT UNIQUE,
    telefone TEXT,
    ativo INTEGER DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Empresas Destino
CREATE TABLE IF NOT EXISTS empresas_destino (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    razao_social TEXT NOT NULL,
    cnpj TEXT UNIQUE,
    endereco TEXT,
    ativo INTEGER DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Motoristas
CREATE TABLE IF NOT EXISTS motoristas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cpf TEXT UNIQUE,
    cnh TEXT,
    telefone TEXT,
    transportadora_id INTEGER,
    ativo INTEGER DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transportadora_id) REFERENCES transportadoras(id)
);

-- Tabela de Ordens de Descarga
CREATE TABLE IF NOT EXISTS ordens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT UNIQUE NOT NULL,
    motorista_id INTEGER NOT NULL,
    transportadora_id INTEGER,
    empresa_destino_id INTEGER NOT NULL,
    placa_veiculo TEXT NOT NULL,
    tipo_carga TEXT NOT NULL,
    peso_carga REAL,
    quantidade_volumes INTEGER,
    nota_fiscal TEXT,
    valor_descarga REAL DEFAULT 0,
    status TEXT DEFAULT 'aguardando' CHECK(status IN ('aguardando', 'em_descarga', 'finalizada', 'cancelada', 'faturada', 'paga')),
    observacoes TEXT,
    data_entrada DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_inicio_descarga DATETIME,
    data_fim_descarga DATETIME,
    usuario_criacao_id INTEGER,
    usuario_alteracao_id INTEGER,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (motorista_id) REFERENCES motoristas(id),
    FOREIGN KEY (transportadora_id) REFERENCES transportadoras(id),
    FOREIGN KEY (empresa_destino_id) REFERENCES empresas_destino(id),
    FOREIGN KEY (usuario_criacao_id) REFERENCES usuarios(id),
    FOREIGN KEY (usuario_alteracao_id) REFERENCES usuarios(id)
);

-- Tabela de Histórico de Status
CREATE TABLE IF NOT EXISTS historico_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ordem_id INTEGER NOT NULL,
    status_anterior TEXT,
    status_novo TEXT NOT NULL,
    usuario_id INTEGER,
    observacao TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ordem_id) REFERENCES ordens(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_ordens_status ON ordens(status);
CREATE INDEX IF NOT EXISTS idx_ordens_data_entrada ON ordens(data_entrada);
CREATE INDEX IF NOT EXISTS idx_ordens_numero ON ordens(numero);
CREATE INDEX IF NOT EXISTS idx_motoristas_cpf ON motoristas(cpf);
CREATE INDEX IF NOT EXISTS idx_historico_ordem ON historico_status(ordem_id);
`;

console.log('Criando estrutura do banco de dados...');
db.exec(schema);

const adminExists = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('admin@sistema.com');

if (!adminExists) {
    console.log('Criando usuário administrador padrão...');
    const senhaHash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
        INSERT INTO usuarios (nome, email, senha, perfil) 
        VALUES (?, ?, ?, ?)
    `).run('Administrador', 'admin@sistema.com', senhaHash, 'admin');
    console.log('Usuário admin criado: admin@sistema.com / admin123');
}

const transportadoraExists = db.prepare('SELECT id FROM transportadoras LIMIT 1').get();
if (!transportadoraExists) {
    console.log('Criando dados de exemplo...');
    
    db.prepare('INSERT INTO transportadoras (razao_social, cnpj, telefone) VALUES (?, ?, ?)')
        .run('Transportadora Exemplo LTDA', '12.345.678/0001-90', '(11) 99999-9999');
    
    db.prepare('INSERT INTO empresas_destino (razao_social, cnpj, endereco) VALUES (?, ?, ?)')
        .run('Empresa Destino Exemplo S/A', '98.765.432/0001-10', 'Rua Principal, 100 - Centro');
    
    console.log('Dados de exemplo criados!');
}

console.log('Banco de dados inicializado com sucesso!');
db.close();
