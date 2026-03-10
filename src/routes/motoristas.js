const express = require('express');
const db = require('../database/connection');
const { authMiddleware, perfilMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/buscar-cpf/:cpf', async (req, res) => {
    try {
        const cpf = req.params.cpf.replace(/\D/g, '');
        
        const motorista = await db.getOne(`
            SELECT m.*, t.razao_social as transportadora_nome
            FROM motoristas m
            LEFT JOIN transportadoras t ON m.transportadora_id = t.id
            WHERE m.cpf = $1 AND m.ativo = true
        `, [cpf]);
        
        if (!motorista) {
            return res.status(404).json({ error: 'Motorista não encontrado' });
        }
        
        res.json(motorista);
    } catch (error) {
        console.error('Erro ao buscar motorista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/publico', async (req, res) => {
    try {
        const { nome, cpf, cnh, telefone, transportadora_id } = req.body;
        
        if (!nome || !cpf) {
            return res.status(400).json({ error: 'Nome e CPF são obrigatórios' });
        }
        
        const cpfLimpo = cpf.replace(/\D/g, '');
        
        const existente = await db.getOne(
            'SELECT id FROM motoristas WHERE cpf = $1',
            [cpfLimpo]
        );
        if (existente) {
            return res.json({ 
                id: existente.id,
                message: 'Motorista já cadastrado',
                existente: true
            });
        }
        
        const result = await db.getOne(`
            INSERT INTO motoristas (nome, cpf, cnh, telefone, transportadora_id) 
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, [nome, cpfLimpo, cnh || null, telefone || null, transportadora_id || null]);
        
        res.status(201).json({ 
            id: result.id,
            message: 'Motorista cadastrado com sucesso',
            existente: false
        });
    } catch (error) {
        console.error('Erro ao criar motorista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/', authMiddleware, async (req, res) => {
    try {
        const motoristas = await db.getAll(`
            SELECT m.*, t.razao_social as transportadora_nome
            FROM motoristas m
            LEFT JOIN transportadoras t ON m.transportadora_id = t.id
            WHERE m.ativo = true
            ORDER BY m.nome
        `);
        
        res.json(motoristas);
    } catch (error) {
        console.error('Erro ao listar motoristas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const motorista = await db.getOne(`
            SELECT m.*, t.razao_social as transportadora_nome
            FROM motoristas m
            LEFT JOIN transportadoras t ON m.transportadora_id = t.id
            WHERE m.id = $1
        `, [req.params.id]);
        
        if (!motorista) {
            return res.status(404).json({ error: 'Motorista não encontrado' });
        }
        
        res.json(motorista);
    } catch (error) {
        console.error('Erro ao buscar motorista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/', authMiddleware, perfilMiddleware('admin', 'portaria'), async (req, res) => {
    try {
        const { nome, cpf, cnh, telefone, transportadora_id } = req.body;
        
        if (!nome || !cpf) {
            return res.status(400).json({ error: 'Nome e CPF são obrigatórios' });
        }
        
        const cpfLimpo = cpf.replace(/\D/g, '');
        
        const existente = await db.getOne(
            'SELECT id FROM motoristas WHERE cpf = $1',
            [cpfLimpo]
        );
        if (existente) {
            return res.status(400).json({ error: 'CPF já cadastrado' });
        }
        
        const result = await db.getOne(`
            INSERT INTO motoristas (nome, cpf, cnh, telefone, transportadora_id) 
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, [nome, cpfLimpo, cnh || null, telefone || null, transportadora_id || null]);
        
        res.status(201).json({ 
            id: result.id,
            message: 'Motorista criado com sucesso' 
        });
    } catch (error) {
        console.error('Erro ao criar motorista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.put('/:id', authMiddleware, perfilMiddleware('admin', 'portaria'), async (req, res) => {
    try {
        const { nome, cpf, cnh, telefone, transportadora_id, ativo } = req.body;
        const { id } = req.params;
        
        const motorista = await db.getOne(
            'SELECT id FROM motoristas WHERE id = $1',
            [id]
        );
        if (!motorista) {
            return res.status(404).json({ error: 'Motorista não encontrado' });
        }
        
        if (cpf) {
            const cpfLimpo = cpf.replace(/\D/g, '');
            const existente = await db.getOne(
                'SELECT id FROM motoristas WHERE cpf = $1 AND id != $2',
                [cpfLimpo, id]
            );
            if (existente) {
                return res.status(400).json({ error: 'CPF já cadastrado' });
            }
        }
        
        const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : null;
        
        await db.query(`
            UPDATE motoristas 
            SET nome = COALESCE($1, nome),
                cpf = COALESCE($2, cpf),
                cnh = COALESCE($3, cnh),
                telefone = COALESCE($4, telefone),
                transportadora_id = COALESCE($5, transportadora_id),
                ativo = COALESCE($6, ativo)
            WHERE id = $7
        `, [nome, cpfLimpo, cnh, telefone, transportadora_id, ativo, id]);
        
        res.json({ message: 'Motorista atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar motorista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.delete('/:id', authMiddleware, perfilMiddleware('admin'), async (req, res) => {
    try {
        await db.query(
            'UPDATE motoristas SET ativo = false WHERE id = $1',
            [req.params.id]
        );
        res.json({ message: 'Motorista desativado com sucesso' });
    } catch (error) {
        console.error('Erro ao desativar motorista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
