const express = require('express');
const db = require('../database/connection');
const { authMiddleware, perfilMiddleware } = require('../middleware/auth');

const router = express.Router();

function gerarNumeroOrdem() {
    const ano = new Date().getFullYear();
    const mes = String(new Date().getMonth() + 1).padStart(2, '0');
    
    const ultimaOrdem = db.prepare(`
        SELECT numero FROM ordens 
        WHERE numero LIKE ? 
        ORDER BY id DESC LIMIT 1
    `).get(`OD${ano}${mes}%`);
    
    let sequencial = 1;
    if (ultimaOrdem) {
        const numAnterior = parseInt(ultimaOrdem.numero.slice(-4));
        sequencial = numAnterior + 1;
    }
    
    return `OD${ano}${mes}${String(sequencial).padStart(4, '0')}`;
}

router.post('/publica', (req, res) => {
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
        
        const numero = gerarNumeroOrdem();
        
        const result = db.prepare(`
            INSERT INTO ordens (
                numero, motorista_id, transportadora_id, empresa_destino_id,
                placa_veiculo, tipo_carga, peso_carga, quantidade_volumes,
                nota_fiscal, observacoes, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aguardando')
        `).run(
            numero, motorista_id, transportadora_id || null, empresa_destino_id,
            placa_veiculo.toUpperCase(), tipo_carga, peso_carga || null, 
            quantidade_volumes || null, nota_fiscal || null, observacoes || null
        );
        
        db.prepare(`
            INSERT INTO historico_status (ordem_id, status_novo, observacao)
            VALUES (?, 'aguardando', 'Ordem criada pelo motorista')
        `).run(result.lastInsertRowid);
        
        res.status(201).json({ 
            id: result.lastInsertRowid,
            numero: numero,
            message: 'Ordem de descarga criada com sucesso'
        });
    } catch (error) {
        console.error('Erro ao criar ordem:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/consulta/:numero', (req, res) => {
    try {
        const ordem = db.prepare(`
            SELECT o.*, 
                   m.nome as motorista_nome,
                   t.razao_social as transportadora_nome,
                   e.razao_social as empresa_destino_nome
            FROM ordens o
            LEFT JOIN motoristas m ON o.motorista_id = m.id
            LEFT JOIN transportadoras t ON o.transportadora_id = t.id
            LEFT JOIN empresas_destino e ON o.empresa_destino_id = e.id
            WHERE o.numero = ?
        `).get(req.params.numero);
        
        if (!ordem) {
            return res.status(404).json({ error: 'Ordem não encontrada' });
        }
        
        res.json(ordem);
    } catch (error) {
        console.error('Erro ao consultar ordem:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/', authMiddleware, (req, res) => {
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
        
        if (status) {
            query += ' AND o.status = ?';
            params.push(status);
        }
        
        if (data_inicio) {
            query += ' AND DATE(o.data_entrada) >= ?';
            params.push(data_inicio);
        }
        
        if (data_fim) {
            query += ' AND DATE(o.data_entrada) <= ?';
            params.push(data_fim);
        }
        
        if (empresa_id) {
            query += ' AND o.empresa_destino_id = ?';
            params.push(empresa_id);
        }
        
        if (motorista) {
            query += ' AND (m.nome LIKE ? OR m.cpf LIKE ? OR o.numero LIKE ?)';
            const termo = `%${motorista}%`;
            params.push(termo, termo, termo);
        }
        
        const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
        const total = db.prepare(countQuery).get(...params).total;
        
        query += ' ORDER BY o.data_entrada DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
        
        const ordens = db.prepare(query).all(...params);
        
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

router.get('/dashboard', authMiddleware, (req, res) => {
    try {
        const hoje = new Date().toISOString().split('T')[0];
        const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        
        const totaisPorStatus = db.prepare(`
            SELECT status, COUNT(*) as quantidade, SUM(valor_descarga) as valor_total
            FROM ordens
            GROUP BY status
        `).all();
        
        const ordensHoje = db.prepare(`
            SELECT COUNT(*) as total FROM ordens
            WHERE DATE(data_entrada) = ?
        `).get(hoje).total;
        
        const totalFaturado = db.prepare(`
            SELECT COALESCE(SUM(valor_descarga), 0) as total
            FROM ordens
            WHERE status IN ('faturada', 'paga')
            AND DATE(data_entrada) >= ?
        `).get(inicioMes).total;
        
        const totalPendente = db.prepare(`
            SELECT COALESCE(SUM(valor_descarga), 0) as total
            FROM ordens
            WHERE status IN ('finalizada')
        `).get().total;
        
        const totalPago = db.prepare(`
            SELECT COALESCE(SUM(valor_descarga), 0) as total
            FROM ordens
            WHERE status = 'paga'
            AND DATE(data_entrada) >= ?
        `).get(inicioMes).total;
        
        const tempoMedio = db.prepare(`
            SELECT AVG(
                (julianday(data_fim_descarga) - julianday(data_inicio_descarga)) * 24 * 60
            ) as minutos
            FROM ordens
            WHERE data_inicio_descarga IS NOT NULL 
            AND data_fim_descarga IS NOT NULL
            AND DATE(data_entrada) >= ?
        `).get(inicioMes).minutos || 0;
        
        const ordensPorDia = db.prepare(`
            SELECT DATE(data_entrada) as data, COUNT(*) as quantidade
            FROM ordens
            WHERE DATE(data_entrada) >= DATE('now', '-7 days')
            GROUP BY DATE(data_entrada)
            ORDER BY data
        `).all();
        
        const aguardando = db.prepare(`
            SELECT COUNT(*) as total FROM ordens WHERE status = 'aguardando'
        `).get().total;
        
        const emDescarga = db.prepare(`
            SELECT COUNT(*) as total FROM ordens WHERE status = 'em_descarga'
        `).get().total;
        
        res.json({
            totaisPorStatus,
            ordensHoje,
            totalFaturado,
            totalPendente,
            totalPago,
            tempoMedioMinutos: Math.round(tempoMedio),
            ordensPorDia,
            aguardando,
            emDescarga
        });
    } catch (error) {
        console.error('Erro ao buscar dashboard:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/:id', authMiddleware, (req, res) => {
    try {
        const ordem = db.prepare(`
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
            WHERE o.id = ?
        `).get(req.params.id);
        
        if (!ordem) {
            return res.status(404).json({ error: 'Ordem não encontrada' });
        }
        
        const historico = db.prepare(`
            SELECT h.*, u.nome as usuario_nome
            FROM historico_status h
            LEFT JOIN usuarios u ON h.usuario_id = u.id
            WHERE h.ordem_id = ?
            ORDER BY h.criado_em DESC
        `).all(req.params.id);
        
        res.json({ ...ordem, historico });
    } catch (error) {
        console.error('Erro ao buscar ordem:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.put('/:id/status', authMiddleware, (req, res) => {
    try {
        const { status, observacao, valor_descarga } = req.body;
        const { id } = req.params;
        
        const statusValidos = ['aguardando', 'em_descarga', 'finalizada', 'cancelada', 'faturada', 'paga'];
        if (!statusValidos.includes(status)) {
            return res.status(400).json({ error: 'Status inválido' });
        }
        
        const ordem = db.prepare('SELECT status FROM ordens WHERE id = ?').get(id);
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
            SET status = ?, usuario_alteracao_id = ?, atualizado_em = CURRENT_TIMESTAMP
        `;
        const params = [status, req.usuario.id];
        
        if (status === 'em_descarga') {
            updateQuery += ', data_inicio_descarga = CURRENT_TIMESTAMP';
        }
        
        if (status === 'finalizada') {
            updateQuery += ', data_fim_descarga = CURRENT_TIMESTAMP';
        }
        
        if (valor_descarga !== undefined) {
            updateQuery += ', valor_descarga = ?';
            params.push(valor_descarga);
        }
        
        updateQuery += ' WHERE id = ?';
        params.push(id);
        
        db.prepare(updateQuery).run(...params);
        
        db.prepare(`
            INSERT INTO historico_status (ordem_id, status_anterior, status_novo, usuario_id, observacao)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, statusAtual, status, req.usuario.id, observacao || null);
        
        res.json({ message: 'Status atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.put('/:id', authMiddleware, perfilMiddleware('admin', 'portaria', 'operador'), (req, res) => {
    try {
        const { 
            placa_veiculo, tipo_carga, peso_carga, quantidade_volumes,
            nota_fiscal, valor_descarga, observacoes
        } = req.body;
        const { id } = req.params;
        
        const ordem = db.prepare('SELECT id FROM ordens WHERE id = ?').get(id);
        if (!ordem) {
            return res.status(404).json({ error: 'Ordem não encontrada' });
        }
        
        db.prepare(`
            UPDATE ordens 
            SET placa_veiculo = COALESCE(?, placa_veiculo),
                tipo_carga = COALESCE(?, tipo_carga),
                peso_carga = COALESCE(?, peso_carga),
                quantidade_volumes = COALESCE(?, quantidade_volumes),
                nota_fiscal = COALESCE(?, nota_fiscal),
                valor_descarga = COALESCE(?, valor_descarga),
                observacoes = COALESCE(?, observacoes),
                usuario_alteracao_id = ?,
                atualizado_em = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            placa_veiculo, tipo_carga, peso_carga, quantidade_volumes,
            nota_fiscal, valor_descarga, observacoes, req.usuario.id, id
        );
        
        res.json({ message: 'Ordem atualizada com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar ordem:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
