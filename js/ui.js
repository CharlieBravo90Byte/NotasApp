// ══════════════════════════════════════
//  ui.js — Interfaz v3 (plantillas dinámicas)
// ══════════════════════════════════════

const $ = (sel) => document.querySelector(sel);

// ── Estado global de sesión ──
let sesion = {
    usuarioId:   null,
    plantillaId: null,
    plantilla:   null   // objeto completo cargado desde DB
};

// ══════════════════════════════════════
//  TOAST
// ══════════════════════════════════════
function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    $('#toastContainer').appendChild(el);
    setTimeout(() => { el.classList.add('removing'); setTimeout(() => el.remove(), 300); }, 2800);
}

// ══════════════════════════════════════
//  MODALES
// ══════════════════════════════════════
function openModal(id)  { const m = document.getElementById(id); if (m) m.classList.add('active'); }
function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('active'); }

document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-modal]');
    if (btn) { closeModal(btn.dataset.modal); return; }
    if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('active');
});

function confirmar(title, message, labelOk = 'Eliminar', danger = true) {
    return new Promise((resolve) => {
        $('#confirmTitle').textContent   = title;
        $('#confirmMessage').textContent = message;
        const btnOk = $('#btnConfirmOk');
        btnOk.textContent = labelOk;
        btnOk.className   = 'btn ' + (danger ? 'btn-danger' : 'btn-accent');
        openModal('modalConfirm');
        const handler = () => { closeModal('modalConfirm'); btnOk.removeEventListener('click', handler); resolve(true); };
        btnOk.addEventListener('click', handler);
        const overlay = $('#modalConfirm');
        const cancelH = (e) => {
            if (e.target === overlay || e.target.closest('[data-modal="modalConfirm"]')) {
                overlay.removeEventListener('click', cancelH); resolve(false);
            }
        };
        overlay.addEventListener('click', cancelH);
    });
}

// ══════════════════════════════════════
//  USUARIOS / ALUMNOS
// ══════════════════════════════════════
$('#btnNuevoUsuario').addEventListener('click', () => {
    $('#inputUsuario').value = '';
    openModal('modalUsuario');
    setTimeout(() => $('#inputUsuario').focus(), 100);
});

$('#inputUsuario').addEventListener('keypress', e => { if (e.key === 'Enter') $('#btnGuardarUsuario').click(); });

$('#btnGuardarUsuario').addEventListener('click', async () => {
    const nombre = $('#inputUsuario').value.trim();
    if (!nombre) { toast('Ingresa un nombre', 'error'); return; }
    try {
        await crearUsuario(nombre);
        closeModal('modalUsuario');
        await cargarSelectUsuarios();
        // Seleccionar el nuevo
        const sel = $('#usuarioSelect');
        sel.value = sel.options[sel.options.length - 1].value;
        sel.dispatchEvent(new Event('change'));
        toast(`Alumno "${nombre}" creado`, 'success');
    } catch(err) { toast('Error: ' + err.message, 'error'); }
});

$('#btnEliminarUsuario').addEventListener('click', async () => {
    const id     = parseInt($('#usuarioSelect').value);
    const nombre = $('#usuarioSelect').options[$('#usuarioSelect').selectedIndex].text;
    if (!id) return;
    const ok = await confirmar('Eliminar alumno', `¿Eliminar "${nombre}" y todas sus notas?`);
    if (!ok) return;
    try {
        await eliminarUsuario(id);
        await cargarSelectUsuarios();
        resetUI();
        toast(`Alumno "${nombre}" eliminado`, 'success');
    } catch(err) { toast('Error: ' + err.message, 'error'); }
});

async function cargarSelectUsuarios() {
    const sel      = $('#usuarioSelect');
    const usuarios = await obtenerUsuarios();
    sel.innerHTML  = '<option value="">Seleccionar alumno...</option>';
    usuarios.forEach(u => {
        const o = document.createElement('option');
        o.value = u.id; o.textContent = u.nombre;
        sel.appendChild(o);
    });
    $('#btnEliminarUsuario').disabled = true;
}

$('#usuarioSelect').addEventListener('change', async () => {
    const id = parseInt($('#usuarioSelect').value);
    sesion.usuarioId = id || null;
    $('#btnEliminarUsuario').disabled = !id;
    $('#plantillaSelect').disabled    = !id;
    if (id) {
        await cargarSelectPlantillas();
        // Si hay plantilla seleccionada, recargar notas
        if (sesion.plantillaId) await mostrarNotas();
    } else {
        resetUI();
    }
});

