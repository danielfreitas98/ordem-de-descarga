const jwt = require('jsonwebtoken');
const db = require('../database/connection');

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2) {
        return res.status(401).json({ error: 'Token mal formatado' });
    }
    
    const [scheme, token] = parts;
    
    if (!/^Bearer$/i.test(scheme)) {
        return res.status(401).json({ error: 'Token mal formatado' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const usuario = db.prepare('SELECT id, nome, email, perfil FROM usuarios WHERE id = ? AND ativo = 1').get(decoded.id);
        
        if (!usuario) {
            return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
        }
        
        req.usuario = usuario;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido' });
    }
}

function perfilMiddleware(...perfisPermitidos) {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({ error: 'Não autenticado' });
        }
        
        if (!perfisPermitidos.includes(req.usuario.perfil)) {
            return res.status(403).json({ error: 'Acesso não autorizado para este perfil' });
        }
        
        next();
    };
}

module.exports = { authMiddleware, perfilMiddleware };
