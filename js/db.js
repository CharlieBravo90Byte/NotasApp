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
//  SEED — Ramos predeterminados
//  Solo se insertan si la base de datos está vacía (primera ejecución).
// ════════════════════════════════════════

// Cada entrada tiene un `predKey` único e inmutable que permite
// detectar y actualizar la plantilla en DB aunque el nombre cambie.
const PLANTILLAS_PREDETERMINADAS = [
    {
        predKey: 'GENETICA_7725',
        nombre: 'GENÉTICA - NRC 7725',
        umbralEximen: 5.5,
        examenObligatorio: false,
        componentes: [
            {
                key: 'EJERCICIO', label: 'EJERCICIO', peso: 25, color: '#16a34a',
                subs: [
                    { nombre: 'EJERCICIO 1', porcentaje: 25, contenido: 'RAA1; conceptos básicos de genética y mecanismos de transmisión hereditaria.', fecha: '' },
                    { nombre: 'EJERCICIO 2', porcentaje: 25, contenido: 'RAA2; variación genética cualitativa/cuantitativa y su relación con sistemas agroproductivos.', fecha: '' },
                    { nombre: 'EJERCICIO 3', porcentaje: 25, contenido: 'RAA3; ejercicios de genética clásica y moderna aplicada a casos prácticos.', fecha: '' },
                    { nombre: 'EJERCICIO 4', porcentaje: 25, contenido: 'RAA4; genética mendeliana, poblaciones y cuantitativa con mejoramiento genético.', fecha: '' }
                ]
            },
            {
                key: 'CATEDRA', label: 'CATEDRA', peso: 45, color: '#8b5cf6',
                subs: [
                    { nombre: 'CATEDRA RECUPERATIVA', porcentaje: 0, contenido: 'Recuperación de contenidos pendientes de la unidad de genética.', fecha: '' },
                    { nombre: 'CATEDRA 1', porcentaje: 33.33, contenido: 'RAA1 + RAA2: conceptos generales de transmisión hereditaria y variación genética.', fecha: '' },
                    { nombre: 'CATEDRA 2', porcentaje: 33.33, contenido: 'RAA3 + RAA4: ejercicios de genética clásica, poblacional y cuantitativa.', fecha: '' },
                    { nombre: 'CATEDRA 3', porcentaje: 33.34, contenido: 'RAA5 + RAA7: mecanismos de cambio genético y trabajo colaborativo en resolución de problemas.', fecha: '' },
                    { nombre: 'CATEDRA DIAGNOSTICO', porcentaje: 0, contenido: 'Diagnóstico inicial de conceptos y preparación para la unidad.', fecha: '' }
                ]
            },
            {
                key: 'EXAMEN', label: 'EXAMEN', peso: 30, color: '#dc2626',
                subs: [{ nombre: 'EXAMEN', porcentaje: 100, contenido: 'RAA1 a RAA7: integración general de conceptos, ejercicios y aplicación en genética.', fecha: '' }]
            }
        ]
    },
    {
        predKey: 'ENFERMEDADES_PARASITARIAS_9102',
        nombre: 'ENFERMEDADES PARASITARIAS - NRC 9102',
        umbralEximen: 5.5,
        examenObligatorio: true,
        componentes: [
            {
                key: 'EJERCICIO', label: 'EJERCICIO', peso: 30, color: '#16a34a',
                subs: [
                    { nombre: 'EJERCICIO 1', porcentaje: 12.5, contenido: 'Tema según cronograma de la unidad; revisar contenido asignado por la docente.', fecha: '' },
                    { nombre: 'EJERCICIO 2', porcentaje: 12.5, contenido: 'Tema según cronograma de la unidad; revisar contenido asignado por la docente.', fecha: '' },
                    { nombre: 'EJERCICIO 3', porcentaje: 12.5, contenido: 'Tema según cronograma de la unidad; revisar contenido asignado por la docente.', fecha: '' },
                    { nombre: 'EJERCICIO 4', porcentaje: 12.5, contenido: 'Tema según cronograma de la unidad; revisar contenido asignado por la docente.', fecha: '' },
                    { nombre: 'EJERCICIO 5', porcentaje: 12.5, contenido: 'Tema según cronograma de la unidad; revisar contenido asignado por la docente.', fecha: '' },
                    { nombre: 'EJERCICIO 6', porcentaje: 12.5, contenido: 'Tema según cronograma de la unidad; revisar contenido asignado por la docente.', fecha: '' },
                    { nombre: 'EJERCICIO 7', porcentaje: 12.5, contenido: 'Tema según cronograma de la unidad; revisar contenido asignado por la docente.', fecha: '' },
                    { nombre: 'EJERCICIO 8', porcentaje: 12.5, contenido: 'Tema según cronograma de la unidad; revisar contenido asignado por la docente.', fecha: '' }
                ]
            },
            {
                key: 'CATEDRA', label: 'CATEDRA', peso: 40, color: '#8b5cf6',
                subs: [
                    { nombre: 'CATEDRA RECUPERATIVA', porcentaje: 0, contenido: 'Recuperación de contenidos pendientes.', fecha: '' },
                    { nombre: 'CATEDRA 1', porcentaje: 25, contenido: 'Control de contenidos semestrales según cronograma.', fecha: '2026-08-26' },
                    { nombre: 'CATEDRA 2', porcentaje: 25, contenido: 'Control de contenidos semestrales según cronograma.', fecha: '' },
                    { nombre: 'CATEDRA 3', porcentaje: 25, contenido: 'Control de contenidos semestrales según cronograma.', fecha: '' },
                    { nombre: 'CATEDRA 4', porcentaje: 25, contenido: 'Control de contenidos semestrales según cronograma.', fecha: '' },
                    { nombre: 'CATEDRA DIAGNOSTICO', porcentaje: 0, contenido: 'Diagnóstico inicial de conocimientos.', fecha: '' }
                ]
            },
            {
                key: 'EXAMEN', label: 'EXAMEN', peso: 30, color: '#dc2626',
                subs: [{ nombre: 'EXAMEN', porcentaje: 100, contenido: 'Examen final integrado del ramo.', fecha: '' }]
            }
        ]
    },
    {
        predKey: 'FARMACOLOGIA_TOXICOLOGIA_9165',
        nombre: 'FARMACOLOGÍA Y TOXICOLOGÍA - NRC 9165',
        umbralEximen: 5.5,
        examenObligatorio: false,
        componentes: [
            {
                key: 'EJERCICIO', label: 'EJERCICIO', peso: 30, color: '#16a34a',
                subs: [
                    { nombre: 'EJERCICIO 1', porcentaje: 25, contenido: 'Farmacología general: principios y mecanismos de acción.', fecha: '' },
                    { nombre: 'EJERCICIO 2', porcentaje: 25, contenido: 'Farmacocinética, vía de administración y biodisponibilidad.', fecha: '' },
                    { nombre: 'EJERCICIO 3', porcentaje: 25, contenido: 'Toxicología básica, conceptos y riesgos de exposición.', fecha: '' },
                    { nombre: 'EJERCICIO 4', porcentaje: 25, contenido: 'Integración de farmacología y toxicología con casos clínicos.', fecha: '' }
                ]
            },
            {
                key: 'CATEDRA', label: 'CATEDRA', peso: 45, color: '#8b5cf6',
                subs: [
                    { nombre: 'CATEDRA RECUPERATIVA', porcentaje: 0, contenido: 'Recuperación de contenidos pendientes.', fecha: '' },
                    { nombre: 'CATEDRA 1', porcentaje: 33.33, contenido: 'Conceptos base de farmacología y toxicología.', fecha: '' },
                    { nombre: 'CATEDRA 2', porcentaje: 33.33, contenido: 'Mecanismos farmacológicos y toxicocinética.', fecha: '' },
                    { nombre: 'CATEDRA 3', porcentaje: 33.34, contenido: 'Casos y aplicación clínica de fármacos y tóxicos.', fecha: '' },
                    { nombre: 'CATEDRA DIAGNOSTICO', porcentaje: 0, contenido: 'Diagnóstico inicial del curso.', fecha: '' }
                ]
            },
            {
                key: 'EXAMEN', label: 'EXAMEN', peso: 25, color: '#dc2626',
                subs: [{ nombre: 'EXAMEN', porcentaje: 100, contenido: 'Examen final de farmacología y toxicología.', fecha: '' }]
            }
        ]
    },
    {
        predKey: 'ENFERMEDADES_INFECCIOSAS_9215',
        nombre: 'ENFERMEDADES INFECCIOSAS - NRC 9215',
        umbralEximen: 5.5,
        examenObligatorio: false,
        componentes: [
            {
                key: 'EJERCICIO', label: 'EJERCICIO', peso: 20, color: '#16a34a',
                subs: [
                    { nombre: 'EJERCICIO 1', porcentaje: 25, contenido: 'Diagnóstico clínico y epidemiología general.', fecha: '2026-08-19' },
                    { nombre: 'EJERCICIO 2', porcentaje: 25, contenido: 'Patogenia y manejo de infecciones bacterianas.', fecha: '2026-09-16' },
                    { nombre: 'EJERCICIO 3', porcentaje: 25, contenido: 'Infecciones virales y modelos de transmisión.', fecha: '2026-09-23' },
                    { nombre: 'EJERCICIO 4', porcentaje: 25, contenido: 'Aplicación práctica de protocolos diagnósticos.', fecha: '2026-10-28' }
                ]
            },
            {
                key: 'CATEDRA', label: 'CATEDRA', peso: 45, color: '#8b5cf6',
                subs: [
                    { nombre: 'CATEDRA RECUPERATIVA', porcentaje: 0, contenido: 'Recuperación de contenidos pendientes.', fecha: '2026-12-02' },
                    { nombre: 'CATEDRA 1', porcentaje: 33.33, contenido: 'Generalidades, epidemiología y diagnóstico de infecciones.', fecha: '2026-09-02' },
                    { nombre: 'CATEDRA 2', porcentaje: 33.33, contenido: 'Infecciones bacterianas y manejo terapéutico.', fecha: '2026-10-14' },
                    { nombre: 'CATEDRA 3', porcentaje: 33.34, contenido: 'Infecciones virales, micóticas y su aplicación clínica.', fecha: '2026-11-25' },
                    { nombre: 'CATEDRA DIAGNOSTICO', porcentaje: 0, contenido: 'Diagnóstico inicial del curso.', fecha: '2026-08-12' }
                ]
            },
            {
                key: 'EXAMEN', label: 'EXAMEN', peso: 35, color: '#dc2626',
                subs: [{ nombre: 'EXAMEN', porcentaje: 100, contenido: 'Examen final integrativo de enfermedades infecciosas.', fecha: '2026-12-09' }]
            }
        ]
    },
    {
        predKey: 'PATOLOGIA_SISTEMAS_9295',
        nombre: 'PATOLOGÍA DE SISTEMAS - NRC 9295',
        umbralEximen: 5.5,
        examenObligatorio: false,
        componentes: [
            {
                key: 'EJERCICIO', label: 'EJERCICIO', peso: 30, color: '#16a34a',
                subs: [
                    { nombre: 'EJERCICIO 1', porcentaje: 25, contenido: 'Patología general y principios de lesión celular.', fecha: '' },
                    { nombre: 'EJERCICIO 2', porcentaje: 25, contenido: 'Patología de sistemas: mecanismos y diagnóstico.', fecha: '' },
                    { nombre: 'EJERCICIO 3', porcentaje: 25, contenido: 'Casos clínicos con correlación anatomo-patológica.', fecha: '' },
                    { nombre: 'EJERCICIO 4', porcentaje: 25, contenido: 'Integración de patrones morfológicos y funcionales.', fecha: '' }
                ]
            },
            {
                key: 'CATEDRA', label: 'CATEDRA', peso: 45, color: '#8b5cf6',
                subs: [
                    { nombre: 'CATEDRA RECUPERATIVA', porcentaje: 0, contenido: 'Recuperación de contenidos pendientes.', fecha: '' },
                    { nombre: 'CATEDRA 1', porcentaje: 33.33, contenido: 'Patología general y mecanismos de daño tisular.', fecha: '' },
                    { nombre: 'CATEDRA 2', porcentaje: 33.33, contenido: 'Patología de sistemas: órganos y funciones.', fecha: '' },
                    { nombre: 'CATEDRA 3', porcentaje: 33.34, contenido: 'Integración diagnóstica y correlación clínica.', fecha: '' },
                    { nombre: 'CATEDRA DIAGNOSTICO', porcentaje: 0, contenido: 'Diagnóstico inicial del curso.', fecha: '' }
                ]
            },
            {
                key: 'EXAMEN', label: 'EXAMEN', peso: 25, color: '#dc2626',
                subs: [{ nombre: 'EXAMEN', porcentaje: 100, contenido: 'Examen final de patología de sistemas.', fecha: '' }]
            }
        ]
    },
    {
        predKey: 'OBSTETRICIA_GINECOLOGIA_9361',
        nombre: 'OBSTETRICIA Y GINECOLOGÍA - NRC 9361',
        umbralEximen: 5.5,
        examenObligatorio: false,
        componentes: [
            {
                key: 'EJERCICIO', label: 'EJERCICIO', peso: 30, color: '#16a34a',
                subs: [
                    { nombre: 'EJERCICIO 1', porcentaje: 25, contenido: 'Conceptos básicos de obstetricia y ginecología.', fecha: '' },
                    { nombre: 'EJERCICIO 2', porcentaje: 25, contenido: 'Patologías ginecológicas y evaluación clínica.', fecha: '' },
                    { nombre: 'EJERCICIO 3', porcentaje: 25, contenido: 'Embarazo, parto y control prenatal.', fecha: '' },
                    { nombre: 'EJERCICIO 4', porcentaje: 25, contenido: 'Integración clínica y manejo obstétrico.', fecha: '' }
                ]
            },
            {
                key: 'CATEDRA', label: 'CATEDRA', peso: 45, color: '#8b5cf6',
                subs: [
                    { nombre: 'CATEDRA 1', porcentaje: 33.33, contenido: 'Fundamentos de obstetricia y ginecología.', fecha: '2026-09-01' },
                    { nombre: 'CATEDRA 2', porcentaje: 33.33, contenido: 'PATOLOGÍA GINECOLÓGICA y atención de la mujer.', fecha: '2026-10-06' },
                    { nombre: 'CATEDRA 3', porcentaje: 33.34, contenido: 'Embarazo, parto y control prenatal avanzado.', fecha: '2026-11-17' }
                ]
            },
            {
                key: 'EXAMEN', label: 'EXAMEN', peso: 25, color: '#dc2626',
                subs: [{ nombre: 'EXAMEN', porcentaje: 100, contenido: 'Examen final integrativo de obstetricia y ginecología.', fecha: '2026-12-08' }]
            }
        ]
    }
];