// ══════════════════════════════════════
//  PLANTILLAS (select en panel)
// ══════════════════════════════════════
async function cargarSelectPlantillas() {
    const sel        = $('#plantillaSelect');
    const plantillas = await obtenerPlantillas();
    const prevVal    = sel.value;
    sel.innerHTML    = '<option value="">Seleccionar ramo...</option>';
    plantillas.forEach(p => {
        const o = document.createElement('option');
        o.value = p.id; o.textContent = p.nombre;
        sel.appendChild(o);
    });
    sel.disabled = false;
    // Mantener selección si sigue existiendo
    if (prevVal) sel.value = prevVal;
}

$('#plantillaSelect').addEventListener('change', async () => {
    const id = parseInt($('#plantillaSelect').value);
    sesion.plantillaId = id || null;
    sesion.plantilla   = id ? await obtenerPlantilla(id) : null;
    if (id && sesion.usuarioId) {
        await mostrarNotas();
    } else {
        resetUI();
    }
});

// ══════════════════════════════════════
//  GESTIÓN DE RAMOS (plantillas)
// ══════════════════════════════════════
$('#btnGestionarRamos').addEventListener('click', async () => {
    await renderListaRamos();
    openModal('modalGestionRamos');
});

async function renderListaRamos() {
    const plantillas = await obtenerPlantillas();
    const lista      = $('#listaRamos');
    if (plantillas.length === 0) {
        lista.innerHTML = '<p class="help-text" style="padding:12px">No hay ramos aún. Crea el primero.</p>';
        return;
    }
    lista.innerHTML = '';
    for (const p of plantillas) {
        const row = document.createElement('div');
        row.className = 'ramo-list-item';
        row.innerHTML = `
            <div class="ramo-list-nombre">
                <strong>${p.nombre}</strong>
                <span class="help-text">${p.componentes.length} componentes · ${p.componentes.reduce((s,c)=>s+c.subs.length,0)} evaluaciones${p.umbralEximen != null ? ` · umbral ${p.umbralEximen}` : ''}${p.examenObligatorio ? ' · 🔒 examen obligatorio' : ''}</span>
            </div>
            <div class="ramo-list-actions">
                <button class="btn btn-ghost btn-sm" data-edit="${p.id}">✏ Editar</button>
                <button class="btn btn-danger-ghost btn-sm" data-del="${p.id}">✕</button>
            </div>
        `;
        // Editar
        row.querySelector('[data-edit]').addEventListener('click', async () => {
            closeModal('modalGestionRamos');
            await abrirEditorPlantilla(p.id);
        });
        // Eliminar
        row.querySelector('[data-del]').addEventListener('click', async () => {
            const ok = await confirmar('Eliminar ramo', `¿Eliminar "${p.nombre}" y todas las notas asociadas?`);
            if (!ok) return;
            await eliminarPlantilla(p.id);
            if (sesion.plantillaId === p.id) { sesion.plantillaId = null; sesion.plantilla = null; resetUI(); }
            await cargarSelectPlantillas();
            await renderListaRamos();
            toast(`Ramo "${p.nombre}" eliminado`, 'success');
        });
        lista.appendChild(row);
    }
}

$('#btnNuevaPlantilla').addEventListener('click', () => {
    closeModal('modalGestionRamos');
    abrirEditorPlantilla(null);
});

// ══════════════════════════════════════
//  EDITOR DE PLANTILLA
// ══════════════════════════════════════

const NP_VALUE = 0; // valor especial para N/P (no presentado)

// Colores fijos por clave de componente conocida
const KEY_COLORS = {
    EJERCICIO:    '#16a34a',  // verde
    CATEDRA:      '#8b5cf6',  // morado
    EXAMEN:       '#dc2626',  // rojo
    LABORATORIO:  '#0d9488',
    TALLER:       '#f97316',
    PROYECTO:     '#3b82f6',
    INFORME:      '#d97706',
    CONTROL:      '#6366f1',
};

// Colores para componentes sin key conocida
const COMP_COLORS = ['#f97316','#3b82f6','#16a34a','#dc2626','#8b5cf6','#0d9488','#d97706'];

/**
 * Estado temporal del editor.
 * componentes: [ { key, label, peso, color, subs: [{nombre, porcentaje}] } ]
 */
let editorPlantilla = { id: null, nombre: '', componentes: [], umbralEximen: 5.5, examenObligatorio: false };

