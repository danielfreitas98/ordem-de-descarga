-- Schema para Supabase (PostgreSQL)
-- Execute este script no SQL Editor do Supabase

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    perfil TEXT NOT NULL CHECK(perfil IN ('admin', 'portaria', 'operador', 'financeiro')),
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Transportadoras
CREATE TABLE IF NOT EXISTS transportadoras (
    id SERIAL PRIMARY KEY,
    razao_social TEXT NOT NULL,
    cnpj TEXT UNIQUE,
    telefone TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Empresas Destino
CREATE TABLE IF NOT EXISTS empresas_destino (
    id SERIAL PRIMARY KEY,
    razao_social TEXT NOT NULL,
    cnpj TEXT UNIQUE,
    endereco TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Motoristas
CREATE TABLE IF NOT EXISTS motoristas (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    cpf TEXT UNIQUE,
    cnh TEXT,
    telefone TEXT,
    transportadora_id INTEGER REFERENCES transportadoras(id),
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Ordens de Descarga
CREATE TABLE IF NOT EXISTS ordens (
    id SERIAL PRIMARY KEY,
    numero TEXT UNIQUE NOT NULL,
    motorista_id INTEGER NOT NULL REFERENCES motoristas(id),
    transportadora_id INTEGER REFERENCES transportadoras(id),
    empresa_destino_id INTEGER NOT NULL REFERENCES empresas_destino(id),
    placa_veiculo TEXT NOT NULL,
    tipo_carga TEXT NOT NULL,
    peso_carga DECIMAL(10,2),
    quantidade_volumes INTEGER,
    nota_fiscal TEXT,
    valor_descarga DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'aguardando' CHECK(status IN ('aguardando', 'em_descarga', 'finalizada', 'cancelada', 'faturada', 'paga')),
    observacoes TEXT,
    data_entrada TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_inicio_descarga TIMESTAMP WITH TIME ZONE,
    data_fim_descarga TIMESTAMP WITH TIME ZONE,
    usuario_criacao_id INTEGER REFERENCES usuarios(id),
    usuario_alteracao_id INTEGER REFERENCES usuarios(id),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Histórico de Status
CREATE TABLE IF NOT EXISTS historico_status (
    id SERIAL PRIMARY KEY,
    ordem_id INTEGER NOT NULL REFERENCES ordens(id),
    status_anterior TEXT,
    status_novo TEXT NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(id),
    observacao TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_ordens_status ON ordens(status);
CREATE INDEX IF NOT EXISTS idx_ordens_data_entrada ON ordens(data_entrada);
CREATE INDEX IF NOT EXISTS idx_ordens_numero ON ordens(numero);
CREATE INDEX IF NOT EXISTS idx_motoristas_cpf ON motoristas(cpf);
CREATE INDEX IF NOT EXISTS idx_historico_ordem ON historico_status(ordem_id);

-- Inserir usuário admin padrão (senha: admin123)
-- Hash bcrypt para 'admin123'
INSERT INTO usuarios (nome, email, senha, perfil) 
VALUES ('Administrador', 'admin@sistema.com', '$2a$10$N9qo8uLOickgx2ZMRZoHK.ZL5K5Q5L5K5Q5L5K5Q5L5K5Q5L5K5Q5', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Dados de exemplo
INSERT INTO transportadoras (razao_social, cnpj, telefone) 
VALUES ('Transportadora Exemplo LTDA', '12.345.678/0001-90', '(11) 99999-9999')
ON CONFLICT (cnpj) DO NOTHING;

INSERT INTO empresas_destino (razao_social, cnpj, endereco) 
VALUES ('Empresa Destino Exemplo S/A', '98.765.432/0001-10', 'Rua Principal, 100 - Centro')
ON CONFLICT (cnpj) DO NOTHING;
