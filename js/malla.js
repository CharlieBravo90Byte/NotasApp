// Catálogo de la malla mostrada por el usuario. Los requisitos provienen solo
// de los programas disponibles; una ausencia no significa que el ramo sea libre.
const MALLA = [
    [1, 'CVE211', 'Zoología'], [1, null, 'Medio ambiente y gestión ambiental'],
    [1, 'CQU110', 'Química'], [1, 'CVE902', 'Formulación y evaluación de proyectos'],
    [2, 'CQU310', 'Bioquímica'], [2, 'CVE292', 'Anatomía del canino'], [2, 'AES519', 'Bioestadística'],
    [2, 'CBI329', 'Microbiología general y veterinaria'], [2, 'CVE221', 'Histoembriología'], [2, 'LCE001', 'Inglés I'],
    [3, 'CVE523', 'Inmunología', '(CVE-423 4,0) o (CBI-319 4,0 o CBI-329 4,0) o (CBI-420 4,0 y CBI-423 4,0)'],
    [3, 'CVE591', 'Fisiopatología', '(CVE-421 4,0) y (CVE-391 4,0 o CVE-221 4,0)'],
    [3, 'LCE002', 'Inglés II'], [3, 'CVE551', 'Tecnología de los alimentos', '(CBI-319 4,0 o CBI-329 4,0) o (CBI-420 4,0 o CBI-423 4,0) o (CVE-423 4,0)'],
    [3, 'CVE543', 'Reproducción e inseminación artificial', '(CVE-421 4,0)'],
    [4, 'CBI514', 'Genética'], [4, 'CVE833', 'Obstetricia y ginecología'], [4, 'CVE631', 'Farmacología y toxicología'],
    [4, 'CVE425', 'Enfermedades parasitarias'], [4, 'CVE633', 'Enfermedades infecciosas'], [4, 'CVE692', 'Patología de sistemas'],
    [5, 'CVE995', 'Producción bovinos carne y leche', '(CVE-833 4,0)'], [5, 'CVE732', 'Semiología', '(CVE-631 4,0)'],
    [5, 'CVE744', 'Producción porcina', '(CVE-543 4,0) y (CVE-3317 4,0)'], [5, 'CVE502', 'Etología y bienestar animal'], [5, 'CVE792', 'Laboratorio clínico'],
    [6, 'CVE651', 'Control de calidad de los alimentos'], [6, 'CVE835', 'Cirugía general'], [6, 'CVE892', 'Medicina de caninos'],
    [6, 'CVE805', 'Medicina de animales exóticos'], [6, 'CVE831', 'Medicina de animales mayores'], [6, 'CVE803', 'Medicina de felinos'],
    [7, 'CVE921', 'Metodología de la investigación'], [7, 'CVE834', 'Diagnóstico por imágenes'], [7, 'CVE936', 'Patología quirúrgica'],
    [7, 'CVE911', 'Práctica final'], [7, 'CVE752', 'Epidemiología veterinaria'], [7, 'CVE042', 'Producción acuícola'],
    [8, 'CVE934', 'Clínica de animales menores'], [8, 'CVE933', 'Clínica de animales mayores'],
    [8, 'CVE090', 'Trabajo de titulación'], [8, 'CVE935', 'Farmacología aplicada']
].map(([semestre, codigo, nombre, requisito]) => ({ semestre, codigo, nombre, requisito: requisito || null }));