async function abrirEditorPlantilla(plantillaId) {
    $('#tituloModalRamo').textContent = plantillaId ? '✏ Editar Ramo' : '📘 Nuevo Ramo';
    if (plantillaId) {
        const p = await obtenerPlantilla(plantillaId);
        editorPlantilla = {
            id: p.id,
            nombre: p.nombre,
            umbralEximen:      5.5,
            examenObligatorio: p.examenObligatorio ?? false,
            componentes: JSON.parse(JSON.stringify(p.componentes)) // deep copy
        };
    } else {
        // Plantilla por defecto inspirada en la imagen
        editorPlantilla = {
            id: null,
            nombre: '',
            umbralEximen: 5.5,
            examenObligatorio: false,
            componentes: [
                {
                    key: 'EJERCICIO', label: 'Ejercicios', peso: 30, color: '#16a34a',
                    subs: [
                        { nombre: 'Ejercicio 1', porcentaje: 25 },
                        { nombre: 'Ejercicio 2', porcentaje: 25 },
                        { nombre: 'Ejercicio 3', porcentaje: 25 },
                        { nombre: 'Ejercicio 4', porcentaje: 25 }
                    ]
                },
                {
                    key: 'CATEDRA', label: 'Cátedra', peso: 45, color: '#8b5cf6',
                    subs: [
                        { nombre: 'Cátedra Diagnóstico', porcentaje: 0 },
                        { nombre: 'Cátedra 1',           porcentaje: 33.33 },
                        { nombre: 'Cátedra 2',           porcentaje: 33.33 },
                        { nombre: 'Cátedra 3',           porcentaje: 33.33 },
                        { nombre: 'Cátedra Recuperativa',porcentaje: 0 }
                    ]
                },
                {
                    key: 'EXAMEN', label: 'Examen', peso: 25, color: '#dc2626',
                    subs: [{ nombre: 'Examen', porcentaje: 100 }]
                }
            ]
        };
    }

    $('#inputNombreRamo').value = editorPlantilla.nombre;
    $('#editExamenObligatorio').checked = editorPlantilla.examenObligatorio;
    renderEditorCompleto();
    openModal('modalEditarRamo');
}

function renderEditorCompleto() {
    const container = $('#plantillaEditor');
    container.innerHTML = '';
    editorPlantilla.componentes.forEach((comp, ci) => renderComponenteEditor(container, comp, ci));
    actualizarTotalPesosComps();
}

function renderComponenteEditor(container, comp, ci) {
    const div = document.createElement('div');
    div.className = 'comp-editor-block';
    div.dataset.ci = ci;
    div.style.borderLeftColor = comp.color || COMP_COLORS[ci % COMP_COLORS.length];

    div.innerHTML = `
        <div class="comp-editor-header">
            <div class="comp-editor-title-row">
                <input type="text" class="input input-sm comp-label"
                    value="${comp.label}" placeholder="Nombre componente">
                <div class="peso-input-wrap">
                    <span class="peso-label">Peso:</span>
                    <input type="number" class="input input-sm comp-peso"
                        value="${comp.peso}" min="0" max="100" step="1">
                    <span>%</span>
                </div>
            </div>
            <button class="btn btn-danger-ghost btn-sm comp-del" ${editorPlantilla.componentes.length <= 1 ? 'disabled' : ''}>✕ Eliminar componente</button>
        </div>

        <div class="subs-list">
            ${comp.subs.map((sub, si) => renderSubRow(ci, si, sub)).join('')}
        </div>

        <div class="subs-footer">
            <button class="btn btn-ghost btn-sm add-sub">＋ Agregar evaluación</button>
            <span class="subs-total-label">
                Total: <strong class="subs-total-val">${calcularTotalSubs(comp.subs)}%</strong>
                <span class="badge badge-success subs-ok" style="${Math.abs(calcularTotalSubs(comp.subs)-100)<0.01?'':'display:none'}">✓</span>
                <span class="badge badge-error subs-err" style="${Math.abs(calcularTotalSubs(comp.subs)-100)<0.01?'display:none':''}">⚠</span>
            </span>
        </div>
    `;

    // Eventos del componente
    div.querySelector('.comp-label').addEventListener('input', e => {
        editorPlantilla.componentes[ci].label = e.target.value;
    });
    div.querySelector('.comp-peso').addEventListener('input', e => {
        editorPlantilla.componentes[ci].peso = parseFloat(e.target.value) || 0;
        actualizarTotalPesosComps();
    });
    div.querySelector('.comp-del').addEventListener('click', async () => {
        if (editorPlantilla.componentes.length <= 1) return;
        const ok = await confirmar('Eliminar componente', `¿Eliminar el componente "${comp.label}" y todas sus evaluaciones?`);
        if (!ok) return;
        editorPlantilla.componentes.splice(ci, 1);
        renderEditorCompleto();
    });
    div.querySelector('.add-sub').addEventListener('click', () => {
        editorPlantilla.componentes[ci].subs.push({ nombre: 'Nueva evaluación', porcentaje: 0 });
        renderEditorCompleto();
    });

    // Eventos de subs
    div.querySelectorAll('.sub-row').forEach((row, si) => {
        row.querySelector('.sub-nombre').addEventListener('input', e => {
            editorPlantilla.componentes[ci].subs[si].nombre = e.target.value;
        });
        row.querySelector('.sub-pct').addEventListener('input', e => {
            editorPlantilla.componentes[ci].subs[si].porcentaje = parseFloat(e.target.value) || 0;
            actualizarTotalSubsEnBloque(div, editorPlantilla.componentes[ci].subs);
        });
        row.querySelector('.sub-del').addEventListener('click', async () => {
            if (editorPlantilla.componentes[ci].subs.length <= 1) return;
            // Si la plantilla ya existe, advertir que se borran notas de todos los alumnos
            const nomSub = editorPlantilla.componentes[ci].subs[si].nombre;
            const ok = await confirmar('Eliminar evaluación', `¿Eliminar "${nomSub}"? Las notas de esta evaluación se borrarán para todos los alumnos.`);
            if (!ok) return;
            // Marcar para borrado posterior (si ya existe en DB)
            if (editorPlantilla.id) {
                await eliminarNotasDeSub(editorPlantilla.id, comp.key, nomSub);
            }
            editorPlantilla.componentes[ci].subs.splice(si, 1);
            renderEditorCompleto();
        });
    });

    // Botón agregar componente (solo en el último bloque)
    container.appendChild(div);

    // Si es el último componente, agregar botón "Agregar componente" al final
    if (ci === editorPlantilla.componentes.length - 1) {
        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-ghost';
        addBtn.style.cssText = 'margin-top:8px;width:100%;justify-content:center;';
        addBtn.textContent = '＋ Agregar componente';
        addBtn.addEventListener('click', () => {
            const nuevoKey = 'COMP_' + Date.now();
            editorPlantilla.componentes.push({
                key:   nuevoKey,
                label: 'Nuevo componente',
                peso:  0,
                color: COMP_COLORS[editorPlantilla.componentes.length % COMP_COLORS.length],
                subs:  [{ nombre: 'Evaluación 1', porcentaje: 100 }]
            });
            renderEditorCompleto();
        });
        container.appendChild(addBtn);
    }
}

