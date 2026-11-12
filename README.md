# 📊 NotasApp

Aplicación web para registrar y gestionar notas de cursos universitarios con **plantillas dinámicas**.  
Calcula promedios, exención de examen y nota mínima necesaria — todo guardado localmente en el navegador, sin servidor.

![Light Mode](https://img.shields.io/badge/UI-Light_Mode-f97316?style=flat-square)
![Offline](https://img.shields.io/badge/Works-Offline-16a34a?style=flat-square)
![No Backend](https://img.shields.io/badge/Backend-None-111827?style=flat-square)
![IndexedDB](https://img.shields.io/badge/Storage-IndexedDB-8b5cf6?style=flat-square)

---

## ¿Qué hace?

- **Ramos por semestre** — la malla incluida se carga automáticamente con sus semestres. Los programas disponibles en el proyecto aportan sus evaluaciones; los ramos sin programa quedan pendientes hasta importar el PDF o configurar su estructura. También se pueden crear y editar ramos.
- **Importa uno o varios programas PDF UDLA** — extrae localmente la tabla 7.1, los requisitos y los resultados de aprendizaje disponibles, y muestra el resultado de cada archivo. Los ramos existentes no se duplican; se completan los requisitos y la regla de examen si estaban pendientes, y se avisa de condiciones detectadas que la app aún no calcula. No se suben los archivos a un servidor.
- **Malla y requisitos** — muestra los ramos de la imagen por semestre y evalúa los requisitos conocidos con las notas finales o las notas históricas del alumno. Si faltan requisitos o notas, muestra que no puede determinar el resultado.
- **Nota portal** — pega la tabla de MiUDLA, revisa las filas detectadas y guárdalas en una columna separada. Las notas de simulación siguen siendo las únicas usadas en los cálculos.
- **Gestiona alumnos** — cada persona tiene su espacio de notas separado, con opción de eliminar.
- **Plantillas de ramos dinámicas** — define cualquier estructura de evaluación con componentes y sub-evaluaciones personalizados.
- **Calcula automáticamente** (con 2 decimales):
  - Promedio ponderado de cada componente (con su peso %)
  - Promedio parcial combinado (sin examen)
  - Nota final ponderada según los pesos de la plantilla
  - Exención del examen (**umbral fijo ≥ 5.5**), solo cuando todas las evaluaciones parciales ponderadas tienen nota (o recuperativa resuelta)
  - Nota mínima necesaria en el examen para aprobar el ramo (≥ 4.0)
  - Estado: **APROBADO / REPROBADO**
- **Simulador de exención por nota** — en cada evaluación vacía muestra la nota mínima que necesitas ahí para que, asumiendo 5.5 en el resto, alcances la exención. Se actualiza en tiempo real al tipear.
- **N/P (No Presentado)** — marca una evaluación como N/P; su porcentaje se reasigna automáticamente a la evaluación recuperativa.
- **Instalable como PWA** — puede agregarse a la pantalla de inicio y abrirse sin conexión después de su primera carga completa.

---

## Cómo correrlo

### Opción rápida

Abre `index.html` directamente en el navegador (doble clic).

### Opción con servidor local (recomendada)

```bash
# Python:
cd NotasApp
python -m http.server 8080
# → http://localhost:8080

# Node.js:
npx serve .
```

> No hay que ejecutar `npm install` ni configurar una base de datos externa; PDF.js se incluye con la aplicación.

Para importar PDF usa el servidor local; la lectura de PDF incluye PDF.js en `vendor/pdfjs`. Se admiten los programas UDLA con texto seleccionable y tablas compatibles; los PDF escaneados requieren revisión manual. Si existen varias tablas, se importa la primera estructura completa sin combinar sus filas; se informa si hay diferencias. Si cambian las evaluaciones obligatorias o los pesos, el resultado queda pendiente de revisión hasta confirmar la estructura en Ramos. La lectura puede omitir aprendizajes divididos entre líneas. Si la regla de examen no se identifica, queda pendiente y puede editarse en Ramos. La app utiliza un umbral fijo de exención de 5,5 y no calcula requisitos de asistencia. La malla incorpora requisitos solo de los programas disponibles, no deduce dependencias por semestre ni sustituye la matrícula oficial. Las notas históricas se guardan por alumno en el navegador.

Para verificar los ejemplos y el procesamiento por lotes: `node tests/importar-pdf.test.cjs` y `node tests/importar-lote.test.cjs`.

El catálogo de la malla está en `js/malla.js` y las estructuras de los PDF incluidos en `js/programas-incluidos.js`. En un dispositivo nuevo se cargan sin notas. Al abrir una base de datos existente se mantienen las evaluaciones y notas guardadas y solo se completa el código o semestre que falte. Los programas que se importen posteriormente desde la interfaz se guardan en ese navegador: para distribuirlos en dispositivos nuevos también hay que incorporarlos al proyecto.

### Instalar en un celular

Publica la carpeta de la aplicación en una dirección HTTPS y ábrela desde el celular. En Android, usa el menú de Chrome y selecciona **Instalar aplicación** o **Agregar a pantalla principal**. En iPhone, abre la página en Safari y selecciona **Compartir → Agregar a pantalla de inicio**. El nombre de la opción puede variar según el navegador.

La instalación necesita una primera visita con conexión. Después de cargar los archivos, la aplicación puede abrirse sin internet; la tipografía externa puede cambiar si no está disponible. El portal MiUDLA requiere conexión. Las notas y ramos se guardan en el dispositivo y navegador donde se ingresan, sin sincronización automática. Borrar los datos del sitio o de la aplicación puede eliminarlos.

`localhost` sirve para probar la instalación en el propio computador: en el celular apunta al teléfono, no al PC. Acceder por una IP local con HTTP permite probar la página en ciertos casos, pero no habilita la instalación PWA ni el funcionamiento sin conexión; para ello se necesita HTTPS (o localhost en el mismo dispositivo). Al actualizar los archivos incluidos en `service-worker.js`, incrementa también la versión de su caché y actualiza los nombres o versiones de los archivos precargados.

### Leer las notas de MiUDLA

Selecciona el alumno y ramo en NotasApp. En MiUDLA abre **Mis cursos → Notas** y copia la tabla del mismo ramo. Pulsa **Pegar notas MiUDLA**, pega el texto y selecciona **Ver vista previa**. Revisa el alumno, ramo, evaluaciones y notas antes de guardar. Las filas mostradas como «Sin nota» borran la nota portal anterior para esa evaluación; las filas no reconocidas no se modifican.

La app procesa el texto localmente sin extensión ni contraseña. Advierte de porcentajes diferentes, pero no cambia las ponderaciones ni las notas de simulación. Es necesario comprobar que la tabla pertenezca al alumno, ramo y período seleccionados. Para probar el lector con el ejemplo de la tabla: `node tests/miudla.test.cjs`.

También puedes elegir una o varias capturas del mismo ramo en **Notas MiUDLA → Capturas de la tabla de notas → Leer capturas**. El reconocimiento se ejecuta en el dispositivo; puedes corregir el texto detectado antes de pedir otra vista previa. Comprueba cada nota y las filas que figuren como «Sin nota», ya que el reconocimiento puede cometer errores y estas últimas borran la nota portal anterior de esa evaluación. Las filas no reconocidas no se modifican. Para mejores resultados, usa capturas nítidas en las que cada evaluación, porcentaje y nota aparezcan completos en una misma línea. El lector y el modelo de idioma se incluyen en la aplicación; la primera carga de la PWA debe terminar con conexión para usarlos sin internet.

---

## Cómo usarlo

1. **Crea un ramo** → abre "Gestionar Ramos" y define componentes (Ejercicio, Cátedra, Examen…) con su peso % y sub-evaluaciones.
2. **Crea un alumno** → clic en ＋ junto al selector de alumno.
3. **Selecciona alumno + ramo** → el panel de notas aparece con la estructura del ramo.
4. **Ingresa notas** (1.0–7.0) por cada sub-evaluación — los promedios se actualizan en tiempo real.
5. **Marca N/P** si una evaluación no fue rendida — el porcentaje pasa a la recuperativa.
6. **Revisa el dashboard** → promedios, exención y nota final al instante.

---

## Colores de componentes

| Componente | Color |
|---|---|
| 🟢 Ejercicio | Verde `#16a34a` |
| 🟣 Cátedra | Morado `#8b5cf6` |
| 🔴 Examen | Rojo `#dc2626` |

Los colores se asignan automáticamente según el tipo (`key`) del componente en la plantilla.

---

## Simulador de nota mínima para exención

Debajo de cada campo de nota vacío aparece un hint con la nota mínima necesaria en **esa evaluación** para alcanzar exención (promedio parcial ≥ 5.5), asumiendo que todos los demás campos vacíos obtendrán exactamente **5.5**.

| Resultado | Visual |
|---|---|
| Nota alcanzable (≤ 7.0) | 🟠 `≥ 5.8` |
| Con cualquier nota alcanza | 🟢 `✓ libre` |
| Solo con nota > 7.0 | 🔴 `Imposible` |

**Semántica de la fórmula:** "si el resto de notas vacías sacan justo 5.5 ¿qué necesito yo aquí para lograr la exención?"

---

## Lógica de exención

La exención solo se activa cuando:

1. El ramo **no** tiene `examenObligatorio = true`
2. **Todas** las evaluaciones parciales ponderadas tienen nota registrada; si hay N/P, se requiere la recuperativa
3. El promedio parcial resultante ≥ **5.5** (umbral fijo, no configurable)

---

## N/P (No Presentado)

Cada sub-evaluación ponderada cuenta con un botón **N/P**. Al marcarlo:

- La nota queda como **0** en la base de datos
- El porcentaje de esa sub-evaluación se transfiere a la **sub-evaluación recuperativa** del mismo componente
- El campo queda bloqueado visualmente con la etiqueta N/P en naranja

---

## Estructura del proyecto

```
NotasApp/
├── index.html              ← Página principal (HTML + modales)
├── css/
│   └── styles.css          ← Tema claro: blanco + naranja
├── js/
│   ├── app.js              ← Inicialización y carga inicial
│   ├── db.js               ← IndexedDB v3 (usuarios, plantillas, notas)
│   ├── calculos.js         ← Lógica de promedios, ponderación, exención, simulador
│   └── ui.js               ← Interfaz, eventos, editor de plantillas
└── README.md
```

---

## Arquitectura de datos (IndexedDB v3)

### `usuarios`
```js
{ id, nombre }
```

### `plantillas`
```js
{
  id, nombre, semestre, // semestre opcional
  umbralEximen,        // siempre 5.5
  examenObligatorio,   // bool
  componentes: [
    {
      key,    // "EJERCICIO" | "CATEDRA" | "EXAMEN" | ...
      label,  // nombre visible
      peso,   // % peso en nota final
      color,  // color visual (sobreescrito por KEY_COLORS en UI)
      subs: [
        { nombre, porcentaje }  // ej: "Cátedra 1", 33.33
      ]
    }
  ]
}
```

### `notas`
```js
{ id, usuarioId, plantillaId, compKey, subNombre, nota }
// nota = null → sin nota | nota = 0 → N/P
```

---

## Tecnologías

| Componente | Tecnología |
|---|---|
| Frontend | HTML5, CSS3, JavaScript ES6+ |
| Persistencia | IndexedDB v3 (nativa del navegador) |
| Tipografía | Inter (Google Fonts) |
| Tema | Light Mode — Blanco + Naranja + Negro |

---

## Paleta de colores

| Rol | Hex |
|---|---|
| Acento principal | `#f97316` |
| Acento hover | `#ea580c` |
| Texto principal | `#111827` |
| Fondo | `#f8fafc` |
| Éxito | `#16a34a` |
| Error/Peligro | `#dc2626` |
| Advertencia | `#d97706` |
| Ejercicio | `#16a34a` |
| Cátedra | `#8b5cf6` |
| Examen | `#dc2626` |

---

## Navegadores compatibles

Chrome 90+, Firefox 88+, Edge 90+, Safari 14+

---

## Licencia

Uso interno / privado — SoftKMC.

La nota final y el estado quedan pendientes hasta completar los parciales y, cuando corresponda, el examen. El mínimo de examen se muestra al completar los parciales. El simulador supone 5.5 en las demás evaluaciones pendientes y se oculta si hay N/P.
