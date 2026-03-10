let usuario = null;
let currentPage = 1;
let transportadorasCache = [];

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/admin/login.html';
        return;
    }
    
    usuario = JSON.parse(localStorage.getItem('usuario'));
    
    document.getElementById('userName').textContent = usuario.nome;
    document.getElementById('userAvatar').textContent = usuario.nome.charAt(0).toUpperCase();
    
    if (usuario.perfil === 'admin') {
        document.getElementById('menuUsuarios').style.display = 'flex';
    }
    
    setupEventListeners();
    await carregarDashboard();
});

function setupEventListeners() {
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.currentTarget.dataset.page;
            navegarPara(page);
        });
    });
    
    document.querySelectorAll('.tabs .tab[data-cadastro]').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tabs .tab[data-cadastro]').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.cadastro-content').forEach(c => c.style.display = 'none');
            
            tab.classList.add('active');
            document.getElementById(`cadastro-${tab.dataset.cadastro}`).style.display = 'block';
            
            if (tab.dataset.cadastro === 'transportadoras') carregarTransportadoras();
            if (tab.dataset.cadastro === 'empresas') carregarEmpresas();
            if (tab.dataset.cadastro === 'motoristas') carregarMotoristas();
        });
    });
    
    document.getElementById('novoStatus').addEventListener('change', (e) => {
        const grupoValor = document.getElementById('grupoValorDescarga');
        grupoValor.style.display = ['finalizada', 'faturada'].includes(e.target.value) ? 'block' : 'none';
    });
}

function navegarPara(page) {
    document.querySelectorAll('.sidebar-nav a').forEach(l => l.classList.remove('active'));
    document.querySelector(`.sidebar-nav a[data-page="${page}"]`).classList.add('active');
    
    document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
    document.getElementById(`page-${page}`).style.display = 'block';
    
    if (page === 'dashboard') carregarDashboard();
    if (page === 'ordens') carregarOrdens();
    if (page === 'cadastros') carregarTransportadoras();
    if (page === 'usuarios') carregarUsuarios();
    
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = '/admin/login.html';
}