function renderSubRow(ci, si, sub) {
    return `
        <div class="sub-row">
            <input type="text" class="input input-sm sub-nombre" value="${sub.nombre}" placeholder="Nombre evaluación">
            <div class="peso-input-wrap">
                <input type="number" class="input input-sm input-pct sub-pct"
                    value="${sub.porcentaje}" min="0" max="100" step="0.01" placeholder="%">
                <span>%</span>
            </div>
            <button class="btn btn-danger-ghost btn-sm sub-del" title="Eliminar">✕</button>
        </div>
    `;
}

function calcularTotalSubs(subs) {
    return Math.round(subs.reduce((s, sub) => s + (parseFloat(sub.porcentaje) || 0), 0) * 100) / 100;
}

function actualizarTotalSubsEnBloque(bloque, subs) {
    const total = calcularTotalSubs(subs);
    const ok    = Math.abs(total - 100) < 0.01;
    bloque.querySelector('.subs-total-val').textContent = total + '%';
    bloque.querySelector('.subs-ok').style.display  = ok ? '' : 'none';
    bloque.querySelector('.subs-err').style.display = ok ? 'none' : '';
}

function actualizarTotalPesosComps() {
    const total = editorPlantilla.componentes.reduce((s, c) => s + (parseFloat(c.peso) || 0), 0);
    const ok    = Math.abs(total - 100) < 0.01;
    $('#pesosCompTotalVal').textContent    = Math.round(total * 100) / 100;
    $('#pesosCompOk').style.display        = ok ? '' : 'none';
    $('#pesosCompError').style.display     = ok ? 'none' : '';
}

