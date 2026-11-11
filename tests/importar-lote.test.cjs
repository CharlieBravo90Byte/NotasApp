const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const registros = [
    { id: 1, codigo: 'CVE900', nombre: 'Existente', requisito: '(CVE-100 4,0)', examenObligatorio: true, componentes: ['original'] },
    { id: 2, codigo: 'CVE901', nombre: 'Sin requisito', requisito: null, examenObligatorio: null, componentes: ['conservar'] },
    { id: 3, codigo: 'CVE904', nombre: 'Examen pendiente', requisito: '(CVE-100 4,0)', examenObligatorio: null, componentes: ['original'] }
];
const context = {
    pdfjsLib: { GlobalWorkerOptions: {} },
    console: { error() {} },
    $: () => ({ addEventListener() {} }),
    obtenerPlantillas: async () => registros.map(r => ({ ...r })),
    actualizarPlantilla: async p => { registros[registros.findIndex(r => r.id === p.id)] = p; },
    crearPlantilla: async (nombre, componentes, extras) => {
        registros.push({ id: registros.length + 1, nombre, componentes, ...extras });
    }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/malla.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/importar-pdf.js'), 'utf8'), context);
context.extraerLineasPdf = async archivo => {
    if (!archivo.programa) throw new Error('PDF no legible');
    return archivo.programa;
};
context.analizarProgramaPdf = lineas => lineas;
const programa = (codigo, requisito = null) => ({ codigo, nombre: `Ramo ${codigo}`, requisito, componentes: [], examenObligatorio: false, avisos: [] });

(async () => {
    const archivos = [
        { name: 'existente.pdf', programa: programa('CVE900', '(CVE-999 4,0)') },
        { name: 'actualizar.pdf', programa: programa('CVE901', '(CVE-100 4,0)') },
        { name: 'nuevo.pdf', programa: programa('CVE902') },
        { name: 'nuevo-repetido.pdf', programa: programa('CVE902') },
        { name: 'ilegible.pdf' },
        { name: 'siguiente.pdf', programa: programa('CVE903') },
        { name: 'regla.pdf', programa: { ...programa('CVE904', '(CVE-100 4,0)'), examenObligatorio: true, condicionesNoCalculadas: ['Revisar condición'] } }
    ];
    const avance = [];
    const resultados = await context.procesarArchivosProgramas(archivos, (r, n, total) => avance.push([r.archivo, n, total]));
    assert.deepEqual(Array.from(resultados, r => r.estado), ['existente', 'actualizado', 'importado', 'existente', 'error', 'importado', 'actualizado']);
    assert.equal(avance.length, archivos.length);
    assert.equal(registros.filter(r => r.codigo === 'CVE902').length, 1);
    assert.equal(registros.find(r => r.codigo === 'CVE900').requisito, '(CVE-100 4,0)');
    assert.equal(registros.find(r => r.codigo === 'CVE900').examenObligatorio, true);
    assert.equal(registros.find(r => r.codigo === 'CVE901').requisito, '(CVE-100 4,0)');
    assert.equal(registros.find(r => r.codigo === 'CVE901').examenObligatorio, false);
    assert.deepEqual(registros.find(r => r.codigo === 'CVE901').componentes, ['conservar']);
    assert.equal(registros.find(r => r.codigo === 'CVE904').examenObligatorio, true);
    assert.deepEqual(registros.find(r => r.codigo === 'CVE904').condicionesNoCalculadas, ['Revisar condición']);
    assert.ok(registros.some(r => r.codigo === 'CVE903'));
    console.log('Importación por lotes: pruebas correctas');
})().catch(error => { console.error(error); process.exitCode = 1; });
