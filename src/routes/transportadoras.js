const express = require('express');
const db = require('../database/connection');
const { authMiddleware, perfilMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/publico', async (req, res) => {
    try {
        const transportadoras = await db.getAll(`
            SELECT id, razao_social 
            FROM transportadoras 
            WHERE ativo = true 
            ORDER BY razao_social
        `);
        
        res.json(transportadoras);
    } catch (error) {
        console.error('Erro ao listar transportadoras:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/', authMiddleware, async (req, res) => {
    try {
        const transportadoras = await db.getAll(`
            SELECT * FROM transportadoras 
            WHERE ativo = true 
            ORDER BY razao_social
        `);
        
        res.json(transportadoras);
    } catch (error) {
        console.error('Erro ao listar transportadoras:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const transportadora = await db.getOne(
            'SELECT * FROM transportadoras WHERE id = $1',
            [req.params.id]
        );
        
        if (!transportadora) {
            return res.status(404).json({ error: 'Transportadora não encontrada' });
        }
        
        res.json(transportadora);
    } catch (error) {
        console.error('Erro ao buscar transportadora:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/', authMiddleware, perfilMiddleware('admin', 'portaria'), async (req, res) => {
    try {
        const { razao_social, cnpj, telefone } = req.body;
        
        if (!razao_social) {
            return res.status(400).json({ error: 'Razão social é obrigatória' });
        }
        
        if (cnpj) {
            const existente = await db.getOne(
                'SELECT id FROM transportadoras WHERE cnpj = $1',
                [cnpj]
            );
            if (existente) {
                return res.status(400).json({ error: 'CNPJ já cadastrado' });
            }
        }
        
        const result = await db.getOne(`
            INSERT INTO transportadoras (razao_social, cnpj, telefone) 
            VALUES ($1, $2, $3)
            RETURNING id
        `, [razao_social, cnpj || null, telefone || null]);
        
        res.status(201).json({ 
            id: result.id,
            message: 'Transportadora criada com sucesso' 
        });
    } catch (error) {
        console.error('Erro ao criar transportadora:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.put('/:id', authMiddleware, perfilMiddleware('admin', 'portaria'), async (req, res) => {
    try {
        const { razao_social, cnpj, telefone, ativo } = req.body;
        const { id } = req.params;
        
        const transportadora = await db.getOne(
            'SELECT id FROM transportadoras WHERE id = $1',
            [id]
        );
        if (!transportadora) {
            return res.status(404).json({ error: 'Transportadora não encontrada' });
        }
        
        if (cnpj) {
            const existente = await db.getOne(
                'SELECT id FROM transportadoras WHERE cnpj = $1 AND id != $2',
                [cnpj, id]
            );
            if (existente) {
                return res.status(400).json({ error: 'CNPJ já cadastrado' });
            }
        }
        
        await db.query(`
            UPDATE transportadoras 
            SET razao_social = COALESCE($1, razao_social),
                cnpj = COALESCE($2, cnpj),
                telefone = COALESCE($3, telefone),
                ativo = COALESCE($4, ativo)
            WHERE id = $5
        `, [razao_social, cnpj, telefone, ativo, id]);
        
        res.json({ message: 'Transportadora atualizada com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar transportadora:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.delete('/:id', authMiddleware, perfilMiddleware('admin'), async (req, res) => {
    try {
        await db.query(
            'UPDATE transportadoras SET ativo = false WHERE id = $1',
            [req.params.id]
        );
        res.json({ message: 'Transportadora desativada com sucesso' });
    } catch (error) {
        console.error('Erro ao desativar transportadora:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