function normalizarNombreMalla(valor) {
    return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s*-\s*NRC\s*\d+.*$/i, '').replace(/[^A-Z0-9]+/g, ' ').trim();
}
function codigoDePlantilla(p) {
    if (p.codigo) return p.codigo.toUpperCase().replace(/[-\s]/g, '');
    const nombreSinNrc = p.nombre.replace(/\bNRC\s*\d+/ig, '');
    const codigo = nombreSinNrc.match(/\b([A-Z]{2,5})\s*-?\s*(\d{3,4})\b/i);
    if (codigo) return (codigo[1] + codigo[2]).toUpperCase();
    return MALLA.find(r => normalizarNombreMalla(r.nombre) === normalizarNombreMalla(p.nombre))?.codigo || null;
}
function formatearNombreRamo(ramo) {
    const codigo = codigoDePlantilla(ramo);
    if (!codigo) return ramo.nombre;
    const partes = codigo.match(/^([A-Z]+)(\d+)$/);
    if (!partes) return `${codigo} · ${ramo.nombre}`;
    const expresion = new RegExp(`\\b${partes[1]}\\s*-?\\s*${partes[2]}\\b`, 'gi');
    const nombre = ramo.nombre.replace(expresion, '').replace(/^\s*[-–·:]\s*|\s*[-–·:]\s*$/g, '').trim();
    return nombre ? `${codigo} · ${nombre}` : codigo;
}

// Interpreta únicamente códigos, notas mínimas, paréntesis y los operadores y/o.
function interpretarRequisito(texto) {
    if (!texto) return null;
    const limpio = texto.toUpperCase().replace(/([A-Z]{2,5})\s*-\s*(\d{3,4})/g, '$1$2')
        .replace(/\b([A-Z]{2,5}\d{3,4})\s+APROBADO\b/g, '$1 4,0');
    const tokens = limpio.match(/[A-Z]{2,5}\d{3,4}|\d+[,.]\d+|[()]|\b[YO]\b/g) || [];
    if (limpio.replace(/[A-Z]{2,5}\d{3,4}|\d+[,.]\d+|[()]|\b[YO]\b|\s/g, '') || !tokens.length) return null;
    let i = 0;
    function factor() {
        if (tokens[i] === '(') { i++; const nodo = disyuncion(); if (tokens[i++] !== ')') throw Error(); return nodo; }
        const codigo = tokens[i++], nota = tokens[i++];
        if (!/^[A-Z]{2,5}\d{3,4}$/.test(codigo || '') || !/^\d+[,.]\d+$/.test(nota || '')) throw Error();
        return { codigo, nota: Number(nota.replace(',', '.')) };
    }
    function conjuncion() { let n = factor(); while (tokens[i] === 'Y') { i++; n = { operador: 'Y', izq: n, der: factor() }; } return n; }
    function disyuncion() { let n = conjuncion(); while (tokens[i] === 'O') { i++; n = { operador: 'O', izq: n, der: conjuncion() }; } return n; }
    try { const resultado = disyuncion(); return i === tokens.length ? resultado : null; } catch { return null; }
}
function evaluarRequisito(nodo, notas) {
    if (!nodo) return 'desconocido';
    if (nodo.codigo) return notas[nodo.codigo] == null ? 'desconocido' : notas[nodo.codigo] >= nodo.nota ? 'cumplido' : 'no cumplido';
    const a = evaluarRequisito(nodo.izq, notas), b = evaluarRequisito(nodo.der, notas);
    if (nodo.operador === 'Y') return a === 'no cumplido' || b === 'no cumplido' ? 'no cumplido' : a === 'cumplido' && b === 'cumplido' ? 'cumplido' : 'desconocido';
    return a === 'cumplido' || b === 'cumplido' ? 'cumplido' : a === 'no cumplido' && b === 'no cumplido' ? 'no cumplido' : 'desconocido';
}
function relacionConRequisito(nodo, codigo) {
    if (!nodo || !codigo) return { aparece: false, obligatorio: false };
    if (nodo.codigo) return { aparece: nodo.codigo === codigo, obligatorio: nodo.codigo === codigo };
    const a = relacionConRequisito(nodo.izq, codigo), b = relacionConRequisito(nodo.der, codigo);
    return { aparece: a.aparece || b.aparece, obligatorio: nodo.operador === 'Y' ? a.obligatorio || b.obligatorio : a.obligatorio && b.obligatorio };
}

// Mantener las relaciones confirmadas por el usuario incluso si existe una
// plantilla importada con requisitos adicionales.
function requisitoAplicable(destino, requisitoPlantilla) {
    if (!requisitoPlantilla) return destino.requisito;
    if (!destino.requisito) return requisitoPlantilla;
    if (['CVE732', 'CVE744'].includes(destino.codigo)) {
        return `(${destino.requisito}) y (${requisitoPlantilla})`;
    }
    return requisitoPlantilla;
}