/**
 * Sincroniza los ramos predeterminados con la DB.
 *
 * - Elimina plantillas sin `predKey` (registros legacy sin identificador).
 * - Si no existe ninguno con ese `predKey` → lo inserta.
 * - Si ya existe → actualiza nombre, componentes y flags de exención.
 * - Las notas existentes del alumno quedan intactas.
 */
async function seedPlantillasPredeterminadas() {
    const existentes = await obtenerPlantillas();
    let insertados = 0, actualizados = 0, eliminados = 0;

    // Nombres de las plantillas antiguas (NRC) que deben eliminarse al migrar
    const NOMBRES_LEGACY = new Set([
        'INMUNOLOGÍA - NRC 9819',
        'REPRODUCCIÓN E INSEMINACIÓN AR - NRC 9837',
        'TECNOLOGÍA DE LOS ALIMENTOS - NRC 9934',
        'FISIOPATOLOGÍA - NRC 9952',
        'INGLÉS II - NRC 7911'
    ]);

    // Limpiar SOLO las plantillas legacy conocidas (sin predKey + nombre legacy)
    for (const vieja of existentes.filter(e => !e.predKey && NOMBRES_LEGACY.has(e.nombre))) {
        await eliminarPlantilla(vieja.id);
        eliminados++;
    }
    if (eliminados > 0) console.log(`🗑️ Plantillas legacy eliminadas: ${eliminados}`);

    // Re-leer la DB tras la limpieza
    const actuales = await obtenerPlantillas();

    for (const p of PLANTILLAS_PREDETERMINADAS) {
        const enDB = actuales.find(e => e.predKey === p.predKey);
        if (enDB) {
            const componentesActualizados = p.componentes.map(comp => {
                const compAnterior = enDB.componentes?.find(c => c.key === comp.key);
                return {
                    ...comp,
                    subs: comp.subs.map(sub => {
                        const subAnterior = compAnterior?.subs?.find(s => s.nombre === sub.nombre);
                        return {
                            ...sub,
                            fecha: sub.fecha || subAnterior?.fecha || ''
                        };
                    })
                };
            });

            // Actualizar en caso de cambio (nombre, flags, componentes)
            const necesitaUpdate =
                enDB.nombre            !== p.nombre            ||
                enDB.examenObligatorio !== p.examenObligatorio  ||
                enDB.umbralEximen      !== p.umbralEximen       ||
                JSON.stringify(enDB.componentes) !== JSON.stringify(componentesActualizados);
            if (necesitaUpdate) {
                await actualizarPlantilla({
                    ...enDB,
                    nombre:            p.nombre,
                    componentes:       componentesActualizados,
                    umbralEximen:      p.umbralEximen,
                    examenObligatorio: p.examenObligatorio,
                    predKey:           p.predKey
                });
                actualizados++;
            }
        } else {
            // Insertar nueva predeterminada
            await promisifyRequest(
                getStore('plantillas', 'readwrite').add({
                    nombre:            p.nombre,
                    componentes:       p.componentes,
                    umbralEximen:      p.umbralEximen,
                    examenObligatorio: p.examenObligatorio,
                    predKey:           p.predKey,
                    fechaCreacion:     new Date().toISOString()
                })
            );
            insertados++;
        }
    }

    if (insertados > 0 || actualizados > 0) {
        console.log(`✅ Ramos predeterminados — insertados: ${insertados}, actualizados: ${actualizados}`);
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
