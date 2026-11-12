// El texto pegado se analiza localmente; no se modifica la nota de simulación.
function normalizarEvaluacionPortal(valor) {
    return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

// En la vista móvil, MiUDLA puede partir el nombre y dejar el porcentaje
// antes de la segunda línea (por ejemplo, CATEDRA / RECUPERATIVA).
function reconstruirFilasCaptura(texto) {
    const lineas = texto.split(/\r?\n/);
    for (let i = 0; i + 1 < lineas.length; i++) {
        const primera = lineas[i].match(/^\s*(CATEDRA)\s+(\d{1,3}(?:[.,]\d{1,2})?\s*%\s*(?:N\s*\/\s*P|[-–—]+|[1-7](?:[.,]\d{1,2})?(?![\d.,])))(?:\s.*)?$/);
        const segunda = lineas[i + 1].match(/^\s*(RECUPERATIVA|DIAGNOSTICO)(?=\s|$)/);
        if (!primera || !segunda) continue;
        lineas[i] = `${primera[1]} ${segunda[1]} ${primera[2]}`;
        lineas[i + 1] = lineas[i + 1].slice(segunda[0].length);
    }
    return lineas.join('\n');
}

function analizarTextoPortal(texto, plantilla, configuracion = {}) {
    let fuente = String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
        .replace(/\[[^\]]*\]\(https?:\/\/[^)]*\)/gi, ' ')
        .replace(/\*+/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '');
    if (configuracion.porLinea) fuente = reconstruirFilasCaptura(fuente);
    fuente = fuente.replace(configuracion.porLinea ? /[^\S\r\n]+/g : /\s+/g, ' ')
        .replace(configuracion.porLinea ? /\r?\n/g : /\u0000/g, '\u0000');
    const nombres = new Map();
    for (const comp of plantilla.componentes) for (const sub of comp.subs) {
        const nombre = normalizarEvaluacionPortal(sub.nombre);
        if (!nombre) continue;
        if (!nombres.has(nombre)) nombres.set(nombre, []);
        nombres.get(nombre).push({ comp, sub });
    }
    if (!nombres.size) throw new Error('El ramo no tiene evaluaciones configuradas.');
    const escapar = valor => valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const opciones = [...nombres.keys()].sort((a, b) => b.length - a.length)
        .map(nombre => nombre.split(' ').map(escapar).join('\\s*'));
    const sufijo = (configuracion.porLinea ? '\\s+' : '\\s*') + '(\\d{1,3}(?:[.,]\\d{1,2})?)\\s*%\\s*(N\\s*\\/\\s*P|[-–—]+|[1-7](?:[.,]\\d{1,2})?(?![\\d.,]))';
    const patron = new RegExp(`(${opciones.join('|')})${sufijo}`, 'g');
    const patronesIndividuales = opciones.map(opcion => new RegExp(`^${opcion}${sufijo}`));
    const filas = [], encontradas = new Set(), ambiguas = [];
    let match;
    while ((match = patron.exec(fuente))) {
        const candidatos = patronesIndividuales.filter(p => p.test(fuente.slice(match.index)));
        if (candidatos.length > 1) throw new Error(`El texto de ${match[1]} es ambiguo. Copia la tabla con sus espacios o saltos de línea.`);
        const clave = normalizarEvaluacionPortal(match[1]);
        let opcionesSub = nombres.get(clave);
        // Cuando el portal une palabras o números, resolver por la misma forma sin espacios.
        if (!opcionesSub) {
            const sinEspacios = clave.replace(/\s/g, '');
            const llaves = [...nombres.keys()].filter(k => k.replace(/\s/g, '') === sinEspacios);
            opcionesSub = llaves.flatMap(k => nombres.get(k));
        }
        if (!opcionesSub || opcionesSub.length !== 1) { ambiguas.push(match[1]); continue; }
        const { comp, sub } = opcionesSub[0];
        const id = `${comp.key}\u0000${sub.nombre}`;
        const porcentaje = Number(match[2].replace(',', '.'));
        if (porcentaje > 100) throw new Error(`No se pudo interpretar el porcentaje de ${sub.nombre}.`);
        const valor = match[3].replace(/\s/g, '');
        if (/^N\/P$/.test(valor)) { ambiguas.push(`${sub.nombre}: N/P debe revisarse manualmente`); continue; }
        const nota = /^[-–—]+$/.test(valor) ? null : Number(valor.replace(',', '.'));
        if (nota !== null && (!Number.isFinite(nota) || nota < 1 || nota > 7)) throw new Error(`La nota de ${sub.nombre} no está entre 1 y 7.`);
        if (encontradas.has(id)) {
            const anterior = filas.find(f => f.compKey === comp.key && f.subNombre === sub.nombre);
            if (configuracion.porLinea && anterior.notaPortal === nota && anterior.porcentajePortal === porcentaje) continue;
            throw new Error(`La evaluación ${sub.nombre} aparece más de una vez con datos distintos. Revisa que las capturas sean del mismo ramo y período.`);
        }
        encontradas.add(id);
        filas.push({ compKey: comp.key, compLabel: comp.label, subNombre: sub.nombre, notaPortal: nota,
            porcentajePortal: porcentaje, porcentajeApp: Number(sub.porcentaje) || 0, inicio: match.index, fin: patron.lastIndex });
    }
    if (!filas.length) throw new Error('No se reconocieron evaluaciones. Copia la tabla completa de notas del ramo seleccionado.');

    const diferencias = [], recuperativas = [];
    for (const fila of filas) {
        if (Math.abs(fila.porcentajePortal - fila.porcentajeApp) > 0.02) {
            if (/recuperat/i.test(fila.subNombre) && fila.porcentajeApp === 0) {
                const componente = plantilla.componentes.find(c => c.key === fila.compKey);
                const regla = componente?.reglaRecuperativa === 'reemplazaMenor'
                    ? 'se usa para N/P o, si aplica, para reemplazar la nota menor'
                    : 'toma el peso de la evaluación marcada N/P';
                recuperativas.push(`${fila.subNombre}: el portal muestra ${fila.porcentajePortal} %; en la app ${regla}, sin sumarse como otra evaluación.`);
            } else diferencias.push(`${fila.subNombre}: portal ${fila.porcentajePortal} %, app ${fila.porcentajeApp} %`);
        }
    }
    for (const comp of plantilla.componentes) {
        const delComponente = filas.filter(f => f.compKey === comp.key);
        if (!delComponente.length) continue;
        const ultima = delComponente[delComponente.length - 1];
        const siguiente = filas.find(f => f.inicio >= ultima.fin && f.compKey !== comp.key);
        const cierre = fuente.slice(ultima.fin, siguiente?.inicio ?? fuente.length);
        const total = cierre.match(/100(?:[.,]0+)?\s*%\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*%/);
        if (total) {
            const peso = Number(total[1].replace(',', '.'));
            if (peso <= 100 && Math.abs(peso - Number(comp.peso)) > 0.01) diferencias.push(`${comp.label}: peso portal ${peso} %, app ${comp.peso} %`);
        }
    }
    const noEncontradas = [];
    for (const comp of plantilla.componentes) for (const sub of comp.subs) {
        if (!encontradas.has(`${comp.key}\u0000${sub.nombre}`)) noEncontradas.push(`${comp.label}: ${sub.nombre}`);
    }
    return { filas, noEncontradas, ambiguas, diferencias, recuperativas };
}

