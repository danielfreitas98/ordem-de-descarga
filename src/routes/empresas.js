const express = require('express');
const db = require('../database/connection');
const { authMiddleware, perfilMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/publico', async (req, res) => {
    try {
        const empresas = await db.getAll(`
            SELECT id, razao_social 
            FROM empresas_destino 
            WHERE ativo = true 
            ORDER BY razao_social
        `);
        
        res.json(empresas);
    } catch (error) {
        console.error('Erro ao listar empresas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/', authMiddleware, async (req, res) => {
    try {
        const empresas = await db.getAll(`
            SELECT * FROM empresas_destino 
            WHERE ativo = true 
            ORDER BY razao_social
        `);
        
        res.json(empresas);
    } catch (error) {
        console.error('Erro ao listar empresas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const empresa = await db.getOne(
            'SELECT * FROM empresas_destino WHERE id = $1',
            [req.params.id]
        );
        
        if (!empresa) {
            return res.status(404).json({ error: 'Empresa não encontrada' });
        }
        
        res.json(empresa);
    } catch (error) {
        console.error('Erro ao buscar empresa:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/', authMiddleware, perfilMiddleware('admin', 'portaria'), async (req, res) => {
    try {
        const { razao_social, cnpj, endereco } = req.body;
        
        if (!razao_social) {
            return res.status(400).json({ error: 'Razão social é obrigatória' });
        }
        
        if (cnpj) {
            const existente = await db.getOne(
                'SELECT id FROM empresas_destino WHERE cnpj = $1',
                [cnpj]
            );
            if (existente) {
                return res.status(400).json({ error: 'CNPJ já cadastrado' });
            }
        }
        
        const result = await db.getOne(`
            INSERT INTO empresas_destino (razao_social, cnpj, endereco) 
            VALUES ($1, $2, $3)
            RETURNING id
        `, [razao_social, cnpj || null, endereco || null]);
        
        res.status(201).json({ 
            id: result.id,
            message: 'Empresa criada com sucesso' 
        });
    } catch (error) {
        console.error('Erro ao criar empresa:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.put('/:id', authMiddleware, perfilMiddleware('admin', 'portaria'), async (req, res) => {
    try {
        const { razao_social, cnpj, endereco, ativo } = req.body;
        const { id } = req.params;
        
        const empresa = await db.getOne(
            'SELECT id FROM empresas_destino WHERE id = $1',
            [id]
        );
        if (!empresa) {
            return res.status(404).json({ error: 'Empresa não encontrada' });
        }
        
        if (cnpj) {
            const existente = await db.getOne(
                'SELECT id FROM empresas_destino WHERE cnpj = $1 AND id != $2',
                [cnpj, id]
            );
            if (existente) {
                return res.status(400).json({ error: 'CNPJ já cadastrado' });
            }
        }
        
        await db.query(`
            UPDATE empresas_destino 
            SET razao_social = COALESCE($1, razao_social),
                cnpj = COALESCE($2, cnpj),
                endereco = COALESCE($3, endereco),
                ativo = COALESCE($4, ativo)
            WHERE id = $5
        `, [razao_social, cnpj, endereco, ativo, id]);
        
        res.json({ message: 'Empresa atualizada com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar empresa:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.delete('/:id', authMiddleware, perfilMiddleware('admin'), async (req, res) => {
    try {
        await db.query(
            'UPDATE empresas_destino SET ativo = false WHERE id = $1',
            [req.params.id]
        );
        res.json({ message: 'Empresa desativada com sucesso' });
    } catch (error) {
        console.error('Erro ao desativar empresa:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