// Guardar plantilla
$('#btnGuardarPlantilla').addEventListener('click', async () => {
    const nombre = $('#inputNombreRamo').value.trim();
    if (!nombre) { toast('Ingresa un nombre para el ramo', 'error'); return; }

    // Validar pesos de componentes
    if (!validarPesosComponentes(editorPlantilla.componentes)) {
        toast('Los pesos de los componentes deben sumar 100%', 'error'); return;
    }
    // Validar que cada componente tenga al menos una sub
    for (const comp of editorPlantilla.componentes) {
        if (comp.subs.length === 0) {
            toast(`El componente "${comp.label}" necesita al menos una evaluación`, 'error'); return;
        }
        // Advertir (no bloquear) si subs no suman 100
        if (!validarPorcentajesSubs(comp.subs)) {
            toast(`⚠ Los porcentajes de "${comp.label}" no suman 100%. Se guardará igual.`, 'warning');
        }
    }

    editorPlantilla.nombre            = nombre;
    editorPlantilla.umbralEximen      = 5.5;
    editorPlantilla.examenObligatorio = $('#editExamenObligatorio').checked;
    const payload = {
        nombre:            editorPlantilla.nombre,
        componentes:       editorPlantilla.componentes,
        umbralEximen:      editorPlantilla.umbralEximen,
        examenObligatorio: editorPlantilla.examenObligatorio
    };

    try {
        if (editorPlantilla.id) {
            await actualizarPlantilla({ ...payload, id: editorPlantilla.id, fechaCreacion: sesion.plantilla?.fechaCreacion });
            toast(`Ramo "${nombre}" actualizado`, 'success');
            // Recargar si es el ramo activo
            if (sesion.plantillaId === editorPlantilla.id) {
                sesion.plantilla = await obtenerPlantilla(editorPlantilla.id);
                await mostrarNotas();
            }
        } else {
            await crearPlantilla(nombre, editorPlantilla.componentes, {
                umbralEximen:      editorPlantilla.umbralEximen,
                examenObligatorio: editorPlantilla.examenObligatorio
            });
            toast(`Ramo "${nombre}" creado`, 'success');
        }
        closeModal('modalEditarRamo');
        await cargarSelectPlantillas();
    } catch(err) { toast('Error: ' + err.message, 'error'); }
});

// ══════════════════════════════════════
//  TABLA DE NOTAS
// ══════════════════════════════════════

async function mostrarNotas() {
    const { usuarioId, plantillaId, plantilla } = sesion;
    if (!usuarioId || !plantillaId || !plantilla) return;

    const notasAlumno = await obtenerNotasPorUsuarioPlantilla(usuarioId, plantillaId);

    // Badges
    $('#ramoNombreBadge').textContent  = plantilla.nombre;
    const usuarios = await obtenerUsuarios();
    const u = usuarios.find(u => u.id === usuarioId);
    $('#alumnoNombreBadge').textContent = u ? u.nombre : '';

    renderizarTabla(plantilla, notasAlumno);
    actualizarResumen(plantilla, notasAlumno);
    actualizarHintsEximen(plantilla, notasAlumno);

    $('#notasSection').style.display = '';
    $('#emptyState').style.display   = 'none';
}