async function carregarDashboard() {
    try {
        const data = await fetchAPI('/api/ordens/dashboard');
        
        document.getElementById('statAguardando').textContent = data.aguardando;
        document.getElementById('statEmDescarga').textContent = data.emDescarga;
        document.getElementById('statFaturado').textContent = formatarMoeda(data.totalFaturado);
        document.getElementById('statTempoMedio').textContent = `${data.tempoMedioMinutos} min`;
        
        const ordens = await fetchAPI('/api/ordens?limit=5');
        const tbody = document.querySelector('#tabelaOrdensRecentes tbody');
        tbody.innerHTML = '';
        
        ordens.data.forEach(ordem => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${ordem.numero}</strong></td>
                <td>${ordem.motorista_nome}</td>
                <td>${ordem.empresa_destino_nome}</td>
                <td><span class="badge badge-${ordem.status}">${formatarStatus(ordem.status)}</span></td>
                <td>${formatarData(ordem.data_entrada)}</td>
            `;
            tr.style.cursor = 'pointer';
            tr.addEventListener('click', () => abrirModalOrdem(ordem.id));
            tbody.appendChild(tr);
        });
        
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        mostrarAlerta(error.message, 'danger');
    }
}

async function carregarOrdens() {
    try {
        const status = document.getElementById('filtroStatus').value;
        const dataInicio = document.getElementById('filtroDataInicio').value;
        const dataFim = document.getElementById('filtroDataFim').value;
        const busca = document.getElementById('filtroBusca').value;
        
        let url = `/api/ordens?page=${currentPage}&limit=15`;
        if (status) url += `&status=${status}`;
        if (dataInicio) url += `&data_inicio=${dataInicio}`;
        if (dataFim) url += `&data_fim=${dataFim}`;
        if (busca) url += `&motorista=${encodeURIComponent(busca)}`;
        
        const data = await fetchAPI(url);
        
        const tbody = document.querySelector('#tabelaOrdens tbody');
        tbody.innerHTML = '';
        
        if (data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;">Nenhuma ordem encontrada</td></tr>';
        } else {
            data.data.forEach(ordem => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${ordem.numero}</strong></td>
                    <td>${ordem.motorista_nome}</td>
                    <td>${ordem.empresa_destino_nome}</td>
                    <td>${ordem.placa_veiculo}</td>
                    <td><span class="badge badge-${ordem.status}">${formatarStatus(ordem.status)}</span></td>
                    <td>${formatarMoeda(ordem.valor_descarga)}</td>
                    <td>${formatarData(ordem.data_entrada)}</td>
                    <td class="table-actions">
                        <button class="btn btn-outline btn-sm" onclick="abrirModalOrdem(${ordem.id})">Ver</button>
                        ${getAcoesOrdem(ordem)}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
        
        renderizarPaginacao(data.pagination, 'paginacaoOrdens', (page) => {
            currentPage = page;
            carregarOrdens();
        });
        
    } catch (error) {
        console.error('Erro ao carregar ordens:', error);
        mostrarAlerta(error.message, 'danger');
    }
}

function getAcoesOrdem(ordem) {
    const perfil = usuario.perfil;
    let acoes = [];
    
    if (ordem.status === 'aguardando' && ['admin', 'portaria'].includes(perfil)) {
        acoes.push(`<button class="btn btn-primary btn-sm" onclick="alterarStatusRapido(${ordem.id}, 'em_descarga')">Iniciar</button>`);
    }
    
    if (ordem.status === 'em_descarga' && ['admin', 'operador'].includes(perfil)) {
        acoes.push(`<button class="btn btn-success btn-sm" onclick="abrirModalStatus(${ordem.id}, 'finalizada')">Finalizar</button>`);
    }
    
    if (ordem.status === 'finalizada' && ['admin', 'financeiro'].includes(perfil)) {
        acoes.push(`<button class="btn btn-warning btn-sm" onclick="abrirModalStatus(${ordem.id}, 'faturada')">Faturar</button>`);
    }
    
    if (ordem.status === 'faturada' && ['admin', 'financeiro'].includes(perfil)) {
        acoes.push(`<button class="btn btn-success btn-sm" onclick="alterarStatusRapido(${ordem.id}, 'paga')">Pagar</button>`);
    }
    
    return acoes.join('');
}

async function abrirModalOrdem(id) {
    try {
        const ordem = await fetchAPI(`/api/ordens/${id}`);
        
        const body = document.getElementById('modalOrdemBody');
        body.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">NÚMERO</strong>
                    <p style="margin-top: 5px; font-size: 1.25rem; font-weight: 600;">${ordem.numero}</p>
                </div>
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">STATUS</strong>
                    <p style="margin-top: 5px;"><span class="badge badge-${ordem.status}">${formatarStatus(ordem.status)}</span></p>
                </div>
            </div>
            
            <hr style="margin: 20px 0; border: none; border-top: 1px solid var(--border);">
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">MOTORISTA</strong>
                    <p style="margin-top: 5px;">${ordem.motorista_nome}</p>
                    <small style="color: var(--text-secondary);">CPF: ${ordem.motorista_cpf || '-'} | Tel: ${ordem.motorista_telefone || '-'}</small>
                </div>
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">TRANSPORTADORA</strong>
                    <p style="margin-top: 5px;">${ordem.transportadora_nome || 'Não informada'}</p>
                </div>
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">EMPRESA DESTINO</strong>
                    <p style="margin-top: 5px;">${ordem.empresa_destino_nome}</p>
                </div>
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">PLACA</strong>
                    <p style="margin-top: 5px;">${ordem.placa_veiculo}</p>
                </div>
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">TIPO DE CARGA</strong>
                    <p style="margin-top: 5px;">${ordem.tipo_carga}</p>
                </div>
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">PESO</strong>
                    <p style="margin-top: 5px;">${ordem.peso_carga ? ordem.peso_carga + ' kg' : '-'}</p>
                </div>
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">VOLUMES</strong>
                    <p style="margin-top: 5px;">${ordem.quantidade_volumes || '-'}</p>
                </div>
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">NOTA FISCAL</strong>
                    <p style="margin-top: 5px;">${ordem.nota_fiscal || '-'}</p>
                </div>
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">VALOR DESCARGA</strong>
                    <p style="margin-top: 5px;">${formatarMoeda(ordem.valor_descarga)}</p>
                </div>
            </div>
            
            <hr style="margin: 20px 0; border: none; border-top: 1px solid var(--border);">
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">ENTRADA</strong>
                    <p style="margin-top: 5px;">${formatarData(ordem.data_entrada)}</p>
                </div>
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">INÍCIO DESCARGA</strong>
                    <p style="margin-top: 5px;">${formatarData(ordem.data_inicio_descarga)}</p>
                </div>
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">FIM DESCARGA</strong>
                    <p style="margin-top: 5px;">${formatarData(ordem.data_fim_descarga)}</p>
                </div>
            </div>
            
            ${ordem.observacoes ? `
                <hr style="margin: 20px 0; border: none; border-top: 1px solid var(--border);">
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">OBSERVAÇÕES</strong>
                    <p style="margin-top: 5px;">${ordem.observacoes}</p>
                </div>
            ` : ''}
            
            ${ordem.historico && ordem.historico.length > 0 ? `
                <hr style="margin: 20px 0; border: none; border-top: 1px solid var(--border);">
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">HISTÓRICO</strong>
                    <div style="margin-top: 10px;">
                        ${ordem.historico.map(h => `
                            <div style="padding: 10px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span class="badge badge-${h.status_novo}">${formatarStatus(h.status_novo)}</span>
                                    <small style="color: var(--text-secondary);">${formatarData(h.criado_em)}</small>
                                </div>
                                ${h.usuario_nome ? `<small style="color: var(--text-secondary);">Por: ${h.usuario_nome}</small>` : ''}
                                ${h.observacao ? `<p style="margin-top: 5px; font-size: 0.9rem;">${h.observacao}</p>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
        
        const footer = document.getElementById('modalOrdemFooter');
        footer.innerHTML = `
            <button class="btn btn-outline" onclick="fecharModal('modalOrdem')">Fechar</button>
            ${!['cancelada', 'paga'].includes(ordem.status) && usuario.perfil === 'admin' ? 
                `<button class="btn btn-secondary" onclick="abrirModalStatus(${ordem.id})">Alterar Status</button>` : ''
            }
        `;
        
        abrirModal('modalOrdem');
        
    } catch (error) {
        console.error('Erro ao abrir ordem:', error);
        mostrarAlerta(error.message, 'danger');
    }
}

function abrirModalStatus(id, statusSugerido = '') {
    document.getElementById('statusOrdemId').value = id;
    document.getElementById('novoStatus').value = statusSugerido || 'em_descarga';
    document.getElementById('observacaoStatus').value = '';
    document.getElementById('valorDescarga').value = '';
    
    const grupoValor = document.getElementById('grupoValorDescarga');
    grupoValor.style.display = ['finalizada', 'faturada'].includes(statusSugerido) ? 'block' : 'none';
    
    fecharModal('modalOrdem');
    abrirModal('modalStatus');
}

async function salvarStatus() {
    try {
        const id = document.getElementById('statusOrdemId').value;
        const status = document.getElementById('novoStatus').value;
        const observacao = document.getElementById('observacaoStatus').value;
        const valorDescarga = document.getElementById('valorDescarga').value;
        
        const data = { status, observacao };
        if (valorDescarga) data.valor_descarga = parseFloat(valorDescarga);
        
        await fetchAPI(`/api/ordens/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        
        mostrarAlerta('Status atualizado com sucesso!', 'success');
        fecharModal('modalStatus');
        carregarOrdens();
        carregarDashboard();
        
    } catch (error) {
        mostrarAlerta(error.message, 'danger');
    }
}

async function alterarStatusRapido(id, status) {
    try {
        await fetchAPI(`/api/ordens/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        
        mostrarAlerta('Status atualizado!', 'success');
        carregarOrdens();
        carregarDashboard();
        
    } catch (error) {
        mostrarAlerta(error.message, 'danger');
    }
}

async function carregarTransportadoras() {
    try {
        const data = await fetchAPI('/api/transportadoras');
        transportadorasCache = data;
        
        const tbody = document.querySelector('#tabelaTransportadoras tbody');
        tbody.innerHTML = '';
        
        data.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${t.razao_social}</td>
                <td>${t.cnpj || '-'}</td>
                <td>${t.telefone || '-'}</td>
                <td class="table-actions">
                    <button class="btn btn-outline btn-sm" onclick="editarTransportadora(${t.id})">Editar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (error) {
        console.error('Erro ao carregar transportadoras:', error);
    }
}

function abrirModalTransportadora() {
    document.getElementById('tituloModalTransportadora').textContent = 'Nova Transportadora';
    document.getElementById('transportadoraEditId').value = '';
    document.getElementById('transportadoraRazao').value = '';
    document.getElementById('transportadoraCnpj').value = '';
    document.getElementById('transportadoraTelefone').value = '';
    abrirModal('modalTransportadora');
}

async function editarTransportadora(id) {
    try {
        const t = await fetchAPI(`/api/transportadoras/${id}`);
        
        document.getElementById('tituloModalTransportadora').textContent = 'Editar Transportadora';
        document.getElementById('transportadoraEditId').value = t.id;
        document.getElementById('transportadoraRazao').value = t.razao_social;
        document.getElementById('transportadoraCnpj').value = t.cnpj || '';
        document.getElementById('transportadoraTelefone').value = t.telefone || '';
        
        abrirModal('modalTransportadora');
        
    } catch (error) {
        mostrarAlerta(error.message, 'danger');
    }
}

async function salvarTransportadora() {
    try {
        const id = document.getElementById('transportadoraEditId').value;
        const data = {
            razao_social: document.getElementById('transportadoraRazao').value,
            cnpj: document.getElementById('transportadoraCnpj').value,
            telefone: document.getElementById('transportadoraTelefone').value
        };
        
        if (id) {
            await fetchAPI(`/api/transportadoras/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        } else {
            await fetchAPI('/api/transportadoras', { method: 'POST', body: JSON.stringify(data) });
        }
        
        mostrarAlerta('Transportadora salva com sucesso!', 'success');
        fecharModal('modalTransportadora');
        carregarTransportadoras();
        
    } catch (error) {
        mostrarAlerta(error.message, 'danger');
    }
}

async function carregarEmpresas() {
    try {
        const data = await fetchAPI('/api/empresas');
        
        const tbody = document.querySelector('#tabelaEmpresas tbody');
        tbody.innerHTML = '';
        
        data.forEach(e => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${e.razao_social}</td>
                <td>${e.cnpj || '-'}</td>
                <td>${e.endereco || '-'}</td>
                <td class="table-actions">
                    <button class="btn btn-outline btn-sm" onclick="editarEmpresa(${e.id})">Editar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (error) {
        console.error('Erro ao carregar empresas:', error);
    }
}

function abrirModalEmpresa() {
    document.getElementById('tituloModalEmpresa').textContent = 'Nova Empresa';
    document.getElementById('empresaEditId').value = '';
    document.getElementById('empresaRazao').value = '';
    document.getElementById('empresaCnpj').value = '';
    document.getElementById('empresaEndereco').value = '';
    abrirModal('modalEmpresa');
}

async function editarEmpresa(id) {
    try {
        const e = await fetchAPI(`/api/empresas/${id}`);
        
        document.getElementById('tituloModalEmpresa').textContent = 'Editar Empresa';
        document.getElementById('empresaEditId').value = e.id;
        document.getElementById('empresaRazao').value = e.razao_social;
        document.getElementById('empresaCnpj').value = e.cnpj || '';
        document.getElementById('empresaEndereco').value = e.endereco || '';
        
        abrirModal('modalEmpresa');
        
    } catch (error) {
        mostrarAlerta(error.message, 'danger');
    }
}

async function salvarEmpresa() {
    try {
        const id = document.getElementById('empresaEditId').value;
        const data = {
            razao_social: document.getElementById('empresaRazao').value,
            cnpj: document.getElementById('empresaCnpj').value,
            endereco: document.getElementById('empresaEndereco').value
        };
        
        if (id) {
            await fetchAPI(`/api/empresas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        } else {
            await fetchAPI('/api/empresas', { method: 'POST', body: JSON.stringify(data) });
        }
        
        mostrarAlerta('Empresa salva com sucesso!', 'success');
        fecharModal('modalEmpresa');
        carregarEmpresas();
        
    } catch (error) {
        mostrarAlerta(error.message, 'danger');
    }
}

async function carregarMotoristas() {
    try {
        if (transportadorasCache.length === 0) {
            transportadorasCache = await fetchAPI('/api/transportadoras');
        }
        
        const select = document.getElementById('motoristaTransportadoraEdit');
        select.innerHTML = '<option value="">Selecione</option>';
        transportadorasCache.forEach(t => {
            select.innerHTML += `<option value="${t.id}">${t.razao_social}</option>`;
        });
        
        const data = await fetchAPI('/api/motoristas');
        
        const tbody = document.querySelector('#tabelaMotoristas tbody');
        tbody.innerHTML = '';
        
        data.forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${m.nome}</td>
                <td>${m.cpf || '-'}</td>
                <td>${m.telefone || '-'}</td>
                <td>${m.transportadora_nome || '-'}</td>
                <td class="table-actions">
                    <button class="btn btn-outline btn-sm" onclick="editarMotorista(${m.id})">Editar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (error) {
        console.error('Erro ao carregar motoristas:', error);
    }
}

function abrirModalMotorista() {
    document.getElementById('tituloModalMotorista').textContent = 'Novo Motorista';
    document.getElementById('motoristaEditId').value = '';
    document.getElementById('motoristaNomeEdit').value = '';
    document.getElementById('motoristaCpfEdit').value = '';
    document.getElementById('motoristaCnhEdit').value = '';
    document.getElementById('motoristaTelefoneEdit').value = '';
    document.getElementById('motoristaTransportadoraEdit').value = '';
    abrirModal('modalMotorista');
}

async function editarMotorista(id) {
    try {
        const m = await fetchAPI(`/api/motoristas/${id}`);
        
        document.getElementById('tituloModalMotorista').textContent = 'Editar Motorista';
        document.getElementById('motoristaEditId').value = m.id;
        document.getElementById('motoristaNomeEdit').value = m.nome;
        document.getElementById('motoristaCpfEdit').value = m.cpf || '';
        document.getElementById('motoristaCnhEdit').value = m.cnh || '';
        document.getElementById('motoristaTelefoneEdit').value = m.telefone || '';
        document.getElementById('motoristaTransportadoraEdit').value = m.transportadora_id || '';
        
        abrirModal('modalMotorista');
        
    } catch (error) {
        mostrarAlerta(error.message, 'danger');
    }
}

async function salvarMotorista() {
    try {
        const id = document.getElementById('motoristaEditId').value;
        const data = {
            nome: document.getElementById('motoristaNomeEdit').value,
            cpf: document.getElementById('motoristaCpfEdit').value,
            cnh: document.getElementById('motoristaCnhEdit').value,
            telefone: document.getElementById('motoristaTelefoneEdit').value,
            transportadora_id: document.getElementById('motoristaTransportadoraEdit').value || null
        };
        
        if (id) {
            await fetchAPI(`/api/motoristas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        } else {
            await fetchAPI('/api/motoristas', { method: 'POST', body: JSON.stringify(data) });
        }
        
        mostrarAlerta('Motorista salvo com sucesso!', 'success');
        fecharModal('modalMotorista');
        carregarMotoristas();
        
    } catch (error) {
        mostrarAlerta(error.message, 'danger');
    }
}

async function carregarUsuarios() {
    try {
        const data = await fetchAPI('/api/usuarios');
        
        const tbody = document.querySelector('#tabelaUsuarios tbody');
        tbody.innerHTML = '';
        
        const perfilLabels = {
            'admin': 'Administrador',
            'portaria': 'Portaria',
            'operador': 'Operador',
            'financeiro': 'Financeiro'
        };
        
        data.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.nome}</td>
                <td>${u.email}</td>
                <td>${perfilLabels[u.perfil] || u.perfil}</td>
                <td>${u.ativo ? '<span class="badge badge-finalizada">Ativo</span>' : '<span class="badge badge-cancelada">Inativo</span>'}</td>
                <td class="table-actions">
                    <button class="btn btn-outline btn-sm" onclick="editarUsuario(${u.id})">Editar</button>
                    ${u.id !== usuario.id ? `<button class="btn btn-danger btn-sm" onclick="desativarUsuario(${u.id})">Desativar</button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
    }
}

function abrirModalUsuario() {
    document.getElementById('tituloModalUsuario').textContent = 'Novo Usuário';
    document.getElementById('usuarioEditId').value = '';
    document.getElementById('usuarioNome').value = '';
    document.getElementById('usuarioEmail').value = '';
    document.getElementById('usuarioSenha').value = '';
    document.getElementById('usuarioPerfil').value = 'portaria';
    document.getElementById('grupoSenha').style.display = 'block';
    document.getElementById('usuarioSenha').required = true;
    abrirModal('modalUsuario');
}

async function editarUsuario(id) {
    try {
        const u = await fetchAPI(`/api/usuarios/${id}`);
        
        document.getElementById('tituloModalUsuario').textContent = 'Editar Usuário';
        document.getElementById('usuarioEditId').value = u.id;
        document.getElementById('usuarioNome').value = u.nome;
        document.getElementById('usuarioEmail').value = u.email;
        document.getElementById('usuarioSenha').value = '';
        document.getElementById('usuarioPerfil').value = u.perfil;
        document.getElementById('grupoSenha').querySelector('.form-label').innerHTML = 'Nova Senha <small>(deixe em branco para manter)</small>';
        document.getElementById('usuarioSenha').required = false;
        
        abrirModal('modalUsuario');
        
    } catch (error) {
        mostrarAlerta(error.message, 'danger');
    }
}

async function salvarUsuario() {
    try {
        const id = document.getElementById('usuarioEditId').value;
        const data = {
            nome: document.getElementById('usuarioNome').value,
            email: document.getElementById('usuarioEmail').value,
            perfil: document.getElementById('usuarioPerfil').value
        };
        
        const senha = document.getElementById('usuarioSenha').value;
        if (senha) data.senha = senha;
        
        if (id) {
            await fetchAPI(`/api/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        } else {
            if (!senha) {
                mostrarAlerta('Senha é obrigatória para novos usuários', 'danger');
                return;
            }
            await fetchAPI('/api/usuarios', { method: 'POST', body: JSON.stringify(data) });
        }
        
        mostrarAlerta('Usuário salvo com sucesso!', 'success');
        fecharModal('modalUsuario');
        carregarUsuarios();
        
    } catch (error) {
        mostrarAlerta(error.message, 'danger');
    }
}

async function desativarUsuario(id) {
    if (!confirm('Deseja realmente desativar este usuário?')) return;
    
    try {
        await fetchAPI(`/api/usuarios/${id}`, { method: 'DELETE' });
        mostrarAlerta('Usuário desativado!', 'success');
        carregarUsuarios();
    } catch (error) {
        mostrarAlerta(error.message, 'danger');
    }
}

function abrirModal(id) {
    document.getElementById(id).classList.add('active');
}

function fecharModal(id) {
    document.getElementById(id).classList.remove('active');
}

function renderizarPaginacao(pagination, containerId, callback) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (pagination.pages <= 1) return;
    
    const btnAnterior = document.createElement('button');
    btnAnterior.textContent = '←';
    btnAnterior.disabled = pagination.page === 1;
    btnAnterior.addEventListener('click', () => callback(pagination.page - 1));
    container.appendChild(btnAnterior);
    
    for (let i = 1; i <= pagination.pages; i++) {
        if (pagination.pages > 7 && i > 2 && i < pagination.pages - 1 && Math.abs(i - pagination.page) > 1) {
            if (i === 3 || i === pagination.pages - 2) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.padding = '8px';
                container.appendChild(dots);
            }
            continue;
        }
        
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = i === pagination.page ? 'active' : '';
        btn.addEventListener('click', () => callback(i));
        container.appendChild(btn);
    }
    
    const btnProximo = document.createElement('button');
    btnProximo.textContent = '→';
    btnProximo.disabled = pagination.page === pagination.pages;
    btnProximo.addEventListener('click', () => callback(pagination.page + 1));
    container.appendChild(btnProximo);
}
