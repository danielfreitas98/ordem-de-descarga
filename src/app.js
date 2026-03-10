require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');
const transportadorasRoutes = require('./routes/transportadoras');
const empresasRoutes = require('./routes/empresas');
const motoristasRoutes = require('./routes/motoristas');
const ordensRoutes = require('./routes/ordens');

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/transportadoras', transportadorasRoutes);
app.use('/api/empresas', empresasRoutes);
app.use('/api/motoristas', motoristasRoutes);
app.use('/api/ordens', ordensRoutes);

app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'admin', 'index.html'));
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
    console.log(`Painel Admin: http://localhost:${PORT}/admin/`);
});
