const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const leer = archivo => fs.readFileSync(path.join(__dirname, '..', archivo), 'utf8');
const app = { $: () => ({ addEventListener() {} }) };
vm.createContext(app);
vm.runInContext(leer('js/portal.js'), app);
const plantilla = { componentes: [
    { key: 'EJERCICIO', label: 'EJERCICIO', peso: 25, subs: [1, 2, 3, 4].map(n => ({ nombre: `EJERCICIO ${n}`, porcentaje: 25 })) },
    { key: 'CATEDRA', label: 'CATEDRA', peso: 45, subs: [
        { nombre: 'CATEDRA RECUPERATIVA', porcentaje: 0 },
        ...[1, 2, 3].map(n => ({ nombre: `CATEDRA ${n}`, porcentaje: 33.33 })),
        { nombre: 'CATEDRA DIAGNOSTICO', porcentaje: 0 }
    ] },
    { key: 'EXAMEN', label: 'EXAMEN', peso: 30, subs: [{ nombre: 'EXAMEN', porcentaje: 100 }] }
] };
const texto = '**Notas** [svg](http://ejemplo) **ComponenteSubcomponente% ParcialNota Parcial% Nota FinalNota FinalEJERCICIO**EJERCICIO 125%-EJERCICIO 225%-EJERCICIO 325%-EJERCICIO 425%-**100%10%-CATEDRA**CATEDRA RECUPERATIVA33.33%-CATEDRA 133.33%5,3CATEDRA 233.33%6,9CATEDRA 333.33%-CATEDRA DIAGNOSTICO0%-**100%60%-EXAMEN**EXAMEN100%-**100%30%-PROMEDIO FINAL100%-**';
const resultado = app.analizarTextoPortal(texto, plantilla);
assert.equal(resultado.filas.length, 10);
assert.equal(resultado.filas.find(f => f.subNombre === 'CATEDRA 1').notaPortal, 5.3);
assert.equal(resultado.filas.find(f => f.subNombre === 'CATEDRA 2').notaPortal, 6.9);
assert.equal(resultado.filas.find(f => f.subNombre === 'EXAMEN').notaPortal, null);
assert.equal(resultado.noEncontradas.length, 0);
assert.ok(resultado.diferencias.some(s => s.includes('peso portal 10 %, app 25 %')));
assert.ok(resultado.diferencias.some(s => s.includes('peso portal 60 %, app 45 %')));
assert.throws(() => app.analizarTextoPortal('Texto sin tabla', plantilla), /No se reconocieron/);
assert.throws(() => app.analizarTextoPortal('CATEDRA 1 33.33%\n5,3', plantilla, { porLinea: true }), /No se reconocieron/);
assert.equal(app.analizarTextoPortal('CATEDRA 1 33.33% 5,3\nCATEDRA 2 33.33% 6,9', plantilla, { porLinea: true }).filas.length, 2);
const capturaMovil = `2306 OU 8 03% 00090
(M miudlaintranet.udla.cl/mi: + (3) :
GENÉTICA - NRC 7725
Notas O
EJERCICIO
EJERCICIO 1 25% - 7]
EJERCICIO 2 25% -
EJERCICIO 3 25% - Nota Final
EJERCICIO 4 25% - |
CATEDRA
CATEDRA 33.33% -
RECUPERATIVA o
% Nota Final
CATEDRA 1 33.33% 5,3
CATEDRA 2 33.33% 6,9
Nota Final
CATEDRA 3 33.33% - lo]
CATEDRA 0% -
DIAGNOSTICO`;
const movil = app.analizarTextoPortal(capturaMovil, plantilla, { porLinea: true });
assert.equal(movil.filas.length, 9);
assert.equal(movil.filas.find(f => f.subNombre === 'CATEDRA 1').notaPortal, 5.3);
assert.equal(movil.filas.find(f => f.subNombre === 'CATEDRA 2').notaPortal, 6.9);
assert.equal(movil.filas.find(f => f.subNombre === 'CATEDRA 3').notaPortal, null);
assert.equal(movil.filas.find(f => f.subNombre === 'CATEDRA RECUPERATIVA').porcentajePortal, 33.33);
assert.ok(movil.recuperativas.some(s => s.includes('toma el peso de la evaluación marcada N/P')));
assert.equal(movil.filas.find(f => f.subNombre === 'CATEDRA DIAGNOSTICO').porcentajePortal, 0);
assert.ok(movil.noEncontradas.some(f => f.includes('EXAMEN')));
assert.throws(() => app.analizarTextoPortal('CATEDRA 33.33% -', plantilla, { porLinea: true }), /No se reconocieron/);
assert.equal(app.analizarTextoPortal('CATEDRA 3 33.33% -\nCATEDRA 3 33.33% - ruido', plantilla, { porLinea: true }).filas.length, 1);
assert.throws(() => app.analizarTextoPortal('CATEDRA 3 33.33% 5,3\nCATEDRA 3 33.33% 6,9', plantilla, { porLinea: true }), /más de una vez con datos distintos/);
assert.equal(app.unirTextoCapturas(['CATEDRA 1 33% 5,3\nCATEDRA 2 33% 6,9', 'CATEDRA 2 33% 6,9\nCATEDRA 3 33% -']), 'CATEDRA 1 33% 5,3\nCATEDRA 2 33% 6,9\nCATEDRA 3 33% -');
assert.throws(() => app.analizarTextoPortal('CATEDRA 1 33.33% 5,3 CATEDRA 1 33.33% 6,9', plantilla), /más de una vez/);
const conSaltos = app.analizarTextoPortal('Cátedra 1\t33,33%\t5,3\nCátedra 2\t33,33%\tN/P', plantilla);
assert.equal(conSaltos.filas.length, 1);
assert.equal(conSaltos.filas[0].notaPortal, 5.3);
assert.ok(conSaltos.ambiguas.some(a => a.includes('N/P')));
const nombresAmbiguos = { componentes: [{ key: 'CATEDRA', label: 'CATEDRA', peso: 100, subs: [
    { nombre: 'CATEDRA 1', porcentaje: 33.33 }, { nombre: 'CATEDRA 13', porcentaje: 3.33 }
] }] };
assert.throws(() => app.analizarTextoPortal('CATEDRA 133.33%5,3', nombresAmbiguos), /ambiguo/);

