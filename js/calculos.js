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
    const umbral = (plantilla.umbralEximen !== undefined && plantilla.umbralEximen !== null)
        ? plantilla.umbralEximen
        : (umbralFallback ?? 5.0);
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
function redondear(valor, decimales = 1) {
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
