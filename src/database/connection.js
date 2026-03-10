const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
    console.error('Erro inesperado no pool do PostgreSQL:', err);
});

async function query(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env.NODE_ENV !== 'production') {
            console.log('Query executada:', { text: text.substring(0, 50), duration, rows: result.rowCount });
        }
        return result;
    } catch (error) {
        console.error('Erro na query:', error.message);
        throw error;
    }
}

async function getOne(text, params) {
    const result = await query(text, params);
    return result.rows[0] || null;
}

async function getAll(text, params) {
    const result = await query(text, params);
    return result.rows;
}

async function run(text, params) {
    const result = await query(text, params);
    return {
        rowCount: result.rowCount,
        lastInsertId: result.rows[0]?.id || null
    };
}

module.exports = {
    pool,
    query,
    getOne,
    getAll,
    run
};
