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

let chartDistribucion = null;

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

// Colores para componentes
const COMP_COLORS = ['#f97316','#3b82f6','#16a34a','#dc2626','#8b5cf6','#0d9488','#d97706'];

/**
 * Estado temporal del editor.
 * componentes: [ { key, label, peso, color, subs: [{nombre, porcentaje}] } ]
 */
let editorPlantilla = { id: null, nombre: '', componentes: [], umbralEximen: 5.0, examenObligatorio: false };

async function abrirEditorPlantilla(plantillaId) {
    $('#tituloModalRamo').textContent = plantillaId ? '✏ Editar Ramo' : '📘 Nuevo Ramo';
    if (plantillaId) {
        const p = await obtenerPlantilla(plantillaId);
        editorPlantilla = {
            id: p.id,
            nombre: p.nombre,
            umbralEximen:      p.umbralEximen      ?? 5.0,
            examenObligatorio: p.examenObligatorio ?? false,
            componentes: JSON.parse(JSON.stringify(p.componentes)) // deep copy
        };
    } else {
        // Plantilla por defecto inspirada en la imagen
        editorPlantilla = {
            id: null,
            nombre: '',
            umbralEximen: 5.0,
            examenObligatorio: false,
            componentes: [
                {
                    key: 'EJERCICIO', label: 'Ejercicios', peso: 30, color: '#6366f1',
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
                    key: 'EXAMEN', label: 'Examen', peso: 25, color: '#22c55e',
                    subs: [{ nombre: 'Examen', porcentaje: 100 }]
                }
            ]
        };
    }

    $('#inputNombreRamo').value = editorPlantilla.nombre;
    $('#editUmbralEximen').value        = editorPlantilla.umbralEximen;
    $('#editExamenObligatorio').checked = editorPlantilla.examenObligatorio;
    $('#editUmbralEximen').disabled     = editorPlantilla.examenObligatorio;
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
$('#editExamenObligatorio').addEventListener('change', e => {
    $('#editUmbralEximen').disabled = e.target.checked;
});

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
    editorPlantilla.umbralEximen      = parseFloat($('#editUmbralEximen').value);
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

    $('#notasSection').style.display = '';
    $('#emptyState').style.display   = 'none';
}