function renderizarTabla(plantilla, notasAlumno) {
    const tbody = $('#tablaNotas');
    tbody.innerHTML = '';

    for (const comp of plantilla.componentes) {
        const promComp = calcularPromedioComponente(comp, notasAlumno);
        const rowspan = comp.subs.length + 1;

        // Detectar subs N/P para reasignar porcentaje a recuperativa
        const recuperativa = comp.subs.find(s =>
            /recuperat/i.test(s.nombre) && (s.porcentaje === 0)
        );
        let pctReasignado = 0;
        if (recuperativa) {
            for (const sub of comp.subs) {
                if (sub === recuperativa) continue;
                const reg = notasAlumno.find(n => n.compKey === comp.key && n.subNombre === sub.nombre);
                if (reg && reg.nota === NP_VALUE) pctReasignado += (sub.porcentaje || 0);
            }
        }

        comp.subs.forEach((sub, si) => {
            const notaReg  = notasAlumno.find(n => n.compKey === comp.key && n.subNombre === sub.nombre);
            const esNP     = notaReg && notaReg.nota === NP_VALUE;
            const notaVal  = (notaReg && !esNP) ? notaReg.nota : null;
            // Porcentaje efectivo: si es la recuperativa, sumar el reasignado
            const esRecup  = sub === recuperativa;
            const pct      = esRecup ? (sub.porcentaje + pctReasignado) : (sub.porcentaje || 0);
            const contrib  = (notaVal !== null && pct > 0) ? redondear(notaVal * (pct / 100)) : '—';

            const tr = document.createElement('tr');
            tr.className = si === 0 ? 'primera-sub' : '';
            if (esNP) tr.classList.add('fila-np');

            if (si === 0) {
                const tdComp = document.createElement('td');
                tdComp.rowSpan = rowspan;
                tdComp.className = 'td-componente';
                tdComp.innerHTML = `
                    <div class="comp-badge" style="--comp-color:${KEY_COLORS[comp.key] || comp.color || COMP_COLORS[0]}">
                        <span class="comp-badge-label">${comp.label.toUpperCase()}</span>
                        <span class="comp-badge-peso">${comp.peso}%</span>
                    </div>
                `;
                tr.appendChild(tdComp);
            }

            // Sub nombre
            const tdSub = document.createElement('td');
            tdSub.textContent = sub.nombre;
            tr.appendChild(tdSub);

            // % parcial (dinámico si es recuperativa)
            const tdPct = document.createElement('td');
            tdPct.className = 'td-center pct-cell';
            tdPct.dataset.compKey   = comp.key;
            tdPct.dataset.subNombre = sub.nombre;
            tdPct.textContent = pct > 0 ? pct + '%' : '—';
            tr.appendChild(tdPct);

            // Celda de nota: input + checkbox N/P
            const tdNota = document.createElement('td');
            tdNota.style.cssText = 'vertical-align:middle;';

            if (!esNP) {
                const inp = document.createElement('input');
                inp.type = 'number'; inp.min = '1'; inp.max = '7'; inp.step = '0.1';
                inp.className = 'input-nota';
                inp.placeholder = '—';
                if (notaVal !== null) inp.value = notaVal;
                inp.dataset.compKey   = comp.key;
                inp.dataset.subNombre = sub.nombre;
                inp.addEventListener('input', () => {
                    const notasDOM = leerNotasDesdeDOM();
                    actualizarResumen(sesion.plantilla, notasDOM);
                    actualizarFilasPonderado(sesion.plantilla, notasDOM);
                    actualizarHintsEximen(sesion.plantilla, notasDOM);
                });
                inp.addEventListener('change', () => guardarNotaDesdeInput(inp));
                tdNota.appendChild(inp);
                if (comp.key !== 'EXAMEN' && (sub.porcentaje || 0) > 0 && !esRecup) {
                    const hintEl = document.createElement('div');
                    hintEl.className = 'exim-hint';
                    hintEl.dataset.hintComp = comp.key;
                    hintEl.dataset.hintSub  = sub.nombre;
                    tdNota.appendChild(hintEl);
                }
            } else {
                const npBadge = document.createElement('span');
                npBadge.className = 'np-badge';
                npBadge.textContent = 'N/P';
                tdNota.appendChild(npBadge);
            }

            // Botón N/P solo para subs con porcentaje > 0 no recuperativas y no EXAMEN
            if (comp.key !== 'EXAMEN' && (sub.porcentaje || 0) > 0 && !esRecup) {
                const npBtn = document.createElement('button');
                npBtn.className = 'btn-np' + (esNP ? ' btn-np--active' : '');
                npBtn.title = esNP ? 'Quitar N/P' : 'Marcar N/P';
                npBtn.textContent = esNP ? '↩' : 'N/P';
                npBtn.addEventListener('click', async () => {
                    const nuevaNota = esNP ? null : NP_VALUE;
                    await guardarNota(sesion.usuarioId, sesion.plantillaId, comp.key, sub.nombre, nuevaNota);
                    const notasAct = await obtenerNotasPorUsuarioPlantilla(sesion.usuarioId, sesion.plantillaId);
                    renderizarTabla(sesion.plantilla, notasAct);
                    actualizarResumen(sesion.plantilla, notasAct);
                    actualizarHintsEximen(sesion.plantilla, notasAct);
                });
                tdNota.appendChild(npBtn);
            }

            tr.appendChild(tdNota);

            // Ponderado
            const tdPond = document.createElement('td');
            tdPond.className = 'td-center ponderado-cell';
            tdPond.textContent = esNP ? 'N/P' : contrib;
            if (esNP) tdPond.style.color = 'var(--text-secondary)';
            tr.appendChild(tdPond);

            tbody.appendChild(tr);
        });

        // Fila total del componente
        const trTotal = document.createElement('tr');
        trTotal.className = 'fila-total';
        trTotal.innerHTML = `
            <td style="text-align:right;color:var(--text-secondary);font-size:0.82rem;">Promedio componente</td>
            <td class="td-center"></td>
            <td class="td-center"><strong>${redondear(promComp)}</strong></td>
            <td class="td-center" style="color:var(--text-muted);font-size:0.8rem;">${comp.peso}% NF</td>
        `;
        tbody.appendChild(trTotal);
    }
}

/** Lee las notas actuales directamente del DOM (sin ir a la BD) */
function leerNotasDesdeDOM() {
    const notas = [];
    // Inputs normales de nota
    $('#tablaNotas').querySelectorAll('.input-nota').forEach(inp => {
        const val = inp.value !== '' ? parseFloat(inp.value) : null;
        notas.push({ compKey: inp.dataset.compKey, subNombre: inp.dataset.subNombre, nota: val });
    });
    // Subs marcadas como N/P (botón activo)
    $('#tablaNotas').querySelectorAll('.btn-np--active').forEach(btn => {
        const tr = btn.closest('tr');
        const inp = tr?.querySelector('.input-nota');
        if (inp) {
            // Ya está incluido arriba, reemplazar su valor con NP_VALUE
            const entry = notas.find(n => n.compKey === inp.dataset.compKey && n.subNombre === inp.dataset.subNombre);
            if (entry) entry.nota = NP_VALUE;
        }
    });
    // También leer los np-badge (filas ya guardadas como N/P sin input)
    $('#tablaNotas').querySelectorAll('.np-badge').forEach(badge => {
        const tr = badge.closest('tr');
        const npBtn = tr?.querySelector('.btn-np--active');
        if (npBtn) {
            // Extraer compKey/subNombre del botón de desmarcar (hermano del badge)
            const tdNota = badge.closest('td');
            const inp = tdNota?.querySelector('.input-nota');
            // Si no hay input (fila N/P renderizada), buscamos datos del hint o del btn
            // Los datos están en la fila — buscar el exim-hint si existe
            const hint = tdNota?.querySelector('.exim-hint');
            if (hint) {
                const exists = notas.find(n => n.compKey === hint.dataset.hintComp && n.subNombre === hint.dataset.hintSub);
                if (!exists) notas.push({ compKey: hint.dataset.hintComp, subNombre: hint.dataset.hintSub, nota: NP_VALUE });
                else exists.nota = NP_VALUE;
            }
        }
    });
    return notas;
}