let previsualizacionPortal = null;
let lecturaCapturas = 0;
let textoEsCaptura = false;
const limpiarPreviaPortal = () => { previsualizacionPortal = null; $('#btnGuardarPortal').disabled = true; $('#vistaPreviaPortal').replaceChildren(); };

$('#btnSincronizarPortal').addEventListener('click', async () => {
    const { usuarioId, plantillaId, plantilla } = sesion;
    if (!usuarioId || !plantillaId || !plantilla) { toast('Selecciona alumno y ramo primero', 'error'); return; }
    const alumnos = await obtenerUsuarios();
    const alumno = alumnos.find(u => u.id === usuarioId);
    if (sesion.usuarioId !== usuarioId || sesion.plantillaId !== plantillaId) return;
    $('#destinoPortal').textContent = `Se guardará para ${alumno?.nombre || 'el alumno seleccionado'} · ${formatearNombreRamo(plantilla)}. Comprueba que la tabla corresponda a este alumno y ramo.`;
    $('#textoPortal').value = '';
    textoEsCaptura = false;
    lecturaCapturas++;
    $('#capturasPortal').value = '';
    $('#estadoCapturas').textContent = '';
    limpiarPreviaPortal();
    openModal('modalPortal');
});
$('#textoPortal').addEventListener('input', limpiarPreviaPortal);
$('#capturasPortal').addEventListener('change', limpiarPreviaPortal);

