const express = require('express');
const db = require('../database/connection');
const { authMiddleware, perfilMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/buscar-cpf/:cpf', (req, res) => {
    try {
        const cpf = req.params.cpf.replace(/\D/g, '');
        
        const motorista = db.prepare(`
            SELECT m.*, t.razao_social as transportadora_nome
            FROM motoristas m
            LEFT JOIN transportadoras t ON m.transportadora_id = t.id
            WHERE m.cpf = ? AND m.ativo = 1
        `).get(cpf);
        
        if (!motorista) {
            return res.status(404).json({ error: 'Motorista não encontrado' });
        }
        
        res.json(motorista);
    } catch (error) {
        console.error('Erro ao buscar motorista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/publico', (req, res) => {
    try {
        const { nome, cpf, cnh, telefone, transportadora_id } = req.body;
        
        if (!nome || !cpf) {
            return res.status(400).json({ error: 'Nome e CPF são obrigatórios' });
        }
        
        const cpfLimpo = cpf.replace(/\D/g, '');
        
        const existente = db.prepare('SELECT id FROM motoristas WHERE cpf = ?').get(cpfLimpo);
        if (existente) {
            return res.json({ 
                id: existente.id,
                message: 'Motorista já cadastrado',
                existente: true
            });
        }
        
        const result = db.prepare(`
            INSERT INTO motoristas (nome, cpf, cnh, telefone, transportadora_id) 
            VALUES (?, ?, ?, ?, ?)
        `).run(nome, cpfLimpo, cnh || null, telefone || null, transportadora_id || null);
        
        res.status(201).json({ 
            id: result.lastInsertRowid,
            message: 'Motorista cadastrado com sucesso',
            existente: false
        });
    } catch (error) {
        console.error('Erro ao criar motorista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/', authMiddleware, (req, res) => {
    try {
        const motoristas = db.prepare(`
            SELECT m.*, t.razao_social as transportadora_nome
            FROM motoristas m
            LEFT JOIN transportadoras t ON m.transportadora_id = t.id
            WHERE m.ativo = 1
            ORDER BY m.nome
        `).all();
        
        res.json(motoristas);
    } catch (error) {
        console.error('Erro ao listar motoristas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/:id', authMiddleware, (req, res) => {
    try {
        const motorista = db.prepare(`
            SELECT m.*, t.razao_social as transportadora_nome
            FROM motoristas m
            LEFT JOIN transportadoras t ON m.transportadora_id = t.id
            WHERE m.id = ?
        `).get(req.params.id);
        
        if (!motorista) {
            return res.status(404).json({ error: 'Motorista não encontrado' });
        }
        
        res.json(motorista);
    } catch (error) {
        console.error('Erro ao buscar motorista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/', authMiddleware, perfilMiddleware('admin', 'portaria'), (req, res) => {
    try {
        const { nome, cpf, cnh, telefone, transportadora_id } = req.body;
        
        if (!nome || !cpf) {
            return res.status(400).json({ error: 'Nome e CPF são obrigatórios' });
        }
        
        const cpfLimpo = cpf.replace(/\D/g, '');
        
        const existente = db.prepare('SELECT id FROM motoristas WHERE cpf = ?').get(cpfLimpo);
        if (existente) {
            return res.status(400).json({ error: 'CPF já cadastrado' });
        }
        
        const result = db.prepare(`
            INSERT INTO motoristas (nome, cpf, cnh, telefone, transportadora_id) 
            VALUES (?, ?, ?, ?, ?)
        `).run(nome, cpfLimpo, cnh || null, telefone || null, transportadora_id || null);
        
        res.status(201).json({ 
            id: result.lastInsertRowid,
            message: 'Motorista criado com sucesso' 
        });
    } catch (error) {
        console.error('Erro ao criar motorista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.put('/:id', authMiddleware, perfilMiddleware('admin', 'portaria'), (req, res) => {
    try {
        const { nome, cpf, cnh, telefone, transportadora_id, ativo } = req.body;
        const { id } = req.params;
        
        const motorista = db.prepare('SELECT id FROM motoristas WHERE id = ?').get(id);
        if (!motorista) {
            return res.status(404).json({ error: 'Motorista não encontrado' });
        }
        
        if (cpf) {
            const cpfLimpo = cpf.replace(/\D/g, '');
            const existente = db.prepare('SELECT id FROM motoristas WHERE cpf = ? AND id != ?').get(cpfLimpo, id);
            if (existente) {
                return res.status(400).json({ error: 'CPF já cadastrado' });
            }
        }
        
        db.prepare(`
            UPDATE motoristas 
            SET nome = COALESCE(?, nome),
                cpf = COALESCE(?, cpf),
                cnh = COALESCE(?, cnh),
                telefone = COALESCE(?, telefone),
                transportadora_id = COALESCE(?, transportadora_id),
                ativo = COALESCE(?, ativo)
            WHERE id = ?
        `).run(
            nome, 
            cpf ? cpf.replace(/\D/g, '') : null, 
            cnh, 
            telefone, 
            transportadora_id,
            ativo !== undefined ? (ativo ? 1 : 0) : null, 
            id
        );
        
        res.json({ message: 'Motorista atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar motorista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.delete('/:id', authMiddleware, perfilMiddleware('admin'), (req, res) => {
    try {
        db.prepare('UPDATE motoristas SET ativo = 0 WHERE id = ?').run(req.params.id);
        res.json({ message: 'Motorista desativado com sucesso' });
    } catch (error) {
        console.error('Erro ao desativar motorista:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
