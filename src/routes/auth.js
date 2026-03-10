const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/connection');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        
        if (!email || !senha) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }
        
        const usuario = await db.getOne(
            'SELECT * FROM usuarios WHERE email = $1 AND ativo = true',
            [email]
        );
        
        if (!usuario) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }
        
        if (!bcrypt.compareSync(senha, usuario.senha)) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }
        
        const token = jwt.sign(
            { id: usuario.id, perfil: usuario.perfil },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );
        
        res.json({
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                perfil: usuario.perfil
            }
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.get('/me', authMiddleware, (req, res) => {
    res.json(req.usuario);
});

router.put('/alterar-senha', authMiddleware, async (req, res) => {
    try {
        const { senhaAtual, novaSenha } = req.body;
        
        if (!senhaAtual || !novaSenha) {
            return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
        }
        
        const usuario = await db.getOne(
            'SELECT senha FROM usuarios WHERE id = $1',
            [req.usuario.id]
        );
        
        if (!bcrypt.compareSync(senhaAtual, usuario.senha)) {
            return res.status(400).json({ error: 'Senha atual incorreta' });
        }
        
        const senhaHash = bcrypt.hashSync(novaSenha, 10);
        await db.query(
            'UPDATE usuarios SET senha = $1, atualizado_em = NOW() WHERE id = $2',
            [senhaHash, req.usuario.id]
        );
        
        res.json({ message: 'Senha alterada com sucesso' });
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