// Evita repetir filas idénticas cuando dos capturas se solapan; conserva
// diferencias para que el analizador avise de evaluaciones duplicadas.
function unirTextoCapturas(textos) {
    const lineas = new Set();
    for (const texto of textos) for (const linea of texto.split(/\r?\n/)) {
        const limpia = linea.trim().replace(/\s+/g, ' ');
        if (limpia) lineas.add(limpia);
    }
    return [...lineas].join('\n');
}

$('#btnLeerCapturas').addEventListener('click', async () => {
    const archivos = [...$('#capturasPortal').files];
    const estado = $('#estadoCapturas');
    if (!archivos.length) { estado.textContent = 'Selecciona al menos una captura.'; return; }
    if (archivos.some(f => !f.type.startsWith('image/'))) { estado.textContent = 'Selecciona solo archivos de imagen.'; return; }
    const lectura = ++lecturaCapturas;
    const usuarioId = sesion.usuarioId, plantillaId = sesion.plantillaId;
    const controles = [$('#btnLeerCapturas'), $('#capturasPortal'), $('#btnAnalizarPortal'), $('#textoPortal')];
    controles.forEach(control => { control.disabled = true; });
    limpiarPreviaPortal();
    estado.textContent = 'Preparando lector de imágenes en el dispositivo…';
    let worker;
    try {
        if (typeof Tesseract === 'undefined') throw new Error('No se pudo cargar el lector de imágenes. Recarga la aplicación con conexión e inténtalo nuevamente.');
        const ruta = new URL('vendor/tesseract/', document.baseURI).href;
        worker = await Tesseract.createWorker('spa', 1, {
            workerPath: ruta + 'worker.min.js', corePath: ruta, langPath: ruta,
            cacheMethod: 'none',
            logger: mensaje => {
                if (lectura === lecturaCapturas && mensaje.status === 'recognizing text') {
                    estado.textContent = `Leyendo captura: ${Math.round(mensaje.progress * 100)} %`;
                }
            }
        });
        await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
        const textos = [];
        for (let i = 0; i < archivos.length; i++) {
            estado.textContent = `Leyendo captura ${i + 1} de ${archivos.length}…`;
            const resultado = await worker.recognize(archivos[i]);
            textos.push(resultado.data.text);
        }
        if (lectura !== lecturaCapturas || sesion.usuarioId !== usuarioId || sesion.plantillaId !== plantillaId || !$('#modalPortal').classList.contains('active')) return;
        $('#textoPortal').value = unirTextoCapturas(textos);
        textoEsCaptura = true;
        estado.textContent = 'Lectura terminada. Revisa y corrige el texto si hace falta; después revisa la vista previa de notas.';
        $('#btnAnalizarPortal').disabled = false;
        $('#btnAnalizarPortal').click();
    } catch (error) {
        if (lectura === lecturaCapturas) estado.textContent = `No se pudieron leer las capturas: ${error.message || 'error desconocido'}. Prueba con una imagen más clara o pega el texto.`;
    } finally {
        if (worker) await worker.terminate();
        controles.forEach(control => { control.disabled = false; });
    }
});

