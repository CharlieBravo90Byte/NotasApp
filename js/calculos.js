// ══════════════════════════════════════
//  calculos.js — Lógica totalmente dinámica
//
//  La plantilla define los componentes y sus subs.
//  Cada componente tiene: key, label, peso (% nota final), subs[]
//  Cada sub tiene: nombre, porcentaje (% dentro del componente, suma 100)
//
//  Nota parcial del alumno: { compKey, subNombre, nota }
// ══════════════════════════════════════

/**
 * Calcula el promedio ponderado de un componente.
 * Usa los porcentajes de la plantilla (subs[].porcentaje).
 * Las notas del alumno se buscan en el array notasAlumno.
 *
 * @param {Object} comp       - componente de la plantilla
 * @param {Array}  notasAlumno - notas del alumno [{compKey, subNombre, nota}]
 * @returns {number|null}
 */
function calcularPromedioComponente(comp, notasAlumno) {
    const subsConNota = comp.subs.map(sub => {
        const reg = notasAlumno.find(
            n => n.compKey === comp.key && n.subNombre === sub.nombre && n.nota !== null && n.nota !== undefined
        );
        return { sub, nota: reg ? reg.nota : null };
    }).filter(x => x.nota !== null);

    if (subsConNota.length === 0) return null;

    // Si los porcentajes están definidos y > 0, usar ponderación
    const pesoTotal = subsConNota.reduce((s, x) => s + (x.sub.porcentaje || 0), 0);
    if (pesoTotal > 0) {
        return subsConNota.reduce((s, x) => s + x.nota * (x.sub.porcentaje || 0), 0) / pesoTotal;
    }
    // Fallback: promedio simple
    return subsConNota.reduce((s, x) => s + x.nota, 0) / subsConNota.length;
}

/**
 * Calcula el promedio parcial ponderado (todos los componentes excepto EXAMEN).
 * Usa los pesos de los componentes (comp.peso).
 */
function calcularPromedioParcial(plantilla, notasAlumno) {
    const parcialesComps = plantilla.componentes.filter(c => c.key !== 'EXAMEN');
    let sumaPesos = 0;
    let sumaNotas = 0;
    let hayAlguna = false;

    for (const comp of parcialesComps) {
        const prom = calcularPromedioComponente(comp, notasAlumno);
        if (prom !== null) {
            sumaNotas += prom * comp.peso;
            sumaPesos += comp.peso;
            hayAlguna  = true;
        }
    }

    if (!hayAlguna) return null;
    if (sumaPesos === 0) return null;
    return sumaNotas / sumaPesos;
}

/**
 * Determina si el alumno se exime del examen.
 * Prioridad: plantilla.umbralEximen > umbralFallback (global) > 5.0
 * Si plantilla.examenObligatorio === true, nunca se exime.
 */
function determinarEximen(plantilla, notasAlumno, umbralFallback) {
    if (plantilla.examenObligatorio) return false;
    const umbral = 5.5;
    const pp = calcularPromedioParcial(plantilla, notasAlumno);
    if (pp === null) return false;
    return pp >= umbral;
}

/**
 * Nota final ponderada usando todos los componentes (incl. EXAMEN).
 * Si se exime y no tiene nota de examen, redistribuye el peso del examen.
 */
function calcularNotaFinal(plantilla, notasAlumno, umbralFallback) {
    const compExamen = plantilla.componentes.find(c => c.key === 'EXAMEN');
    const notaExamen = compExamen
        ? calcularPromedioComponente(compExamen, notasAlumno)
        : null;

    const exime = determinarEximen(plantilla, notasAlumno, umbralFallback);
    const parcialesComps = plantilla.componentes.filter(c => c.key !== 'EXAMEN');

    // Verificar si hay al menos una nota parcial
    let hayParcial = false;
    for (const c of parcialesComps) {
        if (calcularPromedioComponente(c, notasAlumno) !== null) { hayParcial = true; break; }
    }
    if (!hayParcial) return null;

    // Calcular con examen presente
    if (notaExamen !== null) {
        let suma = 0;
        for (const comp of plantilla.componentes) {
            const prom = comp.key === 'EXAMEN'
                ? notaExamen
                : calcularPromedioComponente(comp, notasAlumno);
            suma += (prom || 0) * comp.peso;
        }
        return suma / 100;
    }

    // Sin examen: si se exime redistribuir peso, si no calcular solo parciales
    const pesoTotal = exime
        ? parcialesComps.reduce((s, c) => s + c.peso, 0)
        : 100;

    if (pesoTotal === 0) return null;

    let suma = 0;
    let pesoDenominador = 0;
    for (const comp of parcialesComps) {
        const prom = calcularPromedioComponente(comp, notasAlumno);
        suma += (prom || 0) * comp.peso;
        if (prom !== null) pesoDenominador += comp.peso;
    }

    return exime ? suma / pesoTotal : suma / 100;
}

