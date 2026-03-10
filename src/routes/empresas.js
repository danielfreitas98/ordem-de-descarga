const express = require('express');
const db = require('../database/connection');
const { authMiddleware, perfilMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/publico', (req, res) => {
    try {
        const empresas = db.prepare(`
            SELECT id, razao_social 
            FROM empresas_destino 
            WHERE ativo = 1 
            ORDER BY razao_social
        `).all();
        
        res.json(empresas);
    } catch (error) {
        console.error('Erro ao listar empresas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/', authMiddleware, (req, res) => {
    try {
        const empresas = db.prepare(`
            SELECT * FROM empresas_destino 
            WHERE ativo = 1 
            ORDER BY razao_social
        `).all();
        
        res.json(empresas);
    } catch (error) {
        console.error('Erro ao listar empresas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/:id', authMiddleware, (req, res) => {
    try {
        const empresa = db.prepare('SELECT * FROM empresas_destino WHERE id = ?').get(req.params.id);
        
        if (!empresa) {
            return res.status(404).json({ error: 'Empresa não encontrada' });
        }
        
        res.json(empresa);
    } catch (error) {
        console.error('Erro ao buscar empresa:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/', authMiddleware, perfilMiddleware('admin', 'portaria'), (req, res) => {
    try {
        const { razao_social, cnpj, endereco } = req.body;
        
        if (!razao_social) {
            return res.status(400).json({ error: 'Razão social é obrigatória' });
        }
        
        if (cnpj) {
            const existente = db.prepare('SELECT id FROM empresas_destino WHERE cnpj = ?').get(cnpj);
            if (existente) {
                return res.status(400).json({ error: 'CNPJ já cadastrado' });
            }
        }
        
        const result = db.prepare(`
            INSERT INTO empresas_destino (razao_social, cnpj, endereco) 
            VALUES (?, ?, ?)
        `).run(razao_social, cnpj || null, endereco || null);
        
        res.status(201).json({ 
            id: result.lastInsertRowid,
            message: 'Empresa criada com sucesso' 
        });
    } catch (error) {
        console.error('Erro ao criar empresa:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.put('/:id', authMiddleware, perfilMiddleware('admin', 'portaria'), (req, res) => {
    try {
        const { razao_social, cnpj, endereco, ativo } = req.body;
        const { id } = req.params;
        
        const empresa = db.prepare('SELECT id FROM empresas_destino WHERE id = ?').get(id);
        if (!empresa) {
            return res.status(404).json({ error: 'Empresa não encontrada' });
        }
        
        if (cnpj) {
            const existente = db.prepare('SELECT id FROM empresas_destino WHERE cnpj = ? AND id != ?').get(cnpj, id);
            if (existente) {
                return res.status(400).json({ error: 'CNPJ já cadastrado' });
            }
        }
        
        db.prepare(`
            UPDATE empresas_destino 
            SET razao_social = COALESCE(?, razao_social),
                cnpj = COALESCE(?, cnpj),
                endereco = COALESCE(?, endereco),
                ativo = COALESCE(?, ativo)
            WHERE id = ?
        `).run(razao_social, cnpj, endereco, ativo !== undefined ? (ativo ? 1 : 0) : null, id);
        
        res.json({ message: 'Empresa atualizada com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar empresa:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.delete('/:id', authMiddleware, perfilMiddleware('admin'), (req, res) => {
    try {
        db.prepare('UPDATE empresas_destino SET ativo = 0 WHERE id = ?').run(req.params.id);
        res.json({ message: 'Empresa desativada com sucesso' });
    } catch (error) {
        console.error('Erro ao desativar empresa:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