// Simula IndexedDB para comprobar que las dos columnas no se sobrescriben.
const registros = [{ id: 1, usuarioId: 1, plantillaId: 2, compKey: 'CATEDRA', subNombre: 'CATEDRA 1', nota: 5.8, notaPortal: 5.3 }];
function solicitud(valor) {
    const req = {};
    queueMicrotask(() => { req.result = valor; if (req.onsuccess) req.onsuccess(); });
    return req;
}
const database = { transaction() {
    const tx = { objectStore() { return {
        index: () => ({ getAll: ([u, p]) => solicitud(registros.filter(r => r.usuarioId === u && r.plantillaId === p).map(r => ({ ...r }))) }),
        put: valor => { registros[registros.findIndex(r => r.id === valor.id)] = { ...valor }; setTimeout(() => tx.oncomplete?.(), 0); return solicitud(valor.id); },
        add: valor => { const id = Math.max(0, ...registros.map(r => r.id)) + 1; registros.push({ ...valor, id }); setTimeout(() => tx.oncomplete?.(), 0); return solicitud(id); }
    }; } };
    return tx;
} };
const bd = { stub: database, setTimeout, queueMicrotask, Date };
vm.createContext(bd);
vm.runInContext(leer('js/db.js') + '\ndb = stub;', bd);
vm.runInContext(leer('js/calculos.js'), bd);
const catedra = plantilla.componentes.find(c => c.key === 'CATEDRA');
const registro = (subNombre, nota) => ({ compKey: 'CATEDRA', subNombre, nota });
const recup = registro('CATEDRA RECUPERATIVA', 4.5);
const catedrasNP = [registro('CATEDRA 1', 5.3), registro('CATEDRA 2', 0), registro('CATEDRA 3', 6.9)];
assert.equal(bd.componentesCompletos([catedra], catedrasNP), false);
assert.equal(bd.componentesCompletos([catedra], [...catedrasNP, recup]), true);
assert.ok(Math.abs(bd.calcularPromedioComponente(catedra, [...catedrasNP, recup]) - (5.3 + 4.5 + 6.9) / 3) < 1e-9);
assert.equal(bd.calcularPromedioComponente(catedra, [recup]), null);
assert.ok(Math.abs(bd.calcularPromedioComponente(catedra, [registro('CATEDRA 1', 5.3), registro('CATEDRA 2', 6.9), registro('CATEDRA 3', 5), recup]) - (5.3 + 6.9 + 5) / 3) < 1e-9);
(async () => {
    await bd.guardarNota(1, 2, 'CATEDRA', 'CATEDRA 1', 6.1);
    assert.equal(registros[0].notaPortal, 5.3);
    await bd.guardarNotasPortal(1, 2, [
        { compKey: 'CATEDRA', subNombre: 'CATEDRA 1', notaPortal: 5.5 },
        { compKey: 'CATEDRA', subNombre: 'CATEDRA 2', notaPortal: 6.9 }
    ]);
    assert.equal(registros[0].nota, 6.1);
    assert.equal(registros[0].notaPortal, 5.5);
    assert.equal(registros[1].nota, null);
    assert.equal(registros[1].notaPortal, 6.9);
    assert.equal(bd.calcularPromedioComponente({ key: 'CATEDRA', subs: [{ nombre: 'CATEDRA 2', porcentaje: 100 }] }, [registros[1]]), null);
    console.log('MiUDLA: texto pegado y separación de notas correctas');
})().catch(error => { console.error(error); process.exitCode = 1; });