// ── Utilidades ──
function redondear(valor, decimales = 2) {
    if (valor === null || valor === undefined || isNaN(valor)) return '—';
    return Math.round(valor * Math.pow(10, decimales)) / Math.pow(10, decimales);
}

function determinarEstado(notaFinal) {
    if (notaFinal === null || notaFinal === undefined) return 'SIN DATOS';
    return notaFinal >= 4.0 ? 'APROBADO' : 'REPROBADO';
}

/** Verifica si los porcentajes de las subs de un componente suman 100 */
function validarPorcentajesSubs(subs) {
    const total = subs.reduce((s, sub) => s + (parseFloat(sub.porcentaje) || 0), 0);
    return Math.abs(total - 100) < 0.01;
}

/** Verifica si los pesos de los componentes suman 100 */
function validarPesosComponentes(componentes) {
    const total = componentes.reduce((s, c) => s + (parseFloat(c.peso) || 0), 0);
    return Math.abs(total - 100) < 0.01;
}

/**
 * Para una sub vacía específica, calcula la nota mínima necesaria en esa sub
 * para que el promedio parcial alcance ≥ 5.5 (exención),
 * asumiendo que TODAS las demás subs vacías obtendrán 5.5.
 * @returns {number|null} nota mínima (puede estar fuera de [1,7]) o null si no aplica
 */
function calcularNotaParaEximirseEnSub(plantilla, notasAlumno, targetCompKey, targetSubNombre) {
    const UMBRAL = 5.5;
    if (plantilla.examenObligatorio) return null;
    const parcialesComps = plantilla.componentes.filter(c => c.key !== 'EXAMEN');

    let sumaFixed = 0, pesoFixed = 0, targetComp = null;

    for (const comp of parcialesComps) {
        if (comp.key !== targetCompKey) {
            // Otros componentes: mejor caso posible (vacíos = 7.0)
            // Así no penalizamos los ejercicios por un mal parcial de cátedra
            let sumNotas = 0, sumPct = 0;
            for (const sub of comp.subs) {
                const reg = notasAlumno.find(n => n.compKey === comp.key && n.subNombre === sub.nombre && n.nota != null);
                const nota = reg ? reg.nota : 7.0;
                sumNotas += nota * (sub.porcentaje || 0);
                sumPct   += sub.porcentaje || 0;
            }
            const promComp = sumPct > 0 ? sumNotas / sumPct : 5.5;
            sumaFixed += promComp * comp.peso;
            pesoFixed += comp.peso;
        } else {
            targetComp = comp;
        }
    }

    if (!targetComp) return null;
    const targetSub = targetComp.subs.find(s => s.nombre === targetSubNombre);
    if (!targetSub || !targetSub.porcentaje) return null;

    let sumSinX = 0, pctTotal = 0;
    for (const sub of targetComp.subs) {
        pctTotal += sub.porcentaje || 0;
        if (sub.nombre === targetSubNombre) continue;
        const reg = notasAlumno.find(n => n.compKey === targetComp.key && n.subNombre === sub.nombre && n.nota != null);
        const nota = reg ? reg.nota : 7.0;  // mismo componente: también mejor caso posible
        sumSinX += nota * (sub.porcentaje || 0);
    }

    const pesoTotal = pesoFixed + targetComp.peso;
    // Despejar X de: 5.5 * pesoTotal = sumaFixed + ((sumSinX + X * pctX) / pctTotal) * targetComp.peso
    return ((UMBRAL * pesoTotal - sumaFixed) * pctTotal / targetComp.peso - sumSinX) / targetSub.porcentaje;
}

/**
 * Calcula la nota mínima que se necesita en el examen para que la nota final >= 4.0.
 * Retorna: número (puede ser < 1, entre 1-7, o > 7), o null si no hay componente EXAMEN.
 */
function calcularNotaMinimaExamen(plantilla, notasAlumno) {
    const compExamen = plantilla.componentes.find(c => c.key === 'EXAMEN');
    if (!compExamen || compExamen.peso === 0) return null;

    let sumaNoExamen = 0;
    for (const comp of plantilla.componentes) {
        if (comp.key === 'EXAMEN') continue;
        const prom = calcularPromedioComponente(comp, notasAlumno);
        sumaNoExamen += (prom || 0) * comp.peso;
    }

    // 4.0 = (sumaNoExamen + notaExamen * pesoExamen) / 100
    return (400 - sumaNoExamen) / compExamen.peso;
}
