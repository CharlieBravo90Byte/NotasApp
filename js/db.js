// ══════════════════════════════════════
//  db.js — IndexedDB persistence layer v3
//
//  MODELO:
//  ┌─────────────────────────────────────────────────────┐
//  │  plantillas  → estructura del ramo (global, fija)   │
//  │    id, nombre, componentes[]                        │
//  │      componente: { key, label, peso, subs[] }       │
//  │        sub: { nombre, porcentaje }                  │
//  │                                                     │
//  │  usuarios   → alumnos                               │
//  │    id, nombre                                       │
//  │                                                     │
//  │  notas      → nota de un alumno en una sub          │
//  │    usuarioId, plantillaId, compKey, subNombre, nota │
//  └─────────────────────────────────────────────────────┘
// ══════════════════════════════════════

const DB_NAME    = 'NotasAppDB';
const DB_VERSION = 3;
let db = null;

// ── Inicializar ──
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const database  = e.target.result;
            const oldStores = Array.from(database.objectStoreNames);

            // Eliminar stores viejos si existen (migración limpia)
            ['ramos', 'notas'].forEach(s => {
                if (oldStores.includes(s)) database.deleteObjectStore(s);
            });

            // usuarios
            if (!oldStores.includes('usuarios')) {
                const us = database.createObjectStore('usuarios', { keyPath: 'id', autoIncrement: true });
                us.createIndex('nombre', 'nombre', { unique: false });
            }

            // plantillas (estructura global del ramo)
            if (!oldStores.includes('plantillas')) {
                database.createObjectStore('plantillas', { keyPath: 'id', autoIncrement: true });
            }

            // notas por alumno+plantilla
            const ns = database.createObjectStore('notas', { keyPath: 'id', autoIncrement: true });
            ns.createIndex('byUsuarioPlantilla', ['usuarioId', 'plantillaId'], { unique: false });
        };

        request.onsuccess = (e) => { db = e.target.result; resolve(db); };
        request.onerror   = (e) => reject(new Error('Error DB: ' + e.target.error));
    });
}

// ── Helpers ──
function getStore(name, mode = 'readonly') {
    return db.transaction(name, mode).objectStore(name);
}
function promisifyRequest(req) {
    return new Promise((res, rej) => {
        req.onsuccess = () => res(req.result);
        req.onerror   = () => rej(req.error);
    });
}

// ════════════════════════════════════════
//  USUARIOS
// ════════════════════════════════════════
function crearUsuario(nombre) {
    return promisifyRequest(
        getStore('usuarios', 'readwrite').add({ nombre, fechaCreacion: new Date().toISOString() })
    );
}

function obtenerUsuarios() {
    return promisifyRequest(getStore('usuarios').getAll());
}

async function eliminarUsuario(id) {
    const todasNotas = await promisifyRequest(getStore('notas').getAll());
    const store = getStore('notas', 'readwrite');
    for (const n of todasNotas.filter(n => n.usuarioId === id)) {
        await promisifyRequest(store.delete(n.id));
    }
    await promisifyRequest(getStore('usuarios', 'readwrite').delete(id));
}

// ════════════════════════════════════════
//  PLANTILLAS (estructura del ramo, global)
//
//  plantilla = {
//    id, nombre,
//    componentes: [
//      { key: 'EJERCICIO', label: 'Ejercicios', peso: 30,
//        subs: [ { nombre: 'Ejercicio 1', porcentaje: 25 }, ... ] },
//      { key: 'CATEDRA', label: 'Cátedras', peso: 45, subs: [...] },
//      { key: 'EXAMEN',  label: 'Examen',   peso: 25, subs: [...] }
//    ]
//  }
// ════════════════════════════════════════
function crearPlantilla(nombre, componentes, extras = {}) {
    return promisifyRequest(
        getStore('plantillas', 'readwrite').add({
            nombre, componentes,
            umbralEximen:      extras.umbralEximen      ?? null,
            examenObligatorio: extras.examenObligatorio ?? false,
            fechaCreacion: new Date().toISOString()
        })
    );
}

function obtenerPlantillas() {
    return promisifyRequest(getStore('plantillas').getAll());
}

function obtenerPlantilla(id) {
    return promisifyRequest(getStore('plantillas').get(id));
}

function actualizarPlantilla(plantilla) {
    return promisifyRequest(getStore('plantillas', 'readwrite').put(plantilla));
}

async function eliminarPlantilla(id) {
    const todasNotas = await promisifyRequest(getStore('notas').getAll());
    const store = getStore('notas', 'readwrite');
    for (const n of todasNotas.filter(n => n.plantillaId === id)) {
        await promisifyRequest(store.delete(n.id));
    }
    await promisifyRequest(getStore('plantillas', 'readwrite').delete(id));
}

// ════════════════════════════════════════
//  NOTAS (por alumno + plantilla)
// ════════════════════════════════════════

/** Guarda o actualiza la nota de un alumno en un subcomponente específico */
async function guardarNota(usuarioId, plantillaId, compKey, subNombre, nota) {
    const todas    = await obtenerNotasPorUsuarioPlantilla(usuarioId, plantillaId);
    const existente = todas.find(n => n.compKey === compKey && n.subNombre === subNombre);
    const store    = getStore('notas', 'readwrite');
    const data     = {
        usuarioId, plantillaId, compKey, subNombre, nota,
        fechaActualizacion: new Date().toISOString()
    };
    if (existente) {
        data.id = existente.id;
        return promisifyRequest(store.put(data));
    }
    return promisifyRequest(store.add(data));
}

function obtenerNotasPorUsuarioPlantilla(usuarioId, plantillaId) {
    return new Promise((resolve, reject) => {
        const index = getStore('notas').index('byUsuarioPlantilla');
        const req   = index.getAll([usuarioId, plantillaId]);
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
    });
}

/** Elimina notas huérfanas cuando se borra un subcomponente de la plantilla */
async function limpiarNotasHuerfanas(usuarioId, plantillaId, compKey, subNombre) {
    const todas = await obtenerNotasPorUsuarioPlantilla(usuarioId, plantillaId);
    const n     = todas.find(n => n.compKey === compKey && n.subNombre === subNombre);
    if (n) await promisifyRequest(getStore('notas', 'readwrite').delete(n.id));
}

/** Borra TODAS las notas de todos los alumnos para un sub dado (cuando se elimina de plantilla) */
async function eliminarNotasDeSub(plantillaId, compKey, subNombre) {
    const todas = await promisifyRequest(getStore('notas').getAll());
    const store = getStore('notas', 'readwrite');
    for (const n of todas.filter(n =>
        n.plantillaId === plantillaId &&
        n.compKey     === compKey &&
        n.subNombre   === subNombre
    )) {
        await promisifyRequest(store.delete(n.id));
    }
}

// ════════════════════════════════════════
//  EXPORTAR
// ════════════════════════════════════════
async function exportarDatos(usuarioId) {
    const usuarios  = await obtenerUsuarios();
    const usuario   = usuarios.find(u => u.id === usuarioId);
    if (!usuario) throw new Error('Usuario no encontrado');

    const plantillas = await obtenerPlantillas();
    const resultado  = [];
    for (const p of plantillas) {
        const notas = await obtenerNotasPorUsuarioPlantilla(usuarioId, p.id);
        resultado.push({ ...p, notas });
    }

    return {
        exportDate: new Date().toISOString(),
        app: 'NotasApp v3.0',
        usuario,
        plantillas: resultado
    };
}
