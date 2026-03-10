const express = require('express');
const db = require('../database/connection');
const { authMiddleware, perfilMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/publico', (req, res) => {
    try {
        const transportadoras = db.prepare(`
            SELECT id, razao_social 
            FROM transportadoras 
            WHERE ativo = 1 
            ORDER BY razao_social
        `).all();
        
        res.json(transportadoras);
    } catch (error) {
        console.error('Erro ao listar transportadoras:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/', authMiddleware, (req, res) => {
    try {
        const transportadoras = db.prepare(`
            SELECT * FROM transportadoras 
            WHERE ativo = 1 
            ORDER BY razao_social
        `).all();
        
        res.json(transportadoras);
    } catch (error) {
        console.error('Erro ao listar transportadoras:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/:id', authMiddleware, (req, res) => {
    try {
        const transportadora = db.prepare('SELECT * FROM transportadoras WHERE id = ?').get(req.params.id);
        
        if (!transportadora) {
            return res.status(404).json({ error: 'Transportadora não encontrada' });
        }
        
        res.json(transportadora);
    } catch (error) {
        console.error('Erro ao buscar transportadora:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/', authMiddleware, perfilMiddleware('admin', 'portaria'), (req, res) => {
    try {
        const { razao_social, cnpj, telefone } = req.body;
        
        if (!razao_social) {
            return res.status(400).json({ error: 'Razão social é obrigatória' });
        }
        
        if (cnpj) {
            const existente = db.prepare('SELECT id FROM transportadoras WHERE cnpj = ?').get(cnpj);
            if (existente) {
                return res.status(400).json({ error: 'CNPJ já cadastrado' });
            }
        }
        
        const result = db.prepare(`
            INSERT INTO transportadoras (razao_social, cnpj, telefone) 
            VALUES (?, ?, ?)
        `).run(razao_social, cnpj || null, telefone || null);
        
        res.status(201).json({ 
            id: result.lastInsertRowid,
            message: 'Transportadora criada com sucesso' 
        });
    } catch (error) {
        console.error('Erro ao criar transportadora:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.put('/:id', authMiddleware, perfilMiddleware('admin', 'portaria'), (req, res) => {
    try {
        const { razao_social, cnpj, telefone, ativo } = req.body;
        const { id } = req.params;
        
        const transportadora = db.prepare('SELECT id FROM transportadoras WHERE id = ?').get(id);
        if (!transportadora) {
            return res.status(404).json({ error: 'Transportadora não encontrada' });
        }
        
        if (cnpj) {
            const existente = db.prepare('SELECT id FROM transportadoras WHERE cnpj = ? AND id != ?').get(cnpj, id);
            if (existente) {
                return res.status(400).json({ error: 'CNPJ já cadastrado' });
            }
        }
        
        db.prepare(`
            UPDATE transportadoras 
            SET razao_social = COALESCE(?, razao_social),
                cnpj = COALESCE(?, cnpj),
                telefone = COALESCE(?, telefone),
                ativo = COALESCE(?, ativo)
            WHERE id = ?
        `).run(razao_social, cnpj, telefone, ativo !== undefined ? (ativo ? 1 : 0) : null, id);
        
        res.json({ message: 'Transportadora atualizada com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar transportadora:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.delete('/:id', authMiddleware, perfilMiddleware('admin'), (req, res) => {
    try {
        db.prepare('UPDATE transportadoras SET ativo = 0 WHERE id = ?').run(req.params.id);
        res.json({ message: 'Transportadora desativada com sucesso' });
    } catch (error) {
        console.error('Erro ao desativar transportadora:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