function renderizarTabla(plantilla, notasAlumno) {
    const tbody = $('#tablaNotas');
    tbody.innerHTML = '';

    for (const comp of plantilla.componentes) {
        const promComp = calcularPromedioComponente(comp, notasAlumno);

        // Fila cabecera del componente (celda que abarca filas de subs + total)
        // Se construye con rowspan dinámico: subs + 1 (fila total)
        const rowspan = comp.subs.length + 1;

        comp.subs.forEach((sub, si) => {
            const notaReg  = notasAlumno.find(n => n.compKey === comp.key && n.subNombre === sub.nombre);
            const notaVal  = notaReg ? notaReg.nota : null;
            const pct      = sub.porcentaje;
            // Nota ponderada de esta sub dentro del componente (contribución al promedio comp)
            const contrib  = (notaVal !== null && pct > 0) ? redondear(notaVal * (pct / 100)) : '—';

            const tr = document.createElement('tr');
            tr.className = si === 0 ? 'primera-sub' : '';

            if (si === 0) {
                // Primera fila del componente: agregar celda cabecera con rowspan
                const tdComp = document.createElement('td');
                tdComp.rowSpan = rowspan;
                tdComp.className = 'td-componente';
                tdComp.innerHTML = `
                    <div class="comp-badge" style="--comp-color:${comp.color || '#6366f1'}">
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

            // % parcial
            const tdPct = document.createElement('td');
            tdPct.className = 'td-center';
            tdPct.textContent = pct > 0 ? pct + '%' : '—';
            tr.appendChild(tdPct);

            // Input nota
            const tdNota = document.createElement('td');
            const inp = document.createElement('input');
            inp.type = 'number'; inp.min = '1'; inp.max = '7'; inp.step = '0.1';
            inp.className = 'input-nota';
            inp.placeholder = '—';
            if (notaVal !== null) inp.value = notaVal;
            inp.dataset.compKey   = comp.key;
            inp.dataset.subNombre = sub.nombre;
            inp.addEventListener('change', () => guardarNotaDesdeInput(inp));
            inp.addEventListener('blur',   () => guardarNotaDesdeInput(inp));
            tdNota.appendChild(inp);
            tr.appendChild(tdNota);

            // Ponderado
            const tdPond = document.createElement('td');
            tdPond.className = 'td-center ponderado-cell';
            tdPond.textContent = contrib;
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
    const umbralEfectivo = plantilla.umbralEximen ?? 5.0;
    const nf             = calcularNotaFinal(plantilla, notasAlumno, umbralEfectivo);
    const exime          = determinarEximen(plantilla, notasAlumno, umbralEfectivo);
    const estado = determinarEstado(nf);

    // Stats dinámicos
    const statsList = $('#statsListDynamic');
    statsList.innerHTML = '';

    const chartLabels = [], chartData = [], chartColors = [], chartBorders = [];

    plantilla.componentes.forEach((comp, i) => {
        const prom = calcularPromedioComponente(comp, notasAlumno);
        const row  = document.createElement('div');
        row.className = 'stat-row';
        row.innerHTML = `
            <span class="stat-label" style="display:flex;align-items:center;gap:6px;">
                <span style="width:10px;height:10px;border-radius:50%;background:${comp.color || COMP_COLORS[i%COMP_COLORS.length]};flex-shrink:0;"></span>
                ${comp.label} <span style="opacity:0.5;font-size:0.78rem;">(${comp.peso}%)</span>
            </span>
            <span class="stat-value">${redondear(prom)}</span>
        `;
        statsList.appendChild(row);

        chartLabels.push(comp.label);
        chartData.push(prom || 0);
        chartColors.push((comp.color || COMP_COLORS[i%COMP_COLORS.length]) + 'cc');
        chartBorders.push(comp.color || COMP_COLORS[i%COMP_COLORS.length]);
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

    // Nota final
    $('#notaFinalGrande').textContent = redondear(nf);
    const estadoEl = $('#estadoNota');
    estadoEl.textContent = estado;
    estadoEl.className   = 'estado-badge' +
        (estado === 'APROBADO' ? ' aprobado' : estado === 'REPROBADO' ? ' reprobado' : '');

    actualizarGrafico(chartLabels, chartData, chartColors, chartBorders);
}

function actualizarGrafico(labels, data, colors, borders) {
    const ctx = document.getElementById('chartDistribucion');
    if (!ctx) return;

    if (chartDistribucion && chartDistribucion.data.labels.length !== labels.length) {
        chartDistribucion.destroy(); chartDistribucion = null;
    }
    if (chartDistribucion) {
        chartDistribucion.data.datasets[0].data = data;
        chartDistribucion.update('none');
        return;
    }
    chartDistribucion = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Promedio',
                data, backgroundColor: colors, borderColor: borders,
                borderWidth: 1, borderRadius: 6, maxBarThickness: 70
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(22,24,34,0.95)', titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8', borderColor: 'rgba(255,255,255,0.06)',
                    borderWidth: 1, cornerRadius: 8, padding: 12
                }
            },
            scales: {
                y: { beginAtZero: true, max: 7, ticks: { color: '#475569', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.04)' } },
                x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
            }
        }
    });
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
//  IMPORTAR DESDE PDF
// ══════════════════════════════════════

const COLORES_COMP_MAP = {
    EXAMEN:      '#16a34a',   // verde — aprobación
    CATEDRA:     '#3b82f6',   // azul  — conocimiento
    EJERCICIO:   '#f97316',   // naranja — práctica
    LABORATORIO: '#d97706',   // ámbar — laboratorio
    TALLER:      '#0d9488',   // teal  — taller
    PROYECTO:    '#8b5cf6',   // violeta — proyecto
    INFORME:     '#dc2626',   // rojo  — informe
    CONTROL:     '#ea580c',   // naranja oscuro — control
};

function toTitleCase(str) {
    const minors = new Set(['de','la','el','los','las','en','y','o','e','del','al']);
    return str.toLowerCase().split(' ').map((w, i) =>
        i === 0 || !minors.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w
    ).join(' ');
}

function agruparFilasPDF(items, tol = 5) {
    const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
    const rows = []; let cur = [], curY = null;
    for (const it of sorted) {
        if (curY === null || Math.abs(it.y - curY) <= tol) { cur.push(it); curY = curY ?? it.y; }
        else { if (cur.length) rows.push([...cur].sort((a,b) => a.x - b.x)); cur = [it]; curY = it.y; }
    }
    if (cur.length) rows.push(cur.sort((a,b) => a.x - b.x));
    return rows;
}

async function parsearPDFUDLA(file) {
    if (!window.pdfjsLib) throw new Error('pdf.js no está disponible.');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const ab  = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;

    let fullText = '', pondItems = null;

    for (let p = 1; p <= Math.min(pdf.numPages, 15); p++) {
        const page = await pdf.getPage(p);
        const tc   = await page.getTextContent();
        const vp   = page.getViewport({ scale: 1 });
        const pageTxt = tc.items.map(i => i.str).join(' ');
        fullText += pageTxt + '\n';
        if (!pondItems && /PONDERACIONES/i.test(pageTxt)) {
            pondItems = tc.items.filter(i => i.str?.trim()).map(i => ({
                str: i.str.trim(),
                x:   Math.round(i.transform[4]),
                y:   Math.round(vp.height - i.transform[5]),
            }));
        }
    }

    if (!pondItems)
        throw new Error('No se encontró la sección PONDERACIONES. ¿Es un programa de asignatura UDLA?');

    const siglaM  = fullText.match(/Sigla\s*:?\s*([A-Z]{2,5}\d{3,4})/i)
                 || fullText.match(/\b([A-Z]{2,4}\d{3,4})\b/);
    const nombreM = fullText.match(/Nombre\s*:?\s*([\wáéíóúÁÉÍÓÚñÑ\s,\-\/\.]+?)(?=\s*(?:Crédito|Credito|Vigencia|Jornada|Modalidad|Sigla))/i);
    const sigla   = siglaM?.[1] ?? '';
    const nombre  = (nombreM?.[1] ?? '').trim().replace(/\s+/g, ' ');

    // ── Exención de examen ─────────────────────────────────────────────────
    // Busca la sección "EXIMICIÓN DE EXAMEN"; si no existe → examen obligatorio
    const eximIdx = fullText.search(/EXIMICI[OÓ]N\s+DE\s+EXAMEN/i);
    let umbral    = 5.0;
    let examenObl = false;
    if (eximIdx < 0) {
        examenObl = true;   // no hay condición de exención declarada
    } else {
        const eximSlice = fullText.slice(eximIdx, eximIdx + 800);
        // Captura número decimal tipo "5,5" o "5.0" (primer número que aparezca)
        const numM = eximSlice.match(/\b(\d)[,\.](\d{1,2})\b/);
        umbral     = numM ? parseFloat(`${numM[1]}.${numM[2]}`) : 5.0;
    }

    const componentes = extraerComponentesPDF(pondItems);
    if (!componentes?.length)
        throw new Error('No se pudieron extraer los componentes de evaluación.');

    return {
        nombre:            sigla ? `${sigla} — ${nombre}` : nombre || file.name.replace(/\.pdf$/i, ''),
        umbralEximen:      umbral,
        examenObligatorio: examenObl,
        componentes,
    };
}

function extraerComponentesPDF(items) {
    // ══════════════════════════════════════════════════════════════════
    // Estrategia: clasificar ítems en 4 COLUMNAS exactas usando las
    // posiciones X del encabezado, luego emparejar por proximidad Y.
    // Esto resuelve el problema de celdas combinadas (rowspan) del PDF
    // donde el texto del componente aparece en el CENTRO vertical de
    // su celda, mientras los subcomponentes están arriba y abajo.
    // ══════════════════════════════════════════════════════════════════

    // ── 1. Localizar encabezado ──────────────────────────────────────
    const allRows = agruparFilasPDF(items, 12);
    let xComp = null, xSub = null, xPctComp = null, xPctSub = null, headerY = -1;

    outerH: for (let i = 0; i < allRows.length; i++) {
        for (let span = 1; span <= 4 && i + span - 1 < allRows.length; span++) {
            const win      = allRows.slice(i, i + span).flat();
            const compItem = win.find(w => /^componente$/i.test(w.str));
            const subItem  = win.find(w => /^subcomponente$/i.test(w.str));
            if (!compItem || !subItem || subItem.x <= compItem.x) continue;

            xComp = compItem.x;
            xSub  = subItem.x;

            // % Componente: busca "%" entre xComp y xSub en el header
            const pctMid = win.filter(w => /^%/.test(w.str) && w.x > compItem.x && w.x < subItem.x);
            xPctComp = pctMid.length
                ? Math.min(...pctMid.map(w => w.x))
                : Math.round(xComp + (xSub - xComp) * 0.6);

            // % Subcomponente: busca "%" a la derecha de xSub
            const pctRight = win.filter(w => /^%/.test(w.str) && w.x > subItem.x);
            xPctSub = pctRight.length
                ? Math.min(...pctRight.map(w => w.x))
                : xSub + Math.round((xSub - xComp) * 0.7);

            headerY = Math.max(...win.map(w => w.y));
            break outerH;
        }
    }
    if (xComp === null) return extraerPorTextoPDF(items);

    console.log(`📄 Columnas detectadas: xComp=${xComp} xPctComp=${xPctComp} xSub=${xSub} xPctSub=${xPctSub}`);

    // ── 2. Ítems válidos bajo el header ─────────────────────────────
    const STOP_RE = /7\.2|ESTRATEGIA|Nota\s*Informativa|Publicado|Metodolog/i;
    const SKIP_RE = /^Modalidad$|^Jornada$|^Ponderaci|^%|^TODOS$/i;

    const dataAll = items.filter(i => i.str.trim() && i.y > headerY + 2);
    let yStop = Infinity;
    for (const it of dataAll) {
        if (STOP_RE.test(it.str)) { yStop = Math.min(yStop, it.y); }
    }
    const valid = dataAll.filter(i => i.y < yStop && !SKIP_RE.test(i.str));

    // ── 3. Clasificar en 4 columnas por X ───────────────────────────
    // ┌─────────┬──────────┬──────────────────┬────────────┐
    // │  Col A  │  Col B   │      Col C       │   Col D    │
    // │ Comp.   │ % Comp.  │  Subcomponente   │ % Subcomp. │
    // │ nombre  │ (35,45…) │ (Cat. 1, Ej. 2…) │ (33.33, …) │
    // └─────────┴──────────┴──────────────────┴────────────┘
    const mg = 25; // margen de tolerancia en X
    const colA = valid.filter(i => i.x >= xComp    - mg && i.x < xPctComp);
    const colB = valid.filter(i => i.x >= xPctComp      && i.x < xSub - 5);
    const colC = valid.filter(i => i.x >= xSub     - mg && i.x < xPctSub - 5);
    const colD = valid.filter(i => i.x >= xPctSub  - 5);

    // ── 4. Agrupar cada columna por Y (tolerancia 13) ───────────────
    const rowsA = agruparFilasPDF(colA, 13);
    const rowsB = agruparFilasPDF(colB, 13);
    const rowsC = agruparFilasPDF(colC, 13);
    const rowsD = agruparFilasPDF(colD, 13);

    // Helper: fila más cercana en Y dentro de maxDist píxeles
    const rowNearest = (rows, y, maxDist = 20) =>
        rows.find(r => Math.abs(Math.min(...r.map(i => i.y)) - y) <= maxDist);

    // ── 5. PASADA 1 — Componentes (colA nombre + colB peso) ─────────
    const compEntries = [];
    for (const ra of rowsA) {
        const words = ra.filter(i => /^[A-ZÁÉÍÓÚÑ\/]{3,}$/.test(i.str));
        if (!words.length) continue;
        const name = words.map(i => i.str).join(' ');
        const rowY = Math.min(...ra.map(i => i.y));
        const rb   = rowNearest(rowsB, rowY);
        const num  = rb?.find(i => /^\d{1,3}(\.\d+)?$/.test(i.str));
        const peso = num ? parseFloat(num.str) : null;
        if (peso !== null && peso > 0 && peso <= 100 && !compEntries.some(c => c.name === name)) {
            compEntries.push({ name, peso, y: rowY });
        }
    }
    if (!compEntries.length) return extraerPorTextoPDF(items);

    // ── 6. PASADA 2 — Subcomponentes (colC nombre + colD %) ─────────
    const subEntries = [];
    for (const rc of rowsC) {
        const sNom = rc.map(i => i.str).join(' ').trim();
        if (!sNom) continue;
        const rowY = Math.min(...rc.map(i => i.y));
        const rd   = rowNearest(rowsD, rowY);
        const num  = rd?.find(i => /^\d+(\.\d+)?$/.test(i.str));
        const pct  = num !== undefined ? parseFloat(num.str) : 0;
        if (pct >= 0 && pct <= 100) {
            subEntries.push({ y: rowY, nombre: toTitleCase(sNom), porcentaje: pct });
        }
    }

    // ── 7. Asignar subs a componentes por Y-midpoint extendido ──────
    // Usamos 80% del gap hacia el siguiente componente (en vez de 50%)
    // para compensar que el texto del componente aparece en el CENTRO
    // de la celda combinada, mientras sus subs pueden estar más arriba.
    compEntries.sort((a, b) => a.y - b.y);
    const componentes = compEntries.map((ce, idx) => {
        const prevY  = idx > 0 ? compEntries[idx - 1].y : -Infinity;
        const nextY  = idx < compEntries.length - 1 ? compEntries[idx + 1].y : Infinity;
        const yFrom  = prevY === -Infinity ? -Infinity : (prevY + ce.y) / 2;
        const yTo    = nextY === Infinity  ? Infinity  : ce.y + (nextY - ce.y) * 0.8;
        const key    = ce.name.replace(/\s+/g, '_');
        return {
            key,
            label: toTitleCase(ce.name),
            peso:  ce.peso,
            color: COLORES_COMP_MAP[key.split('_')[0]] ?? COMP_COLORS[idx % COMP_COLORS.length],
            subs:  subEntries.filter(s => s.y >= yFrom && s.y < yTo),
        };
    });

    console.groupCollapsed('📄 PDF Parser — resultado final');
    componentes.forEach(c => {
        console.log(`[${c.peso}%] ${c.label}: ${c.subs.length} evaluaciones`);
        c.subs.forEach(s => console.log(`   • ${s.nombre}: ${s.porcentaje}%`));
    });
    console.groupEnd();

    return componentes.length ? componentes : extraerPorTextoPDF(items);
}

// Fallback: detección por texto cuando la posición no funciona
function extraerPorTextoPDF(items) {
    const COMPS  = ['EJERCICIO','CATEDRA','EXAMEN','LABORATORIO','TALLER','PROYECTO','INFORME','CONTROL'];
    const reComp = new RegExp(`^(${COMPS.join('|')})(\\s+(\\d{1,3}))?$`, 'i');
    const lineas = agruparFilasPDF(items, 6).map(r => r.map(i => i.str).join(' ')).filter(Boolean);
    const componentes = [];
    let cur = null, inPond = false;

    for (const linea of lineas) {
        if (/PONDERACIONES/i.test(linea)) { inPond = true; continue; }
        if (!inPond) continue;
        if (/7\.2|ESTRATEGIA|Nota Informativa/i.test(linea)) break;

        const cm = linea.match(reComp);
        if (cm && cm[3]) {
            const name      = cm[1].toUpperCase();
            const peso      = parseFloat(cm[3]);
            // Evitar crear duplicado: p.ej. "EXAMEN 100" no debe crear nuevo componente si ya existe EXAMEN
            const yaExiste  = componentes.some(c => c.key === name);
            if (peso > 0 && peso <= 100 && !yaExiste) {
                cur = {
                    key: name, label: toTitleCase(name), peso,
                    color: COLORES_COMP_MAP[name] ?? COMP_COLORS[componentes.length % COMP_COLORS.length],
                    subs: [],
                };
                componentes.push(cur);
                continue;
            }
            // Si ya existe, redirigir cur a ese componente para que los subs vayan bien
            if (yaExiste) { cur = componentes.find(c => c.key === name); continue; }
        }

        if (cur) {
            // Línea tipo "NOMBRE QUALIFIER 33.33" o "NOMBRE 100"
            // El ÚLTIMO número de la línea es el porcentaje; el resto es el nombre
            const sm = linea.match(/^(.+?)\s+([\d]+(?:\.\d+)?)$/);
            if (sm) {
                const pct = parseFloat(sm[2]);
                if (pct >= 0 && pct <= 100)
                    cur.subs.push({ nombre: toTitleCase(sm[1].trim()), porcentaje: pct });
            }
        }
    }

    console.groupCollapsed('📄 PDF Parser (fallback) — resultado');
    componentes.forEach(c => {
        console.log(`[${c.peso}%] ${c.label}:`);
        c.subs.forEach(s => console.log(`   ${s.nombre}: ${s.porcentaje}%`));
    });
    console.groupEnd();

    return componentes.length ? componentes : null;
}

$('#btnImportarPDF').addEventListener('click', () => {
    $('#inputPDF').value = '';
    $('#inputPDF').click();
});

$('#inputPDF').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const btn = $('#btnImportarPDF');
    const textoOriginal = btn.textContent;
    btn.textContent = '⏳ Leyendo...';
    btn.disabled = true;
    try {
        const datos = await parsearPDFUDLA(file);

        // ── Verificar colisión con ramos existentes ───────────────────
        const plantillas = await obtenerPlantillas();
        const existente  = plantillas.find(
            p => p.nombre.trim().toLowerCase() === datos.nombre.trim().toLowerCase()
        );

        let modoEdicion = false; // true = editar existente, false = crear nuevo
        if (existente) {
            const editarExistente = await confirmar(
                '⚠️ Ramo ya existe',
                `Ya existe un ramo llamado "${existente.nombre}".\n¿Deseas actualizar el existente con los datos del PDF, o crear uno nuevo?`,
                'Actualizar existente',
                false
            );
            modoEdicion = editarExistente;
        }

        closeModal('modalGestionRamos');
        editorPlantilla = {
            id:                modoEdicion ? existente.id : null,
            nombre:            datos.nombre,
            umbralEximen:      datos.umbralEximen,
            examenObligatorio: datos.examenObligatorio,
            componentes:       datos.componentes,
        };
        $('#tituloModalRamo').textContent   = modoEdicion ? '✏️ Actualizar desde PDF' : '📄 Revisar importación';
        $('#inputNombreRamo').value          = datos.nombre;
        $('#editUmbralEximen').value         = datos.umbralEximen;
        $('#editExamenObligatorio').checked  = datos.examenObligatorio;
        $('#editUmbralEximen').disabled      = datos.examenObligatorio;
        renderEditorCompleto();
        openModal('modalEditarRamo');
        const total = datos.componentes.reduce((s, c) => s + c.subs.length, 0);
        const sufijo = modoEdicion ? ' · editando existente' : ' · revisa antes de guardar';
        toast(`✅ ${datos.componentes.length} componentes · ${total} evaluaciones${sufijo}`, 'success');
    } catch (err) {
        toast('❌ ' + err.message, 'error');
    } finally {
        btn.textContent = textoOriginal;
        btn.disabled = false;
    }
});

// ══════════════════════════════════════
//  RESET
// ══════════════════════════════════════
function resetUI() {
    $('#notasSection').style.display = 'none';
    $('#emptyState').style.display   = '';
    if (chartDistribucion) { chartDistribucion.destroy(); chartDistribucion = null; }
}
