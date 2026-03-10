const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/connection');
const { authMiddleware, perfilMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);
router.use(perfilMiddleware('admin'));

router.get('/', async (req, res) => {
    try {
        const usuarios = await db.getAll(`
            SELECT id, nome, email, perfil, ativo, criado_em, atualizado_em 
            FROM usuarios 
            ORDER BY nome
        `);
        
        res.json(usuarios);
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const usuario = await db.getOne(`
            SELECT id, nome, email, perfil, ativo, criado_em, atualizado_em 
            FROM usuarios WHERE id = $1
        `, [req.params.id]);
        
        if (!usuario) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        res.json(usuario);
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { nome, email, senha, perfil } = req.body;
        
        if (!nome || !email || !senha || !perfil) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }
        
        const perfisValidos = ['admin', 'portaria', 'operador', 'financeiro'];
        if (!perfisValidos.includes(perfil)) {
            return res.status(400).json({ error: 'Perfil inválido' });
        }
        
        const existente = await db.getOne('SELECT id FROM usuarios WHERE email = $1', [email]);
        if (existente) {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }
        
        const senhaHash = bcrypt.hashSync(senha, 10);
        
        const result = await db.getOne(`
            INSERT INTO usuarios (nome, email, senha, perfil) 
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [nome, email, senhaHash, perfil]);
        
        res.status(201).json({ 
            id: result.id,
            message: 'Usuário criado com sucesso' 
        });
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { nome, email, perfil, ativo, senha } = req.body;
        const { id } = req.params;
        
        const usuario = await db.getOne('SELECT id FROM usuarios WHERE id = $1', [id]);
        if (!usuario) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        if (email) {
            const existente = await db.getOne(
                'SELECT id FROM usuarios WHERE email = $1 AND id != $2',
                [email, id]
            );
            if (existente) {
                return res.status(400).json({ error: 'Email já cadastrado' });
            }
        }
        
        let query = 'UPDATE usuarios SET atualizado_em = NOW()';
        const params = [];
        let paramIndex = 1;
        
        if (nome) {
            query += `, nome = $${paramIndex++}`;
            params.push(nome);
        }
        if (email) {
            query += `, email = $${paramIndex++}`;
            params.push(email);
        }
        if (perfil) {
            query += `, perfil = $${paramIndex++}`;
            params.push(perfil);
        }
        if (ativo !== undefined) {
            query += `, ativo = $${paramIndex++}`;
            params.push(ativo);
        }
        if (senha) {
            query += `, senha = $${paramIndex++}`;
            params.push(bcrypt.hashSync(senha, 10));
        }
        
        query += ` WHERE id = $${paramIndex}`;
        params.push(id);
        
        await db.query(query, params);
        
        res.json({ message: 'Usuário atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (parseInt(id) === req.usuario.id) {
            return res.status(400).json({ error: 'Você não pode excluir seu próprio usuário' });
        }
        
        await db.query(
            'UPDATE usuarios SET ativo = false, atualizado_em = NOW() WHERE id = $1',
            [id]
        );
        
        res.json({ message: 'Usuário desativado com sucesso' });
    } catch (error) {
        console.error('Erro ao desativar usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
