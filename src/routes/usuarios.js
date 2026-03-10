const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/connection');
const { authMiddleware, perfilMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);
router.use(perfilMiddleware('admin'));

router.get('/', (req, res) => {
    try {
        const usuarios = db.prepare(`
            SELECT id, nome, email, perfil, ativo, criado_em, atualizado_em 
            FROM usuarios 
            ORDER BY nome
        `).all();
        
        res.json(usuarios);
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/:id', (req, res) => {
    try {
        const usuario = db.prepare(`
            SELECT id, nome, email, perfil, ativo, criado_em, atualizado_em 
            FROM usuarios WHERE id = ?
        `).get(req.params.id);
        
        if (!usuario) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        res.json(usuario);
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/', (req, res) => {
    try {
        const { nome, email, senha, perfil } = req.body;
        
        if (!nome || !email || !senha || !perfil) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }
        
        const perfisValidos = ['admin', 'portaria', 'operador', 'financeiro'];
        if (!perfisValidos.includes(perfil)) {
            return res.status(400).json({ error: 'Perfil inválido' });
        }
        
        const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
        if (existente) {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }
        
        const senhaHash = bcrypt.hashSync(senha, 10);
        
        const result = db.prepare(`
            INSERT INTO usuarios (nome, email, senha, perfil) 
            VALUES (?, ?, ?, ?)
        `).run(nome, email, senhaHash, perfil);
        
        res.status(201).json({ 
            id: result.lastInsertRowid,
            message: 'Usuário criado com sucesso' 
        });
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.put('/:id', (req, res) => {
    try {
        const { nome, email, perfil, ativo, senha } = req.body;
        const { id } = req.params;
        
        const usuario = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(id);
        if (!usuario) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        if (email) {
            const existente = db.prepare('SELECT id FROM usuarios WHERE email = ? AND id != ?').get(email, id);
            if (existente) {
                return res.status(400).json({ error: 'Email já cadastrado' });
            }
        }
        
        let query = 'UPDATE usuarios SET atualizado_em = CURRENT_TIMESTAMP';
        const params = [];
        
        if (nome) {
            query += ', nome = ?';
            params.push(nome);
        }
        if (email) {
            query += ', email = ?';
            params.push(email);
        }
        if (perfil) {
            query += ', perfil = ?';
            params.push(perfil);
        }
        if (ativo !== undefined) {
            query += ', ativo = ?';
            params.push(ativo ? 1 : 0);
        }
        if (senha) {
            query += ', senha = ?';
            params.push(bcrypt.hashSync(senha, 10));
        }
        
        query += ' WHERE id = ?';
        params.push(id);
        
        db.prepare(query).run(...params);
        
        res.json({ message: 'Usuário atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        if (parseInt(id) === req.usuario.id) {
            return res.status(400).json({ error: 'Você não pode excluir seu próprio usuário' });
        }
        
        db.prepare('UPDATE usuarios SET ativo = 0, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?').run(id);
        
        res.json({ message: 'Usuário desativado com sucesso' });
    } catch (error) {
        console.error('Erro ao desativar usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