$('#btnAnalizarPortal').addEventListener('click', () => {
    limpiarPreviaPortal();
    const panel = $('#vistaPreviaPortal');
    if (!sesion.usuarioId || !sesion.plantillaId || !sesion.plantilla) { panel.textContent = 'Selecciona alumno y ramo nuevamente.'; return; }
    try {
        const resultado = analizarTextoPortal($('#textoPortal').value, sesion.plantilla, { porLinea: textoEsCaptura });
        const titulo = document.createElement('p');
        titulo.textContent = `Se reconocieron ${resultado.filas.length} evaluaciones. Revisa cada fila: «Sin nota» borrará la nota portal previa de esa evaluación.`;
        panel.appendChild(titulo);
        const lista = document.createElement('ul'); lista.className = 'portal-previa-lista';
        for (const fila of resultado.filas) {
            const item = document.createElement('li');
            item.textContent = `${fila.compLabel} · ${fila.subNombre}: ${fila.notaPortal === null ? 'Sin nota' : String(fila.notaPortal).replace('.', ',')} (${fila.porcentajePortal} %)`;
            lista.appendChild(item);
        }
        panel.appendChild(lista);
        const mensajes = [];
        if (resultado.diferencias.length) mensajes.push(`Porcentajes diferentes (la app no los cambiará): ${resultado.diferencias.join('; ')}.`);
        if (resultado.recuperativas.length) mensajes.push(...resultado.recuperativas);
        if (resultado.noEncontradas.length) mensajes.push(`Evaluaciones de la app no reconocidas en el texto: ${resultado.noEncontradas.join('; ')}. No se modificarán.`);
        if (resultado.ambiguas.length) mensajes.push(`Datos sin interpretar: ${resultado.ambiguas.join('; ')}. No se modificarán.`);
        mensajes.push('Solo se guardarán las filas de esta vista previa. Confirma que el texto pertenece al alumno y ramo indicados.');
        const aviso = document.createElement('p'); aviso.className = 'help-text'; aviso.style.whiteSpace = 'pre-line'; aviso.textContent = mensajes.join('\n'); panel.appendChild(aviso);
        previsualizacionPortal = { usuarioId: sesion.usuarioId, plantillaId: sesion.plantillaId, filas: resultado.filas };
        $('#btnGuardarPortal').disabled = false;
    } catch (error) { panel.textContent = error.message; }
});

$('#btnGuardarPortal').addEventListener('click', async () => {
    const previa = previsualizacionPortal;
    if (!previa || sesion.usuarioId !== previa.usuarioId || sesion.plantillaId !== previa.plantillaId) { limpiarPreviaPortal(); toast('Cambió el alumno o ramo; vuelve a revisar la tabla.', 'error'); return; }
    const boton = $('#btnGuardarPortal'); boton.disabled = true;
    try {
        const actual = await obtenerPlantilla(previa.plantillaId);
        if (!actual || previa.filas.some(f => !actual.componentes.some(c => c.key === f.compKey && c.subs.some(s => s.nombre === f.subNombre)))) throw new Error('Cambió la estructura del ramo. Vuelve a revisar la tabla.');
        await guardarNotasPortal(previa.usuarioId, previa.plantillaId, previa.filas);
        limpiarPreviaPortal(); closeModal('modalPortal');
        if (sesion.usuarioId === previa.usuarioId && sesion.plantillaId === previa.plantillaId) await mostrarNotas();
        toast('Notas del portal guardadas; las notas de simulación no cambiaron.', 'success');
    } catch (error) { $('#vistaPreviaPortal').textContent = error.message; boton.disabled = false; }
});
