const express = require('express');
const db = require('../database/connection');
const { authMiddleware, perfilMiddleware } = require('../middleware/auth');

const router = express.Router();

async function gerarNumeroOrdem() {
    const ano = new Date().getFullYear();
    const mes = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefixo = `OD${ano}${mes}`;
    
    const ultimaOrdem = await db.getOne(`
        SELECT numero FROM ordens 
        WHERE numero LIKE $1 
        ORDER BY id DESC LIMIT 1
    `, [`${prefixo}%`]);
    
    let sequencial = 1;
    if (ultimaOrdem) {
        const numAnterior = parseInt(ultimaOrdem.numero.slice(-4));
        sequencial = numAnterior + 1;
    }
    
    return `${prefixo}${String(sequencial).padStart(4, '0')}`;
}

router.post('/publica', async (req, res) => {
    try {
        const { 
            motorista_id, 
            transportadora_id, 
            empresa_destino_id, 
            placa_veiculo,
            tipo_carga,
            peso_carga,
            quantidade_volumes,
            nota_fiscal,
            observacoes
        } = req.body;
        
        if (!motorista_id || !empresa_destino_id || !placa_veiculo || !tipo_carga) {
            return res.status(400).json({ 
                error: 'Motorista, empresa destino, placa e tipo de carga são obrigatórios' 
            });
        }
        
        const numero = await gerarNumeroOrdem();
        
        const result = await db.getOne(`
            INSERT INTO ordens (
                numero, motorista_id, transportadora_id, empresa_destino_id,
                placa_veiculo, tipo_carga, peso_carga, quantidade_volumes,
                nota_fiscal, observacoes, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'aguardando')
            RETURNING id
        `, [
            numero, motorista_id, transportadora_id || null, empresa_destino_id,
            placa_veiculo.toUpperCase(), tipo_carga, peso_carga || null, 
            quantidade_volumes || null, nota_fiscal || null, observacoes || null
        ]);
        
        await db.query(`
            INSERT INTO historico_status (ordem_id, status_novo, observacao)
            VALUES ($1, 'aguardando', 'Ordem criada pelo motorista')
        `, [result.id]);
        
        res.status(201).json({ 
            id: result.id,
            numero: numero,
            message: 'Ordem de descarga criada com sucesso'
        });
    } catch (error) {
        console.error('Erro ao criar ordem:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/consulta/:numero', async (req, res) => {
    try {
        const ordem = await db.getOne(`
            SELECT o.*, 
                   m.nome as motorista_nome,
                   t.razao_social as transportadora_nome,
                   e.razao_social as empresa_destino_nome
            FROM ordens o
            LEFT JOIN motoristas m ON o.motorista_id = m.id
            LEFT JOIN transportadoras t ON o.transportadora_id = t.id
            LEFT JOIN empresas_destino e ON o.empresa_destino_id = e.id
            WHERE o.numero = $1
        `, [req.params.numero]);
        
        if (!ordem) {
            return res.status(404).json({ error: 'Ordem não encontrada' });
        }
        
        res.json(ordem);
    } catch (error) {
        console.error('Erro ao consultar ordem:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/', authMiddleware, async (req, res) => {
    try {
        const { status, data_inicio, data_fim, empresa_id, motorista, page = 1, limit = 20 } = req.query;
        
        let query = `
            SELECT o.*, 
                   m.nome as motorista_nome,
                   m.cpf as motorista_cpf,
                   t.razao_social as transportadora_nome,
                   e.razao_social as empresa_destino_nome
            FROM ordens o
            LEFT JOIN motoristas m ON o.motorista_id = m.id
            LEFT JOIN transportadoras t ON o.transportadora_id = t.id
            LEFT JOIN empresas_destino e ON o.empresa_destino_id = e.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramIndex = 1;
        
        if (status) {
            query += ` AND o.status = $${paramIndex++}`;
            params.push(status);
        }
        
        if (data_inicio) {
            query += ` AND DATE(o.data_entrada) >= $${paramIndex++}`;
            params.push(data_inicio);
        }
        
        if (data_fim) {
            query += ` AND DATE(o.data_entrada) <= $${paramIndex++}`;
            params.push(data_fim);
        }
        
        if (empresa_id) {
            query += ` AND o.empresa_destino_id = $${paramIndex++}`;
            params.push(empresa_id);
        }
        
        if (motorista) {
            query += ` AND (m.nome ILIKE $${paramIndex} OR m.cpf ILIKE $${paramIndex} OR o.numero ILIKE $${paramIndex})`;
            params.push(`%${motorista}%`);
            paramIndex++;
        }
        
        const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
        const countResult = await db.getOne(countQuery, params);
        const total = parseInt(countResult.total);
        
        query += ` ORDER BY o.data_entrada DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
        
        const ordens = await db.getAll(query, params);
        
        res.json({
            data: ordens,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Erro ao listar ordens:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/dashboard', authMiddleware, async (req, res) => {
    try {
        const hoje = new Date().toISOString().split('T')[0];
        const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        
        const totaisPorStatus = await db.getAll(`
            SELECT status, COUNT(*) as quantidade, COALESCE(SUM(valor_descarga), 0) as valor_total
            FROM ordens
            GROUP BY status
        `);
        
        const ordensHoje = await db.getOne(`
            SELECT COUNT(*) as total FROM ordens
            WHERE DATE(data_entrada) = $1
        `, [hoje]);
        
        const totalFaturado = await db.getOne(`
            SELECT COALESCE(SUM(valor_descarga), 0) as total
            FROM ordens
            WHERE status IN ('faturada', 'paga')
            AND DATE(data_entrada) >= $1
        `, [inicioMes]);
        
        const totalPendente = await db.getOne(`
            SELECT COALESCE(SUM(valor_descarga), 0) as total
            FROM ordens
            WHERE status IN ('finalizada')
        `);
        
        const totalPago = await db.getOne(`
            SELECT COALESCE(SUM(valor_descarga), 0) as total
            FROM ordens
            WHERE status = 'paga'
            AND DATE(data_entrada) >= $1
        `, [inicioMes]);
        
        const tempoMedio = await db.getOne(`
            SELECT AVG(
                EXTRACT(EPOCH FROM (data_fim_descarga - data_inicio_descarga)) / 60
            ) as minutos
            FROM ordens
            WHERE data_inicio_descarga IS NOT NULL 
            AND data_fim_descarga IS NOT NULL
            AND DATE(data_entrada) >= $1
        `, [inicioMes]);
        
        const ordensPorDia = await db.getAll(`
            SELECT DATE(data_entrada) as data, COUNT(*) as quantidade
            FROM ordens
            WHERE DATE(data_entrada) >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(data_entrada)
            ORDER BY data
        `);
        
        const aguardando = await db.getOne(`
            SELECT COUNT(*) as total FROM ordens WHERE status = 'aguardando'
        `);
        
        const emDescarga = await db.getOne(`
            SELECT COUNT(*) as total FROM ordens WHERE status = 'em_descarga'
        `);
        
        res.json({
            totaisPorStatus,
            ordensHoje: parseInt(ordensHoje.total),
            totalFaturado: parseFloat(totalFaturado.total),
            totalPendente: parseFloat(totalPendente.total),
            totalPago: parseFloat(totalPago.total),
            tempoMedioMinutos: Math.round(parseFloat(tempoMedio.minutos) || 0),
            ordensPorDia,
            aguardando: parseInt(aguardando.total),
            emDescarga: parseInt(emDescarga.total)
        });
    } catch (error) {
        console.error('Erro ao buscar dashboard:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const ordem = await db.getOne(`
            SELECT o.*, 
                   m.nome as motorista_nome,
                   m.cpf as motorista_cpf,
                   m.telefone as motorista_telefone,
                   t.razao_social as transportadora_nome,
                   e.razao_social as empresa_destino_nome
            FROM ordens o
            LEFT JOIN motoristas m ON o.motorista_id = m.id
            LEFT JOIN transportadoras t ON o.transportadora_id = t.id
            LEFT JOIN empresas_destino e ON o.empresa_destino_id = e.id
            WHERE o.id = $1
        `, [req.params.id]);
        
        if (!ordem) {
            return res.status(404).json({ error: 'Ordem não encontrada' });
        }
        
        const historico = await db.getAll(`
            SELECT h.*, u.nome as usuario_nome
            FROM historico_status h
            LEFT JOIN usuarios u ON h.usuario_id = u.id
            WHERE h.ordem_id = $1
            ORDER BY h.criado_em DESC
        `, [req.params.id]);
        
        res.json({ ...ordem, historico });
    } catch (error) {
        console.error('Erro ao buscar ordem:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.put('/:id/status', authMiddleware, async (req, res) => {
    try {
        const { status, observacao, valor_descarga } = req.body;
        const { id } = req.params;
        
        const statusValidos = ['aguardando', 'em_descarga', 'finalizada', 'cancelada', 'faturada', 'paga'];
        if (!statusValidos.includes(status)) {
            return res.status(400).json({ error: 'Status inválido' });
        }
        
        const ordem = await db.getOne('SELECT status FROM ordens WHERE id = $1', [id]);
        if (!ordem) {
            return res.status(404).json({ error: 'Ordem não encontrada' });
        }
        
        const perfil = req.usuario.perfil;
        const statusAtual = ordem.status;
        
        const transicoes = {
            'aguardando': ['em_descarga', 'cancelada'],
            'em_descarga': ['finalizada', 'cancelada'],
            'finalizada': ['faturada', 'cancelada'],
            'faturada': ['paga', 'cancelada'],
            'paga': [],
            'cancelada': []
        };
        
        if (!transicoes[statusAtual].includes(status)) {
            return res.status(400).json({ 
                error: `Não é possível alterar de "${statusAtual}" para "${status}"` 
            });
        }
        
        const permissoes = {
            'admin': statusValidos,
            'portaria': ['em_descarga'],
            'operador': ['finalizada'],
            'financeiro': ['faturada', 'paga']
        };
        
        if (!permissoes[perfil].includes(status) && perfil !== 'admin') {
            return res.status(403).json({ 
                error: 'Seu perfil não tem permissão para esta alteração de status' 
            });
        }
        
        let updateQuery = `
            UPDATE ordens 
            SET status = $1, usuario_alteracao_id = $2, atualizado_em = NOW()
        `;
        const params = [status, req.usuario.id];
        let paramIndex = 3;
        
        if (status === 'em_descarga') {
            updateQuery += ', data_inicio_descarga = NOW()';
        }
        
        if (status === 'finalizada') {
            updateQuery += ', data_fim_descarga = NOW()';
        }
        
        if (valor_descarga !== undefined) {
            updateQuery += `, valor_descarga = $${paramIndex++}`;
            params.push(valor_descarga);
        }
        
        updateQuery += ` WHERE id = $${paramIndex}`;
        params.push(id);
        
        await db.query(updateQuery, params);
        
        await db.query(`
            INSERT INTO historico_status (ordem_id, status_anterior, status_novo, usuario_id, observacao)
            VALUES ($1, $2, $3, $4, $5)
        `, [id, statusAtual, status, req.usuario.id, observacao || null]);
        
        res.json({ message: 'Status atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.put('/:id', authMiddleware, perfilMiddleware('admin', 'portaria', 'operador'), async (req, res) => {
    try {
        const { 
            placa_veiculo, tipo_carga, peso_carga, quantidade_volumes,
            nota_fiscal, valor_descarga, observacoes
        } = req.body;
        const { id } = req.params;
        
        const ordem = await db.getOne('SELECT id FROM ordens WHERE id = $1', [id]);
        if (!ordem) {
            return res.status(404).json({ error: 'Ordem não encontrada' });
        }
        
        await db.query(`
            UPDATE ordens 
            SET placa_veiculo = COALESCE($1, placa_veiculo),
                tipo_carga = COALESCE($2, tipo_carga),
                peso_carga = COALESCE($3, peso_carga),
                quantidade_volumes = COALESCE($4, quantidade_volumes),
                nota_fiscal = COALESCE($5, nota_fiscal),
                valor_descarga = COALESCE($6, valor_descarga),
                observacoes = COALESCE($7, observacoes),
                usuario_alteracao_id = $8,
                atualizado_em = NOW()
            WHERE id = $9
        `, [placa_veiculo, tipo_carga, peso_carga, quantidade_volumes,
            nota_fiscal, valor_descarga, observacoes, req.usuario.id, id]);
        
        res.json({ message: 'Ordem atualizada com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar ordem:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