// Comparte la misma fuente para la malla y el encabezado de notas.
function obtenerDependientes(codigo, plantillas) {
    if (!codigo) return [];
    const destinos = new Map(MALLA.filter(r => r.codigo).map(r => [r.codigo, { ...r }]));
    for (const plantilla of plantillas) {
        const destinoCodigo = codigoDePlantilla(plantilla);
        if (!destinoCodigo) continue;
        const previo = destinos.get(destinoCodigo);
        if (!previo) destinos.set(destinoCodigo, { codigo: destinoCodigo, nombre: plantilla.nombre, semestre: plantilla.semestre, requisito: plantilla.requisito || null });
        else if (plantilla.requisito) destinos.set(destinoCodigo, { ...previo, requisito: requisitoAplicable(previo, plantilla.requisito) });
    }
    return [...destinos.values()].filter(destino => destino.codigo !== codigo)
        .map(destino => ({ destino, relacion: relacionConRequisito(interpretarRequisito(destino.requisito), codigo) }))
        .filter(item => item.relacion.aparece)
        .sort((a, b) => (a.destino.semestre ?? Infinity) - (b.destino.semestre ?? Infinity) || a.destino.nombre.localeCompare(b.destino.nombre, 'es'));
}

// El árbol usa los mismos requisitos que el detalle de la malla.
function obtenerRamosArbol(plantillas) {
    const ramos = MALLA.filter(r => r.codigo).map(r => {
        const importado = plantillas.find(p => codigoDePlantilla(p) === r.codigo && p.requisito);
        return { ...r, requisito: requisitoAplicable(r, importado?.requisito) };
    });
    const codigos = new Set(ramos.map(r => r.codigo));
    for (const plantilla of plantillas) {
        const codigo = codigoDePlantilla(plantilla);
        if (!codigo) continue;
        if (codigos.has(codigo)) {
            const existente = ramos.find(r => r.codigo === codigo);
            if (!existente.requisito && plantilla.requisito && !MALLA.some(r => r.codigo === codigo)) existente.requisito = plantilla.requisito;
            continue;
        }
        codigos.add(codigo);
        ramos.push({ codigo, nombre: plantilla.nombre, semestre: plantilla.semestre, requisito: plantilla.requisito || null });
    }
    return ramos;
}

function dibujarArbolMalla(plantillas, notas) {
    const contenedor = $('#arbolMalla');
    contenedor.replaceChildren();
    const ramos = obtenerRamosArbol(plantillas);
    const porCodigo = new Map(ramos.map(r => [r.codigo, r]));
    const destinos = ramos.filter(r => r.requisito).sort((a, b) =>
        (a.semestre ?? Infinity) - (b.semestre ?? Infinity) || a.nombre.localeCompare(b.nombre, 'es'));
    if (!destinos.length) {
        contenedor.textContent = 'Todavía no hay requisitos conocidos para mostrar.';
        return;
    }
    function rama(nodo) {
        const lista = document.createElement('ul');
        lista.className = 'arbol-ramas';
        const item = document.createElement('li');
        if (nodo.codigo) {
            const ramo = porCodigo.get(nodo.codigo);
            const texto = document.createElement('span');
            texto.className = 'arbol-nodo';
            const nota = notas[nodo.codigo];
            texto.textContent = `${ramo ? formatearNombreRamo(ramo) : nodo.codigo + ' · Ramo fuera de la malla'}${ramo?.semestre ? ` (${ramo.semestre}.º sem.)` : ''} · mínimo ${nodo.nota.toFixed(1).replace('.', ',')}${nota != null ? ` · nota ${Number(nota).toFixed(1).replace('.', ',')}` : ' · sin nota'}`;
            item.appendChild(texto);
        } else {
            const operador = document.createElement('strong');
            operador.className = 'arbol-operador';
            operador.textContent = nodo.operador === 'Y' ? 'Y · ambos requisitos' : 'O · una de estas alternativas';
            item.append(operador, rama(nodo.izq), rama(nodo.der));
        }
        lista.appendChild(item);
        return lista;
    }
    for (const destino of destinos) {
        const tarjeta = document.createElement('article');
        tarjeta.className = 'arbol-destino';
        const cabecera = document.createElement('div'); cabecera.className = 'arbol-cabecera';
        const nombre = document.createElement('strong');
        nombre.textContent = `${destino.semestre ? `${destino.semestre}.º sem. · ` : ''}${formatearNombreRamo(destino)}`;
        const nodo = interpretarRequisito(destino.requisito);
        const estado = evaluarRequisito(nodo, notas);
        const etiqueta = document.createElement('span');
        etiqueta.className = 'badge ' + (estado === 'cumplido' ? 'badge-success' : estado === 'no cumplido' ? 'badge-error' : 'badge-warning');
        etiqueta.textContent = estado === 'cumplido' ? 'Requisito cumplido' : estado === 'no cumplido' ? 'Bloqueado por requisito' : 'Pendiente de verificar';
        cabecera.append(nombre, etiqueta); tarjeta.appendChild(cabecera);
        if (nodo) tarjeta.appendChild(rama(nodo));
        else {
            const detalle = document.createElement('p'); detalle.className = 'help-text';
            detalle.textContent = `Requisito por revisar: ${destino.requisito}`;
            tarjeta.appendChild(detalle);
        }
        contenedor.appendChild(tarjeta);
    }
}

