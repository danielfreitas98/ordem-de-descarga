let currentStep = 1;
let motoristaData = null;
let transportadoras = [];
let empresas = [];

document.addEventListener('DOMContentLoaded', async () => {
    await carregarDadosIniciais();
    setupEventListeners();
});

async function carregarDadosIniciais() {
    try {
        const [transRes, empRes] = await Promise.all([
            fetchAPI('/api/transportadoras/publico'),
            fetchAPI('/api/empresas/publico')
        ]);
        
        transportadoras = transRes;
        empresas = empRes;
        
        const selectTransp = document.getElementById('transportadoraId');
        transportadoras.forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = t.razao_social;
            selectTransp.appendChild(option);
        });
        
        const selectEmp = document.getElementById('empresaDestinoId');
        empresas.forEach(e => {
            const option = document.createElement('option');
            option.value = e.id;
            option.textContent = e.razao_social;
            selectEmp.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

function setupEventListeners() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
    
    const cpfInput = document.getElementById('cpfBusca');
    cpfInput.addEventListener('input', (e) => {
        e.target.value = formatarCPF(e.target.value);
    });
    
    cpfInput.addEventListener('input', debounce(async (e) => {
        const cpf = e.target.value.replace(/\D/g, '');
        if (cpf.length === 11) {
            await buscarMotorista(cpf);
        }
    }, 500));
    
    document.getElementById('motoristaTelefone').addEventListener('input', (e) => {
        e.target.value = formatarTelefone(e.target.value);
    });
    
    document.getElementById('placaVeiculo').addEventListener('input', (e) => {
        e.target.value = formatarPlaca(e.target.value);
    });
    
    document.getElementById('formOrdem').addEventListener('submit', enviarOrdem);
}

async function buscarMotorista(cpf) {
    try {
        const motorista = await fetchAPI(`/api/motoristas/buscar-cpf/${cpf}`);
        
        motoristaData = motorista;
        document.getElementById('motoristaId').value = motorista.id;
        document.getElementById('motoristaNome').value = motorista.nome;
        document.getElementById('motoristaTelefone').value = motorista.telefone || '';
        document.getElementById('motoristaCnh').value = motorista.cnh || '';
        document.getElementById('transportadoraId').value = motorista.transportadora_id || '';
        
        document.getElementById('motoristaEncontrado').style.display = 'flex';
        document.getElementById('motoristaNome').disabled = true;
        
    } catch (error) {
        motoristaData = null;
        document.getElementById('motoristaId').value = '';
        document.getElementById('motoristaNome').value = '';
        document.getElementById('motoristaNome').disabled = false;
        document.getElementById('motoristaTelefone').value = '';
        document.getElementById('motoristaCnh').value = '';
        document.getElementById('transportadoraId').value = '';
        document.getElementById('motoristaEncontrado').style.display = 'none';
    }
    
    document.getElementById('dadosMotorista').style.display = 'block';
}

function proximoStep(step) {
    if (step === 2) {
        const cpf = document.getElementById('cpfBusca').value.replace(/\D/g, '');
        const nome = document.getElementById('motoristaNome').value;
        
        if (cpf.length !== 11) {
            mostrarAlerta('CPF inválido', 'danger');
            return;
        }
        
        if (!nome.trim()) {
            mostrarAlerta('Nome é obrigatório', 'danger');
            return;
        }
    }
    
    if (step === 3) {
        const empresa = document.getElementById('empresaDestinoId').value;
        const placa = document.getElementById('placaVeiculo').value;
        const tipoCarga = document.getElementById('tipoCarga').value;
        
        if (!empresa || !placa || !tipoCarga) {
            mostrarAlerta('Preencha os campos obrigatórios', 'danger');
            return;
        }
        
        montarResumo();
    }
    
    currentStep = step;
    atualizarSteps();
}

function voltarStep(step) {
    currentStep = step;
    atualizarSteps();
}

function atualizarSteps() {
    document.querySelectorAll('.step-content').forEach(el => {
        el.style.display = 'none';
    });
    
    document.querySelector(`.step-content[data-step="${currentStep}"]`).style.display = 'block';
    
    document.querySelectorAll('.step').forEach(el => {
        const stepNum = parseInt(el.dataset.step);
        el.classList.remove('active', 'completed');
        
        if (stepNum === currentStep) {
            el.classList.add('active');
        } else if (stepNum < currentStep) {
            el.classList.add('completed');
        }
    });
}

function montarResumo() {
    const empresaSelect = document.getElementById('empresaDestinoId');
    const empresaNome = empresaSelect.options[empresaSelect.selectedIndex].text;
    
    const transpSelect = document.getElementById('transportadoraId');
    const transpNome = transpSelect.selectedIndex > 0 ? transpSelect.options[transpSelect.selectedIndex].text : 'Não informada';
    
    const resumo = `
        <div style="display: grid; gap: 20px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">MOTORISTA</strong>
                    <p style="margin-top: 5px;">${document.getElementById('motoristaNome').value}</p>
                </div>
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">CPF</strong>
                    <p style="margin-top: 5px;">${document.getElementById('cpfBusca').value}</p>
                </div>
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">TRANSPORTADORA</strong>
                    <p style="margin-top: 5px;">${transpNome}</p>
                </div>
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">EMPRESA DESTINO</strong>
                    <p style="margin-top: 5px;">${empresaNome}</p>
                </div>
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">PLACA</strong>
                    <p style="margin-top: 5px;">${document.getElementById('placaVeiculo').value}</p>
                </div>
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">TIPO DE CARGA</strong>
                    <p style="margin-top: 5px;">${document.getElementById('tipoCarga').value}</p>
                </div>
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">PESO</strong>
                    <p style="margin-top: 5px;">${document.getElementById('pesoCarga').value || 'Não informado'} kg</p>
                </div>
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">VOLUMES</strong>
                    <p style="margin-top: 5px;">${document.getElementById('quantidadeVolumes').value || 'Não informado'}</p>
                </div>
            </div>
            ${document.getElementById('observacoes').value ? `
                <div>
                    <strong style="color: var(--text-secondary); font-size: 0.85rem;">OBSERVAÇÕES</strong>
                    <p style="margin-top: 5px;">${document.getElementById('observacoes').value}</p>
                </div>
            ` : ''}
        </div>
    `;
    
    document.getElementById('resumoOrdem').innerHTML = resumo;
}

async function enviarOrdem(e) {
    e.preventDefault();
    
    const btnEnviar = document.getElementById('btnEnviar');
    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando...';
    
    try {
        let motoristaId = document.getElementById('motoristaId').value;
        
        if (!motoristaId) {
            const motoristaRes = await fetchAPI('/api/motoristas/publico', {
                method: 'POST',
                body: JSON.stringify({
                    nome: document.getElementById('motoristaNome').value,
                    cpf: document.getElementById('cpfBusca').value,
                    telefone: document.getElementById('motoristaTelefone').value,
                    cnh: document.getElementById('motoristaCnh').value,
                    transportadora_id: document.getElementById('transportadoraId').value || null
                })
            });
            motoristaId = motoristaRes.id;
        }
        
        const ordemData = {
            motorista_id: parseInt(motoristaId),
            transportadora_id: document.getElementById('transportadoraId').value ? parseInt(document.getElementById('transportadoraId').value) : null,
            empresa_destino_id: parseInt(document.getElementById('empresaDestinoId').value),
            placa_veiculo: document.getElementById('placaVeiculo').value,
            tipo_carga: document.getElementById('tipoCarga').value,
            peso_carga: document.getElementById('pesoCarga').value ? parseFloat(document.getElementById('pesoCarga').value) : null,
            quantidade_volumes: document.getElementById('quantidadeVolumes').value ? parseInt(document.getElementById('quantidadeVolumes').value) : null,
            nota_fiscal: document.getElementById('notaFiscal').value || null,
            observacoes: document.getElementById('observacoes').value || null
        };
        
        const result = await fetchAPI('/api/ordens/publica', {
            method: 'POST',
            body: JSON.stringify(ordemData)
        });
        
        document.getElementById('numeroOrdemCriada').textContent = result.numero;
        document.getElementById('formOrdem').style.display = 'none';
        document.querySelector('.step-indicator').style.display = 'none';
        document.getElementById('ordemSucesso').style.display = 'block';
        
    } catch (error) {
        mostrarAlerta(error.message, 'danger');
    } finally {
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Confirmar Ordem';
    }
}

function novaOrdem() {
    document.getElementById('formOrdem').reset();
    document.getElementById('formOrdem').style.display = 'block';
    document.querySelector('.step-indicator').style.display = 'flex';
    document.getElementById('ordemSucesso').style.display = 'none';
    document.getElementById('dadosMotorista').style.display = 'none';
    document.getElementById('motoristaEncontrado').style.display = 'none';
    document.getElementById('motoristaNome').disabled = false;
    document.getElementById('motoristaId').value = '';
    motoristaData = null;
    currentStep = 1;
    atualizarSteps();
}

async function consultarOrdem() {
    const numero = document.getElementById('numeroConsulta').value.trim().toUpperCase();
    
    if (!numero) {
        mostrarAlerta('Digite o número da ordem', 'warning');
        return;
    }
    
    try {
        const ordem = await fetchAPI(`/api/ordens/consulta/${numero}`);
        
        const html = `
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3>Ordem ${ordem.numero}</h3>
                    <span class="badge badge-${ordem.status}">${formatarStatus(ordem.status)}</span>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <div>
                        <strong style="color: var(--text-secondary); font-size: 0.85rem;">MOTORISTA</strong>
                        <p style="margin-top: 5px;">${ordem.motorista_nome}</p>
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
                        <strong style="color: var(--text-secondary); font-size: 0.85rem;">DATA ENTRADA</strong>
                        <p style="margin-top: 5px;">${formatarData(ordem.data_entrada)}</p>
                    </div>
                    ${ordem.data_inicio_descarga ? `
                        <div>
                            <strong style="color: var(--text-secondary); font-size: 0.85rem;">INÍCIO DESCARGA</strong>
                            <p style="margin-top: 5px;">${formatarData(ordem.data_inicio_descarga)}</p>
                        </div>
                    ` : ''}
                    ${ordem.data_fim_descarga ? `
                        <div>
                            <strong style="color: var(--text-secondary); font-size: 0.85rem;">FIM DESCARGA</strong>
                            <p style="margin-top: 5px;">${formatarData(ordem.data_fim_descarga)}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.getElementById('resultadoConsulta').innerHTML = html;
        document.getElementById('resultadoConsulta').style.display = 'block';
        
    } catch (error) {
        document.getElementById('resultadoConsulta').innerHTML = `
            <div class="alert alert-danger" style="margin-top: 20px;">
                Ordem não encontrada. Verifique o número e tente novamente.
            </div>
        `;
        document.getElementById('resultadoConsulta').style.display = 'block';
    }
}
