const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const pdfjsLib = require('../vendor/pdfjs/pdf.min.js');
const context = { pdfjsLib, console, $: () => ({ addEventListener() {} }) };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/importar-pdf.js'), 'utf8'), context);
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';

(async () => {
    for (const [codigo, pesos, recuperativa] of [
        ['523', [20, 45, 35], true], ['543', [30, 45, 25], true],
        ['551', [20, 45, 35], false], ['591', [30, 45, 25], false]
    ]) {
        const bytes = fs.readFileSync(path.join(__dirname, `../pdf/202610CVE${codigo}.pdf`));
        const lineas = await context.extraerLineasPdf({ arrayBuffer: async () => Uint8Array.from(bytes).buffer });
        const programa = context.analizarProgramaPdf(lineas);
        assert.ok(programa.nombre.includes(`CVE${codigo}`));
        assert.equal(programa.codigo, `CVE${codigo}`);
        assert.ok(programa.requisito);
        assert.equal(programa.examenObligatorio, false);
        assert.equal(programa.componentes[0].key, 'EJERCICIO');
        assert.equal(programa.componentes.at(-1).key, 'EXAMEN');
        assert.deepEqual(Array.from(programa.componentes, c => c.peso), pesos);
        const catedra = programa.componentes.find(c => c.key === 'CATEDRA');
        assert.equal(catedra.reglaRecuperativa === 'reemplazaMenor', recuperativa);
        assert.ok(catedra.subs.some(s => s.nombre === 'CATEDRA 1' && s.contenido.includes('RAA')));
        assert.equal(programa.componentes.find(c => c.key === 'EJERCICIO').subs.length, 4);
    }
    for (const [archivo, esperado] of [
        ['pdf/8/202610CVE090.pdf', true],
        ['pdf/5/202610CVE995.pdf', true],
        ['pdf/7/202610CVE921.pdf', true],
        ['pdf/8/202610CVE933.pdf', false],
        ['pdf/8/202610CVE934.pdf', false]
    ]) {
        const ruta = path.join(__dirname, '..', archivo);
        if (!fs.existsSync(ruta)) continue;
        const bytes = fs.readFileSync(ruta);
        const lineas = await context.extraerLineasPdf({ arrayBuffer: async () => Uint8Array.from(bytes).buffer });
        assert.equal(context.detectarReglaExamen(lineas.join('\n')), esperado, archivo);
        if (archivo.includes('CVE090') || archivo.includes('CVE995')) {
            const p = context.analizarProgramaPdf(lineas);
            assert.equal(p.examenObligatorio, true, archivo);
            if (archivo.includes('CVE090')) assert.ok(p.condicionesNoCalculadas.some(a => a.includes('docente guía')));
        }
        if (archivo.includes('CVE921')) {
            const p = context.analizarProgramaPdf(lineas);
            assert.equal(p.codigo, 'CVE921');
            assert.equal(p.examenObligatorio, true);
            assert.deepEqual(Array.from(p.componentes, c => c.key), ['CATEDRA', 'EXAMEN']);
            assert.deepEqual(Array.from(p.componentes, c => c.peso), [60, 40]);
            assert.equal(p.componentes[0].subs.length, 2);
            assert.ok(p.condicionesNoCalculadas.some(a => a.includes('carta firmada')));
            assert.ok(p.avisos.some(a => a.includes('dos instancias')));
        }
    }
    const rutaVariasJornadas = path.join(__dirname, '../pdf/5/202610CVE792.pdf');
    if (fs.existsSync(rutaVariasJornadas)) {
        const bytes = fs.readFileSync(rutaVariasJornadas);
        const lineas = await context.extraerLineasPdf({ arrayBuffer: async () => Uint8Array.from(bytes).buffer });
        const p = context.analizarProgramaPdf(lineas);
        assert.equal(p.codigo, 'CVE792');
        assert.deepEqual(Array.from(p.componentes, c => c.peso), [30, 45, 25]);
        assert.equal(p.requiereRevisionPonderaciones, false);
        assert.equal(p.componentes.find(c => c.key === 'CATEDRA').reglaRecuperativa, 'reemplazaMenor');
        assert.ok(p.avisos.some(a => a.includes('primera tabla completa')));
    }
    const tablasDistintas = [
        'PROGRAMA DE ASIGNATURA: PRUEBA - CVE999.', '7.1. PONDERACIONES',
        'EXAMEN 40 EXAMEN 100', 'CATEDRA 60 CATEDRA 1 100', 'PRESENCIAL DIURNO',
        'EXAMEN 30 EXAMEN 100', 'CATEDRA 70 CATEDRA 1 100', 'PRESENCIAL EXECUTIVE',
        '7.2. ESTRATEGIA EVALUATIVA'
    ];
    const diferentes = context.analizarProgramaPdf(tablasDistintas);
    assert.deepEqual(Array.from(diferentes.componentes, c => c.peso), [60, 40]);
    assert.equal(diferentes.requiereRevisionPonderaciones, true);
    assert.ok(diferentes.avisos.some(a => a.includes('ponderaciones o evaluaciones obligatorias difieren')));
    const permitida = 'EXIMICIÓN DE EXAMEN: con nota 5,5 o superior quedarán eximidos de realizar el examen.';
    assert.equal(context.detectarReglaExamen('En esta asignatura no está considerada la eximición.'), true);
    assert.equal(context.detectarReglaExamen('Por lo tanto, no hay eximición de examen.'), true);
    assert.equal(context.detectarReglaExamen(permitida), false);
    assert.equal(context.detectarReglaExamen(`${permitida} No hay eximición de examen.`), null);
    assert.equal(context.detectarReglaExamen('No se indica ninguna norma de exención.'), null);
    assert.equal(context.detectarReglaExamen('Exención con 6,0: los alumnos quedarán eximidos.'), null);
    assert.throws(() => context.analizarProgramaPdf(['Documento sin tabla']), /No se encontró/);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/calculos.js'), 'utf8'), context);
    const porRevisar = { examenObligatorio: false, requiereRevisionPonderaciones: true, componentes: [
        { key: 'CATEDRA', peso: 60, subs: [{ nombre: 'C1', porcentaje: 100 }] },
        { key: 'EXAMEN', peso: 40, subs: [{ nombre: 'EXAMEN', porcentaje: 100 }] }
    ] };
    const notasRevision = [{ compKey: 'CATEDRA', subNombre: 'C1', nota: 6 }];
    assert.equal(context.determinarEximen(porRevisar, notasRevision), false);
    porRevisar.requiereRevisionPonderaciones = false;
    assert.equal(context.determinarEximen(porRevisar, notasRevision), true);
    const comp = { key: 'CATEDRA', peso: 100, reglaRecuperativa: 'reemplazaMenor', subs: [
        { nombre: 'CATEDRA 1', porcentaje: 33.33 }, { nombre: 'CATEDRA 2', porcentaje: 33.33 },
        { nombre: 'CATEDRA 3', porcentaje: 33.33 }, { nombre: 'CATEDRA RECUPERATIVA', porcentaje: 0 }
    ] };
    const notas = [4, 5, 6, 7].map((nota, i) => ({ compKey: 'CATEDRA', subNombre: comp.subs[i].nombre, nota }));
    assert.ok(Math.abs(context.calcularPromedioComponente(comp, notas) - 6) < 1e-9);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/malla.js'), 'utf8'), context);
    const requisito = context.interpretarRequisito('(CVE-421 4,0) y (CVE-391 4,0 o CVE-221 4,0)');
    assert.equal(context.evaluarRequisito(requisito, { CVE421: 4.5, CVE221: 4 }), 'cumplido');
    assert.equal(context.evaluarRequisito(requisito, { CVE421: 3 }), 'no cumplido');
    assert.equal(context.evaluarRequisito(requisito, { CVE421: 4.5 }), 'desconocido');
    assert.equal(context.interpretarRequisito('Permiso especial o CVE-421 4,0'), null);
    const aprobado = context.interpretarRequisito('(CVE-543 Aprobado y CVE-3317 Aprobado)');
    assert.equal(context.evaluarRequisito(aprobado, { CVE543: 4, CVE3317: 4 }), 'cumplido');
    assert.equal(context.codigoDePlantilla({ nombre: 'GENÉTICA - NRC 7725' }), 'CBI514');
    assert.equal(context.codigoDePlantilla({ nombre: 'OBSTETRICIA Y GINECOLOGÍA - NRC 9361' }), 'CVE833');
    assert.equal(context.formatearNombreRamo({ nombre: 'OBSTETRICIA Y GINECOLOGÍA - NRC 9361' }), 'CVE833 · OBSTETRICIA Y GINECOLOGÍA - NRC 9361');
    assert.equal(context.formatearNombreRamo({ nombre: 'INMUNOLOGÍA - CVE-523', codigo: 'CVE523' }), 'CVE523 · INMUNOLOGÍA');
    assert.equal(context.formatearNombreRamo({ nombre: 'CVE523 - INMUNOLOGÍA', codigo: 'CVE523' }), 'CVE523 · INMUNOLOGÍA');
    assert.equal(context.formatearNombreRamo({ nombre: 'Ramo sin código' }), 'Ramo sin código');
    assert.equal(context.relacionConRequisito(requisito, 'CVE421').obligatorio, true);
    assert.equal(context.relacionConRequisito(requisito, 'CVE221').obligatorio, false);
    const futuros = context.obtenerDependientes('CVE833', []);
    assert.equal(futuros.length, 1);
    assert.equal(futuros[0].destino.codigo, 'CVE995');
    assert.equal(futuros[0].destino.semestre, 5);
    assert.equal(futuros[0].relacion.obligatorio, true);
    assert.equal(context.obtenerDependientes('CVE211', []).length, 0);
    const semiologia = context.obtenerDependientes('CVE631', []).find(x => x.destino.codigo === 'CVE732');
    assert.ok(semiologia && semiologia.relacion.obligatorio && semiologia.destino.semestre === 5);
    assert.equal(context.evaluarRequisito(context.interpretarRequisito(semiologia.destino.requisito), { CVE631: 4 }), 'cumplido');
    assert.equal(context.evaluarRequisito(context.interpretarRequisito(semiologia.destino.requisito), { CVE631: 3.9 }), 'no cumplido');
    const porcina = context.obtenerDependientes('CVE543', []).find(x => x.destino.codigo === 'CVE744');
    assert.ok(porcina && porcina.relacion.obligatorio);
    const requisitoPorcina = context.interpretarRequisito(porcina.destino.requisito);
    assert.equal(context.evaluarRequisito(requisitoPorcina, { CVE543: 4, CVE3317: 4 }), 'cumplido');
    assert.equal(context.evaluarRequisito(requisitoPorcina, { CVE543: 4 }), 'desconocido');
    assert.equal(context.evaluarRequisito(requisitoPorcina, { CVE543: 4, CVE3317: 3.9 }), 'no cumplido');
    const porcinaImportada = context.obtenerDependientes('CVE543', [{ codigo: 'CVE744', nombre: 'Producción porcina', semestre: 5, requisito: '(CVE-111 4,0)' }]);
    assert.ok(porcinaImportada.some(x => x.destino.codigo === 'CVE744' && x.relacion.obligatorio));
    const alternativas = context.obtenerDependientes('CVE221', []);
    assert.ok(alternativas.some(x => x.destino.codigo === 'CVE591' && !x.relacion.obligatorio));
    const importadaSinSemestre = { codigo: 'CVE777', nombre: 'Ramo importado', semestre: null, requisito: '(CBI-514 4,0) y (CVE-543 4,0 o CVE-221 4,0)' };
    const relacionesImportadas = context.obtenerDependientes('CBI514', [importadaSinSemestre]);
    assert.ok(relacionesImportadas.some(x => x.destino.codigo === 'CVE777' && x.relacion.obligatorio && x.destino.semestre === null));
    const relacionAlternativa = context.obtenerDependientes('CVE543', [importadaSinSemestre]).find(x => x.destino.codigo === 'CVE777');
    assert.ok(relacionAlternativa && !relacionAlternativa.relacion.obligatorio);
    notas[0].nota = 0;
    assert.ok(Math.abs(context.calcularPromedioComponente(comp, notas) - 6) < 1e-9);
    console.log('Importación y recuperativa: pruebas correctas');
})().catch(error => { console.error(error); process.exitCode = 1; });
