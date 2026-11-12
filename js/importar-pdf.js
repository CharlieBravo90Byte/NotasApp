// Importación local de programas UDLA con texto seleccionable.
pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';

async function extraerLineasPdf(archivo) {
    const documento = await pdfjsLib.getDocument({ data: await archivo.arrayBuffer() }).promise;
    const lineas = [];
    try {
        for (let pagina = 1; pagina <= documento.numPages; pagina++) {
            const contenido = await (await documento.getPage(pagina)).getTextContent();
            const filas = new Map();
            for (const item of contenido.items) {
                if (!item.str.trim()) continue;
                const y = Math.round(item.transform[5]);
                if (!filas.has(y)) filas.set(y, []);
                filas.get(y).push(item);
            }
            for (const [, items] of [...filas].sort((a, b) => b[0] - a[0])) {
                lineas.push(items.sort((a, b) => a.transform[4] - b.transform[4]).map(i => i.str).join(' ').replace(/\s+/g, ' ').trim());
            }
        }
        return lineas;
    } finally { await documento.destroy(); }
}

// No depende del nombre ni de la posición de la sección. Si hay contradicción,
// o el programa usa otra regla, no se presume una política de examen.
function detectarReglaExamen(texto) {
    const normalizado = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
    const negada = /\bno\s+(?:(?:esta|se encuentra|sera)\s+)?(?:considerad[ao]|contemplad[ao]|previst[ao]|permitid[ao])\s+(?:la\s+)?(?:eximicion|exencion)\b/.test(normalizado)
        || /\bno\s+(?:hay|existe|procede|aplica|se\s+(?:contempla|considera|permite|admite))\s+(?:la\s+)?(?:eximicion|exencion)\b/.test(normalizado)
        || /\bno\s+(?:se\s+)?(?:puede|podra|podran|permite)\s+eximirse\b/.test(normalizado)
        || /\b(?:sin\s+(?:derecho\s+a\s+)?(?:la\s+)?(?:eximicion|exencion))\b/.test(normalizado);
    const examenObligatorio = /\bexamen\s+(?:(?:es|sera|de\s+caracter)\s+)?obligatorio\b/.test(normalizado)
        && !/\b(?:no|sin)\s+(?:un\s+)?examen\s+(?:(?:es|sera)\s+)?obligatorio\b/.test(normalizado)
        && !/\bexamen\s+no\s+(?:es|sera)\s+obligatorio\b/.test(normalizado);
    // El cálculo de la app admite exención con umbral 5,5; otros valores
    // se dejan pendientes en vez de aplicarles una regla distinta.
    const permite = /\b(?:eximicion|exencion)\b[^]{0,450}?\b5[,.]5\b[^]{0,250}?\beximid[oa]s?\b/.test(normalizado);
    const prohibe = negada || examenObligatorio;
    return permite === prohibe ? null : prohibe;
}

function extraerComponentesTabla(tabla, texto) {
    const tipos = ['EJERCICIO', 'CONTROL', 'TALLER', 'LABORATORIO', 'CATEDRA', 'EXAMEN'];
    const componentes = [];
    for (const tipo of tipos) {
        const pesoRegex = new RegExp(`\\b${tipo}\\s+(\\d+(?:[.,]\\d+)?)\\b`, 'i');
        let peso = null;
        const subs = new Map();
        for (const linea of tabla) {
            const pesoMatch = linea.match(pesoRegex);
            // Una categoría seguida de un número puede ser una evaluación; se distingue por el resto de la fila.
            if (pesoMatch) {
                const resto = linea.slice(pesoMatch.index + pesoMatch[0].length).trim();
                if (!resto || new RegExp(`^${tipo}\\s`, 'i').test(resto)) {
                    const valor = Number(pesoMatch[1].replace(',', '.'));
                    if (peso !== null && peso !== valor) throw new Error(`Hay ponderaciones contradictorias para ${tipo}.`);
                    peso = valor;
                }
            }
            const subRegex = new RegExp(`\\b(${tipo}(?:\\s+(?:\\d+|DIAGNOSTICO|RECUPERATIVA))?)\\s+(\\d+(?:[.,]\\d+)?)\\s*$`, 'i');
            const sub = linea.match(subRegex);
            if (sub) {
                const nombreSub = sub[1].toUpperCase().replace(/\s+/g, ' ');
                // Una fila con una sola pareja de categoría y número puede ser solo el peso global.
                if (nombreSub === tipo && tipo !== 'EXAMEN') continue;
                const porcentaje = Number(sub[2].replace(',', '.'));
                if (subs.has(nombreSub) && subs.get(nombreSub).porcentaje !== porcentaje) throw new Error(`Hay ponderaciones contradictorias para ${nombreSub}.`);
                subs.set(nombreSub, { nombre: nombreSub, porcentaje, contenido: '', fecha: '' });
            }
        }
        if (peso !== null && subs.size) componentes.push({ key: tipo, label: tipo, peso, subs: [...subs.values()] });
    }
    if (!componentes.length || Math.abs(componentes.reduce((s, c) => s + c.peso, 0) - 100) > 0.01) {
        throw new Error('No se pudo interpretar una tabla completa que sume 100%. Revisa el PDF y crea el ramo manualmente.');
    }
    const avisos = [];
    for (const comp of componentes) {
        const total = comp.subs.reduce((s, sub) => s + sub.porcentaje, 0);
        const rec = comp.subs.find(s => /RECUPERATIVA/.test(s.nombre));
        const ordinarias = comp.subs.filter(s => s !== rec).reduce((s, sub) => s + sub.porcentaje, 0);
        const reemplazaMenor = /mejores notas/i.test(tabla.join(' ')) || /reemplazar[aá][^.]{0,100}peor nota/i.test(texto.replace(/\s+/g, ' '));
        if (total > 100.01 && rec && Math.abs(ordinarias - 100) < 0.05 && reemplazaMenor) {
            rec.porcentaje = 0;
            comp.reglaRecuperativa = 'reemplazaMenor';
            avisos.push(`${comp.label}: la recuperativa figura con ${total - ordinarias}% en el PDF y reemplaza la nota más baja; en el editor aparece con 0% porque es opcional.`);
        } else if (Math.abs(total - 100) >= 0.05) {
            throw new Error(`Los porcentajes de ${comp.label} suman ${total}%. La aplicación no puede interpretar esta regla automáticamente.`);
        }
    }
    return { componentes, avisos };
}

