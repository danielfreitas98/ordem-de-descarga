const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function initDatabase() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    console.log('Conectando ao banco de dados...');

    try {
        const schema = `
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

            CREATE TABLE IF NOT EXISTS transportadoras (
                id SERIAL PRIMARY KEY,
                razao_social TEXT NOT NULL,
                cnpj TEXT UNIQUE,
                telefone TEXT,
                ativo BOOLEAN DEFAULT TRUE,
                criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS empresas_destino (
                id SERIAL PRIMARY KEY,
                razao_social TEXT NOT NULL,
                cnpj TEXT UNIQUE,
                endereco TEXT,
                ativo BOOLEAN DEFAULT TRUE,
                criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

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

            CREATE TABLE IF NOT EXISTS historico_status (
                id SERIAL PRIMARY KEY,
                ordem_id INTEGER NOT NULL REFERENCES ordens(id),
                status_anterior TEXT,
                status_novo TEXT NOT NULL,
                usuario_id INTEGER REFERENCES usuarios(id),
                observacao TEXT,
                criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_ordens_status ON ordens(status);
            CREATE INDEX IF NOT EXISTS idx_ordens_data_entrada ON ordens(data_entrada);
            CREATE INDEX IF NOT EXISTS idx_ordens_numero ON ordens(numero);
            CREATE INDEX IF NOT EXISTS idx_motoristas_cpf ON motoristas(cpf);
            CREATE INDEX IF NOT EXISTS idx_historico_ordem ON historico_status(ordem_id);
        `;

        console.log('Criando estrutura do banco de dados...');
        await pool.query(schema);

        const adminResult = await pool.query('SELECT id FROM usuarios WHERE email = $1', ['admin@sistema.com']);
        
        if (adminResult.rows.length === 0) {
            console.log('Criando usuário administrador padrão...');
            const senhaHash = bcrypt.hashSync('admin123', 10);
            await pool.query(
                'INSERT INTO usuarios (nome, email, senha, perfil) VALUES ($1, $2, $3, $4)',
                ['Administrador', 'admin@sistema.com', senhaHash, 'admin']
            );
            console.log('Usuário admin criado: admin@sistema.com / admin123');
        }

        const transpResult = await pool.query('SELECT id FROM transportadoras LIMIT 1');
        if (transpResult.rows.length === 0) {
            console.log('Criando dados de exemplo...');
            
            await pool.query(
                'INSERT INTO transportadoras (razao_social, cnpj, telefone) VALUES ($1, $2, $3)',
                ['Transportadora Exemplo LTDA', '12.345.678/0001-90', '(11) 99999-9999']
            );
            
            await pool.query(
                'INSERT INTO empresas_destino (razao_social, cnpj, endereco) VALUES ($1, $2, $3)',
                ['Empresa Destino Exemplo S/A', '98.765.432/0001-10', 'Rua Principal, 100 - Centro']
            );
            
            console.log('Dados de exemplo criados!');
        }

        console.log('Banco de dados inicializado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao inicializar banco de dados:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

require('dotenv').config();

if (!process.env.DATABASE_URL) {
    console.error('Erro: DATABASE_URL não configurada no arquivo .env');
    console.log('Configure a variável DATABASE_URL com a string de conexão do Supabase');
    process.exit(1);
}

initDatabase().catch(err => {
    console.error(err);
    process.exit(1);
});