/** Actualiza los hints de nota mínima para eximirse en cada sub vacía */
function actualizarHintsEximen(plantilla, notasAlumno) {
    const hayNotas = notasAlumno.some(n => n.nota != null);

    $('#tablaNotas').querySelectorAll('.exim-hint').forEach(hint => {
        const compKey   = hint.dataset.hintComp;
        const subNombre = hint.dataset.hintSub;
        const inp = hint.previousElementSibling;

        // Si el campo tiene nota o no hay ninguna nota en la tabla, ocultar hint
        if ((inp && inp.value !== '') || !hayNotas) {
            hint.textContent = '';
            hint.className   = 'exim-hint';
            return;
        }

        const min = calcularNotaParaEximirseEnSub(plantilla, notasAlumno, compKey, subNombre);
        if (min === null) { hint.textContent = ''; return; }

        if (min <= 1.0) {
            hint.textContent = '✓ libre';
            hint.className   = 'exim-hint exim-hint--ok';
        } else {
            // Capamos en 7.0: si es imposible igual mostramos 7.0 como meta máxima
            const target = Math.min(Math.ceil(min * 10) / 10, 7.0);
            hint.textContent = `≥ ${target.toFixed(1)}`;
            hint.className   = min > 7.0 ? 'exim-hint exim-hint--impossible' : 'exim-hint';
        }
    });
}

async function guardarNotaDesdeInput(inp) {
    const compKey   = inp.dataset.compKey;
    const subNombre = inp.dataset.subNombre;
    const valor     = inp.value !== '' ? parseFloat(inp.value) : null;

    if (valor !== null && (valor < 1.0 || valor > 7.0)) {
        inp.classList.add('invalid');
        toast('Nota debe estar entre 1.0 y 7.0', 'error');
        return;
    }
    inp.classList.remove('invalid');

    await guardarNota(sesion.usuarioId, sesion.plantillaId, compKey, subNombre, valor);

    // Recalcular solo resumen (sin re-renderizar toda la tabla para no perder foco)
    const notasActualizadas = await obtenerNotasPorUsuarioPlantilla(sesion.usuarioId, sesion.plantillaId);
    actualizarResumen(sesion.plantilla, notasActualizadas);
    actualizarFilasPonderado(sesion.plantilla, notasActualizadas);
    actualizarHintsEximen(sesion.plantilla, notasActualizadas);
}

/** Actualiza solo las celdas de ponderado y promedio sin re-renderizar la tabla */
function actualizarFilasPonderado(plantilla, notasAlumno) {
    const inputs = $('#tablaNotas').querySelectorAll('.input-nota');
    inputs.forEach(inp => {
        const compKey   = inp.dataset.compKey;
        const subNombre = inp.dataset.subNombre;
        const comp      = plantilla.componentes.find(c => c.key === compKey);
        if (!comp) return;
        const sub      = comp.subs.find(s => s.nombre === subNombre);
        if (!sub) return;
        const nota = inp.value !== '' ? parseFloat(inp.value) : null;
        const pond = (nota !== null && sub.porcentaje > 0) ? redondear(nota * (sub.porcentaje / 100)) : '—';
        const tdPond = inp.closest('tr')?.querySelector('.ponderado-cell');
        if (tdPond) tdPond.textContent = pond;
    });

    // Actualizar promedios de cada componente
    const filasTotal = $('#tablaNotas').querySelectorAll('.fila-total');
    filasTotal.forEach((fila, i) => {
        if (!plantilla.componentes[i]) return;
        const prom = calcularPromedioComponente(plantilla.componentes[i], notasAlumno);
        const tdStrong = fila.querySelector('strong');
        if (tdStrong) tdStrong.textContent = redondear(prom);
    });
}