function firmaEvaluaciones(componentes, incluirOpcionales = false) {
    return JSON.stringify(componentes.map(comp => ({
        key: comp.key, peso: comp.peso,
        subs: comp.subs.filter(sub => incluirOpcionales || sub.porcentaje > 0)
            .map(sub => ({ nombre: sub.nombre, porcentaje: sub.porcentaje }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
    })).sort((a, b) => a.key.localeCompare(b.key)));
}

function analizarProgramaPdf(lineas) {
    const texto = lineas.join('\n');
    const nombre = texto.match(/PROGRAMA DE ASIGNATURA\s*:\s*([^\n]+)/i)?.[1]?.replace(/\.$/, '').trim();
    const inicio = lineas.findIndex(l => /7\.1\.?\s*PONDERACIONES/i.test(l));
    const fin = lineas.findIndex((l, i) => i > inicio && /7\.2\.?\s*ESTRATEGIA/i.test(l));
    if (!nombre || inicio < 0 || fin < 0) throw new Error('No se encontró el nombre o la tabla 7.1 de ponderaciones. Se requiere un programa UDLA con texto seleccionable.');
    const tablaCompleta = lineas.slice(inicio + 1, fin);
    const inicios = tablaCompleta.map((linea, i) => /\bEXAMEN\s+\d+(?:[.,]\d+)?\s+EXAMEN\s+\d+(?:[.,]\d+)?\b/i.test(linea) ? i : -1).filter(i => i >= 0);
    const tablas = inicios.length > 1
        ? inicios.map((inicioTabla, i) => tablaCompleta.slice(i === 0 ? 0 : inicioTabla, inicios[i + 1] ?? tablaCompleta.length))
        : [tablaCompleta];
    const primera = extraerComponentesTabla(tablas[0], texto);
    const { componentes, avisos } = primera;
    let requiereRevisionPonderaciones = false;
    if (tablas.length > 1) {
        let diferencias = false;
        for (const otra of tablas.slice(1)) {
            try {
                const alternativa = extraerComponentesTabla(otra, texto);
                if (firmaEvaluaciones(componentes, true) !== firmaEvaluaciones(alternativa.componentes, true)) diferencias = true;
                if (firmaEvaluaciones(componentes) !== firmaEvaluaciones(alternativa.componentes)) requiereRevisionPonderaciones = true;
            } catch {
                diferencias = true;
                requiereRevisionPonderaciones = true;
            }
        }
        avisos.push(diferencias
            ? 'El PDF contiene varias estructuras diferentes. Se importó la primera tabla completa; revisa si las evaluaciones y la recuperativa corresponden a tu curso.'
            : 'El PDF repite la misma estructura de evaluaciones; se importó una sola vez.');
        if (requiereRevisionPonderaciones) avisos.push('Las ponderaciones o evaluaciones obligatorias difieren entre tablas. Revisa la estructura en Ramos antes de usar el resultado.');
    }
    const finEstrategia = lineas.findIndex((l, i) => i > fin && /7\.3\.?\s*DESCRIPCI/i.test(l));
    const estrategia = lineas.slice(fin + 1, finEstrategia > fin ? finEstrategia : lineas.length);
    const inicioResultados = lineas.findIndex(l => /^3\.\s*RESULTADOS DE APRENDIZAJE/i.test(l));
    const finResultados = lineas.findIndex((l, i) => i > inicioResultados && /^4\.\s*APORTES/i.test(l));
    const resultados = {};
    if (inicioResultados >= 0 && finResultados > inicioResultados) {
        let actual = null;
        for (const linea of lineas.slice(inicioResultados + 1, finResultados)) {
            const match = linea.match(/^(RAA\s*\d+)\s+(.+)/i);
            if (match) {
                actual = match[1].replace(/\s+/g, '').toUpperCase();
                resultados[actual] = match[2];
            } else if (actual && !/^(Publicado por:|Fecha:|P.gina:)/i.test(linea)) {
                resultados[actual] += ' ' + linea;
            }
        }
    }
    for (const comp of componentes) for (const sub of comp.subs) {
        const nombreExacto = new RegExp(`\\b${sub.nombre.replace(/ /g, '\\s+')}\\b(?!\\d)`, 'i');
        const fila = estrategia.find(l => nombreExacto.test(l) && /RAA\s*\d/i.test(l));
        if (fila) {
            const raas = [...new Set((fila.match(/RAA\s*\d+/gi) || []).map(r => r.replace(/\s+/g, '').toUpperCase()))];
            if (raas.length) sub.contenido = raas.map(r => resultados[r] ? `${r}: ${resultados[r]}` : r).join('\n');
        }
    }
    const examenObligatorio = detectarReglaExamen(texto);
    if (examenObligatorio === null) avisos.push('No se pudo determinar la regla de examen; queda pendiente de definir.');
    const condicionesNoCalculadas = [];
    if (/nota\s+individual\s+del\s+docente\s+gu[ií]a[\s\S]{0,180}docente\s+corrector[\s\S]{0,100}superiores\s+a\s+4[,.]0/i.test(texto.replace(/\s+/g, ' '))) {
        condicionesNoCalculadas.push('El programa exige notas individuales superiores a 4,0 para docente guía y docente corrector; la app aún no evalúa esa condición.');
        avisos.push(...condicionesNoCalculadas);
    }
    const textoNormalizado = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
    if (/carta\s+firmada\s+por\s+quien\s+sera\s+su\s+profesor\s+guia/.test(textoNormalizado)) {
        const advertencia = 'El programa exige una carta firmada por el profesor guía para aprobar; la app aún no verifica esta condición.';
        condicionesNoCalculadas.push(advertencia);
        avisos.push(advertencia);
    }
    if (/ambas\s+notas\s+se\s+promediaran\s+para\s+obtener\s+la\s+nota\s+de\s+examen/.test(textoNormalizado)) {
        const advertencia = 'El examen consta de dos instancias; registra como nota de examen el promedio de ambas.';
        avisos.push(advertencia);
        for (const sub of componentes.find(c => c.key === 'EXAMEN')?.subs || []) {
            sub.contenido = [sub.contenido, advertencia].filter(Boolean).join('\n');
        }
    }
    const codigo = nombre.match(/\b([A-Z]{2,5})\s*-?\s*(\d{3,4})\b/i);
    const requisito = lineas.find(l => /^Requisito\s+/i.test(l))?.replace(/^Requisito\s+/i, '').trim() || null;
    return { nombre, codigo: codigo ? (codigo[1] + codigo[2]).toUpperCase() : null, requisito, componentes, examenObligatorio, condicionesNoCalculadas, requiereRevisionPonderaciones, avisos };
}

async function importarProgramaArchivo(archivo) {
    const propuesta = analizarProgramaPdf(await extraerLineasPdf(archivo));
    // Releer por archivo evita duplicados incluso dentro del mismo lote.
    const existentes = await obtenerPlantillas();
    const existente = existentes.find(p => propuesta.codigo
        ? codigoDePlantilla(p) === propuesta.codigo
        : normalizarNombreMalla(p.nombre) === normalizarNombreMalla(propuesta.nombre));
    if (existente) {
        const cambios = {};
        const campos = [];
        if (existente.estructuraPendiente && Array.isArray(existente.componentes) && existente.componentes.length === 0) {
            cambios.componentes = propuesta.componentes;
            cambios.estructuraPendiente = false;
            cambios.requiereRevisionPonderaciones = propuesta.requiereRevisionPonderaciones;
            campos.push('las evaluaciones');
        }
        if (!existente.requisito && propuesta.requisito) {
            cambios.requisito = propuesta.requisito;
            cambios.codigo = existente.codigo || propuesta.codigo;
            campos.push('el requisito');
        }
        if (existente.examenObligatorio == null && propuesta.examenObligatorio !== null) {
            cambios.examenObligatorio = propuesta.examenObligatorio;
            campos.push('la regla de examen');
        }
        if (!existente.condicionesNoCalculadas?.length && propuesta.condicionesNoCalculadas?.length) {
            cambios.condicionesNoCalculadas = propuesta.condicionesNoCalculadas;
            campos.push('las condiciones pendientes de revisión');
        }
        if (campos.length) {
            await actualizarPlantilla({ ...existente, ...cambios });
            return { estado: 'actualizado', mensaje: `Se completó ${campos.join(' y ')} de ${propuesta.nombre}; se conservaron sus notas y evaluaciones.`, avisos: propuesta.avisos };
        }
        return { estado: 'existente', mensaje: `${propuesta.nombre} ya existe; no se modificó ni se duplicó.`, avisos: propuesta.avisos };
    }
    const asignatura = MALLA.find(r => r.codigo === propuesta.codigo);
    await crearPlantilla(propuesta.nombre, propuesta.componentes, {
        codigo: propuesta.codigo, requisito: propuesta.requisito,
        semestre: asignatura?.semestre ?? null, examenObligatorio: propuesta.examenObligatorio,
        condicionesNoCalculadas: propuesta.condicionesNoCalculadas,
        requiereRevisionPonderaciones: propuesta.requiereRevisionPonderaciones,
        umbralEximen: 5.5
    });
    const detalles = [];
    if (!asignatura) detalles.push('semestre sin asignar');
    if (propuesta.examenObligatorio === null) detalles.push('regla de examen pendiente');
    const aviso = detalles.length ? ` (${detalles.join('; ')})` : '';
    return { estado: 'importado', mensaje: `${propuesta.nombre} importado${aviso}.`, avisos: propuesta.avisos };
}

async function procesarArchivosProgramas(archivos, alTerminar = () => {}) {
    const resultados = [];
    for (const archivo of archivos) {
        let resultado;
        try {
            resultado = { archivo: archivo.name, ...await importarProgramaArchivo(archivo) };
        } catch (error) {
            console.error('Error al importar', archivo.name, error);
            resultado = { archivo: archivo.name, estado: 'error', mensaje: error.message || 'No se pudo leer el archivo.' };
        }
        resultados.push(resultado);
        alTerminar(resultado, resultados.length, archivos.length);
    }
    return resultados;
}

$('#btnImportarPdf').addEventListener('click', () => $('#inputPdfPrograma').click());
$('#inputPdfPrograma').addEventListener('change', async event => {
    const archivos = Array.from(event.target.files);
    event.target.value = '';
    if (!archivos.length) return;
    const boton = $('#btnImportarPdf');
    const lista = $('#resultadosImportacion');
    const estado = $('#estadoImportacion');
    boton.disabled = true;
    lista.replaceChildren();
    estado.textContent = `Procesando 0 de ${archivos.length} archivos…`;
    openModal('modalImportacion');
    try {
        const resultados = await procesarArchivosProgramas(archivos, (resultado, completados, total) => {
            const item = document.createElement('li');
            if (resultado.estado === 'error') item.className = 'resultado-error';
            const nombre = document.createElement('strong'); nombre.textContent = resultado.archivo;
            const mensaje = document.createElement('span'); mensaje.textContent = resultado.mensaje;
            item.append(nombre, mensaje);
            for (const aviso of resultado.avisos || []) {
                const detalle = document.createElement('div'); detalle.className = 'help-text'; detalle.textContent = aviso;
                item.appendChild(detalle);
            }
            lista.appendChild(item);
            estado.textContent = `Procesando ${completados} de ${total} archivos…`;
        });
        const cuenta = tipo => resultados.filter(r => r.estado === tipo).length;
        estado.textContent = `Listo: ${cuenta('importado')} importados, ${cuenta('actualizado')} actualizados, ${cuenta('existente')} existentes y ${cuenta('error')} con error.`;
        await cargarSelectPlantillas();
        if (sesion.usuarioId && sesion.plantillaId) {
            sesion.plantilla = await obtenerPlantilla(sesion.plantillaId);
            if (sesion.plantilla) await mostrarNotas();
        }
    } catch (error) {
        console.error(error);
        estado.textContent += ' No se pudo actualizar la vista; recarga la página.';
    } finally {
        boton.disabled = false;
    }
});