$('#guardarHistorial').addEventListener('click', async () => {
    if (!sesion.usuarioId) { toast('Selecciona un alumno primero', 'error'); return; }
    const codigo = $('#codigoHistorial').value.toUpperCase().replace(/[\s-]/g, '');
    const entrada = $('#notaHistorial').value;
    const nota = entrada === '' ? null : Number(entrada);
    if (!/^[A-Z]{2,5}\d{3,4}$/.test(codigo) || (nota !== null && (!Number.isFinite(nota) || nota < 1 || nota > 7))) {
        toast('Ingresa un código válido y una nota entre 1 y 7', 'error'); return;
    }
    try {
        await guardarNotaHistorica(sesion.usuarioId, codigo, nota);
        $('#codigoHistorial').value = ''; $('#notaHistorial').value = '';
        $('#btnMalla').click();
    } catch (error) { toast('No se pudo guardar la nota: ' + error.message, 'error'); }
});

$('#btnMalla').addEventListener('click', async () => {
    const plantillas = await obtenerPlantillas(), porCodigo = new Map();
    const alumno = sesion.usuarioId ? (await obtenerUsuarios()).find(u => u.id === sesion.usuarioId) : null;
    const historicas = alumno?.notasHistoricas || {};
    const notas = { ...historicas };
    const adicionales = Object.entries(historicas).filter(([codigo]) => !MALLA.some(r => r.codigo === codigo));
    $('#historialAdicional').textContent = adicionales.length ? `Notas adicionales: ${adicionales.map(([codigo, nota]) => `${codigo}: ${nota}`).join(' · ')}. Para borrar una, ingresa el código con la nota vacía.` : 'Para borrar una nota adicional, ingresa el código y deja la nota vacía.';
    for (const p of plantillas) {
        const codigo = codigoDePlantilla(p);
        if (!codigo) continue;
        if (!porCodigo.has(codigo)) porCodigo.set(codigo, []);
        porCodigo.get(codigo).push(p);
    }
    if (sesion.usuarioId) for (const [codigo, ramos] of porCodigo) {
        // Si hay varias versiones, solo una nota final inequívoca se usa para determinar requisitos.
        const finales = [];
        for (const p of ramos) {
            if (p.condicionesNoCalculadas?.length || p.requiereRevisionPonderaciones) continue;
            const final = calcularNotaFinal(p, await obtenerNotasPorUsuarioPlantilla(sesion.usuarioId, p.id));
            if (final != null) finales.push(final);
        }
        if (finales.length === 1) notas[codigo] = finales[0];
        else if (finales.length > 1) delete notas[codigo];
    }
    dibujarArbolMalla(plantillas, notas);
    const contenedor = $('#mallaContenido');
    contenedor.innerHTML = '';
    for (let semestre = 1; semestre <= 8; semestre++) {
        const columna = document.createElement('section');
        columna.className = 'malla-semestre';
        const titulo = document.createElement('h3'); titulo.textContent = `${semestre}.º semestre`; columna.appendChild(titulo);
        for (const ramo of MALLA.filter(r => r.semestre === semestre)) {
            const tarjeta = document.createElement('article'); tarjeta.className = 'malla-ramo';
            const nombre = document.createElement('strong'); nombre.textContent = formatearNombreRamo(ramo); tarjeta.appendChild(nombre);
            if (!ramo.codigo) { const codigo = document.createElement('div'); codigo.className = 'help-text'; codigo.textContent = 'Código por confirmar'; tarjeta.appendChild(codigo); }
            const versiones = porCodigo.get(ramo.codigo) || [];
            const importado = versiones.find(p => p.requisito);
            const requisito = requisitoAplicable(ramo, importado?.requisito);
            const detalle = document.createElement('div'); detalle.className = 'malla-requisito';
            detalle.textContent = requisito ? `Requisito: ${requisito}` : 'Requisito no informado'; tarjeta.appendChild(detalle);
            if (requisito) {
                const estado = evaluarRequisito(interpretarRequisito(requisito), notas);
                const etiqueta = document.createElement('span'); etiqueta.className = 'badge ' + (estado === 'cumplido' ? 'badge-success' : estado === 'no cumplido' ? 'badge-error' : 'badge-warning');
                etiqueta.textContent = estado === 'cumplido' ? 'Requisito cumplido' : estado === 'no cumplido' ? 'Requisito no cumplido' : 'No se puede determinar'; tarjeta.appendChild(etiqueta);
            }
            const dependientes = obtenerDependientes(ramo.codigo, plantillas);
            if (dependientes.length) {
                const efecto = document.createElement('div'); efecto.className = 'malla-requisito';
                efecto.textContent = dependientes.map(x => `${x.relacion.obligatorio ? 'Necesario para' : 'Alternativa para'} ${formatearNombreRamo(x.destino)}`).join(' · ');
                tarjeta.appendChild(efecto);
            }
            if (ramo.codigo && notas[ramo.codigo] != null) {
                const nota = document.createElement('div'); nota.className = 'help-text'; nota.textContent = `Nota final: ${redondear(notas[ramo.codigo])}`; tarjeta.appendChild(nota);
            }
            if (ramo.codigo) {
                const etiquetaNota = document.createElement('label'); etiquetaNota.className = 'help-text';
                etiquetaNota.textContent = 'Nota histórica';
                const entrada = document.createElement('input'); entrada.type = 'number'; entrada.className = 'input input-sm';
                entrada.min = '1'; entrada.max = '7'; entrada.step = '0.1'; entrada.placeholder = 'Sin registrar';
                entrada.value = historicas[ramo.codigo] ?? ''; entrada.disabled = !alumno;
                entrada.setAttribute('aria-label', `Nota histórica de ${ramo.nombre}`);
                entrada.addEventListener('change', async () => {
                    const valor = entrada.value === '' ? null : Number(entrada.value);
                    if (valor !== null && (!Number.isFinite(valor) || valor < 1 || valor > 7)) { toast('La nota debe estar entre 1 y 7', 'error'); entrada.value = historicas[ramo.codigo] ?? ''; return; }
                    try { await guardarNotaHistorica(alumno.id, ramo.codigo, valor); $('#btnMalla').click(); }
                    catch (error) { toast('No se pudo guardar la nota: ' + error.message, 'error'); }
                });
                etiquetaNota.appendChild(entrada); tarjeta.appendChild(etiquetaNota);
            }
            columna.appendChild(tarjeta);
        }
        contenedor.appendChild(columna);
    }
    openModal('modalMalla');
});