// ══════════════════════════════════════
//  RESUMEN Y GRÁFICO
// ══════════════════════════════════════
function actualizarResumen(plantilla, notasAlumno) {
    const umbralEfectivo = 5.5;
    const nf             = calcularNotaFinal(plantilla, notasAlumno, umbralEfectivo);
    const exime          = determinarEximen(plantilla, notasAlumno, umbralEfectivo);
    const estado = determinarEstado(nf);

    // Stats dinámicos
    const statsList = $('#statsListDynamic');
    statsList.innerHTML = '';

    plantilla.componentes.forEach((comp, i) => {
        const prom = calcularPromedioComponente(comp, notasAlumno);
        const row  = document.createElement('div');
        row.className = 'stat-row';
        row.innerHTML = `
            <span class="stat-label" style="display:flex;align-items:center;gap:6px;">
                <span style="width:10px;height:10px;border-radius:50%;background:${KEY_COLORS[comp.key] || comp.color || COMP_COLORS[i%COMP_COLORS.length]};flex-shrink:0;"></span>
                ${comp.label} <span style="opacity:0.5;font-size:0.78rem;">(${comp.peso}%)</span>
            </span>
            <span class="stat-value">${redondear(prom)}</span>
        `;
        statsList.appendChild(row);
    });

    // Promedio parcial
    const pp = calcularPromedioParcial(plantilla, notasAlumno);
    const divider = document.createElement('div');
    divider.style.cssText = 'border-top:1px solid var(--border);margin:8px 0;';
    statsList.appendChild(divider);

    const rowPP = document.createElement('div');
    rowPP.className = 'stat-row';
    rowPP.innerHTML = `
        <span class="stat-label">Promedio Parcial</span>
        <span class="stat-value highlight">${redondear(pp)}</span>
    `;
    statsList.appendChild(rowPP);

    const rowEx = document.createElement('div');
    rowEx.className = 'stat-row';
    const exencionLabel = plantilla.examenObligatorio
        ? 'Examen obligatorio'
        : `Exención <span style="opacity:0.6;font-size:0.78rem;">(≥${umbralEfectivo})</span>`;
    rowEx.innerHTML = `
        <span class="stat-label">${exencionLabel}</span>
        <span class="${exime ? 'badge badge-success' : (plantilla.examenObligatorio ? 'badge badge-error' : 'badge badge-warning')}">${plantilla.examenObligatorio ? '🔒 Requerido' : (exime ? '✅ Sí' : '❌ No')}</span>
    `;
    statsList.appendChild(rowEx);

    // Nota mínima necesaria en el examen para aprobar el ramo
    const compExamen = plantilla.componentes.find(c => c.key === 'EXAMEN');
    if (compExamen && !exime) {
        const minNota = calcularNotaMinimaExamen(plantilla, notasAlumno);
        if (minNota !== null) {
            const rowMin = document.createElement('div');
            rowMin.className = 'stat-row';
            let valorHtml;
            if (minNota > 7.0) {
                valorHtml = `<span class="stat-value stat-value--danger">Imposible</span>`;
            } else if (minNota <= 1.0) {
                valorHtml = `<span class="stat-value stat-value--success">Cualquiera</span>`;
            } else {
                const minRedondeada = Math.ceil(minNota * 10) / 10;
                valorHtml = `<span class="stat-value stat-value--warn">${minRedondeada}</span>`;
            }
            rowMin.innerHTML = `
                <span class="stat-label">Mín. examen para aprobar</span>
                ${valorHtml}
            `;
            statsList.appendChild(rowMin);
        }
    }

    // Nota final
    $('#notaFinalGrande').textContent = redondear(nf);
    const estadoEl = $('#estadoNota');
    estadoEl.textContent = estado;
    estadoEl.className   = 'estado-badge' +
        (estado === 'APROBADO' ? ' aprobado' : estado === 'REPROBADO' ? ' reprobado' : '');

}

// ══════════════════════════════════════
//  EXPORTAR
// ══════════════════════════════════════
$('#btnExportarDatos').addEventListener('click', async () => {
    const uid = sesion.usuarioId;
    if (!uid) { toast('Selecciona un alumno primero', 'error'); return; }
    try {
        const datos = await exportarDatos(uid);
        const json  = JSON.stringify(datos, null, 2);
        const blob  = new Blob([json], { type: 'application/json' });
        const url   = URL.createObjectURL(blob);
        const a     = document.createElement('a');
        a.href = url;
        a.download = `notas_${datos.usuario.nombre}_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast('Datos exportados', 'success');
    } catch(err) { toast('Error: ' + err.message, 'error'); }
});

// ══════════════════════════════════════
//  RESET
// ══════════════════════════════════════
function resetUI() {
    $('#notasSection').style.display = 'none';
    $('#emptyState').style.display   = '';
}
