# 📊 NotasApp

Aplicación web para registrar y gestionar notas de cursos universitarios con **plantillas dinámicas**.  
Calcula promedios, exención de examen y nota mínima necesaria — todo guardado localmente en el navegador, sin servidor.

![Light Mode](https://img.shields.io/badge/UI-Light_Mode-f97316?style=flat-square)
![Offline](https://img.shields.io/badge/Works-Offline-16a34a?style=flat-square)
![No Backend](https://img.shields.io/badge/Backend-None-111827?style=flat-square)
![IndexedDB](https://img.shields.io/badge/Storage-IndexedDB-8b5cf6?style=flat-square)

---

## ¿Qué hace?

- **Gestiona alumnos** — cada persona tiene su espacio de notas separado, con opción de eliminar.
- **Plantillas de ramos dinámicas** — define cualquier estructura de evaluación con componentes y sub-evaluaciones personalizados.
- **Calcula automáticamente** (con 2 decimales):
  - Promedio ponderado de cada componente (con su peso %)
  - Promedio parcial combinado (sin examen)
  - Nota final ponderada según los pesos de la plantilla
  - Exención del examen (**umbral fijo ≥ 5.5**), solo cuando todos los componentes parciales tienen al menos una nota
  - Nota mínima necesaria en el examen para aprobar el ramo (≥ 4.0)
  - Estado: **APROBADO / REPROBADO**
- **Simulador de exención por nota** — en cada evaluación vacía muestra la nota mínima que necesitas ahí para que, asumiendo 5.5 en el resto, alcances la exención. Se actualiza en tiempo real al tipear.
- **N/P (No Presentado)** — marca una evaluación como N/P; su porcentaje se reasigna automáticamente a la evaluación recuperativa.
- **Exporta datos a JSON** para respaldo.
- **Funciona 100% offline** — no necesita servidor ni internet.

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

> No hay `npm install`, no hay base de datos externa, no hay dependencias locales.

---

## Cómo usarlo

1. **Crea un ramo** → abre "Gestionar Ramos" y define componentes (Ejercicio, Cátedra, Examen…) con su peso % y sub-evaluaciones.
2. **Crea un alumno** → clic en ＋ junto al selector de alumno.
3. **Selecciona alumno + ramo** → el panel de notas aparece con la estructura del ramo.
4. **Ingresa notas** (1.0–7.0) por cada sub-evaluación — los promedios se actualizan en tiempo real.
5. **Marca N/P** si una evaluación no fue rendida — el porcentaje pasa a la recuperativa.
6. **Revisa el dashboard** → promedios, exención y nota final al instante.
7. **Exporta datos** → botón en el header descarga un JSON de respaldo.

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
| Solo con nota > 7.0 | 🔴 `≥ 7.0` (límite visible) |

**Semántica de la fórmula:** "si el resto de notas vacías sacan justo 5.5 ¿qué necesito yo aquí para lograr la exención?"

---

## Lógica de exención

La exención solo se activa cuando:

1. El ramo **no** tiene `examenObligatorio = true`
2. **Todos** los componentes parciales (no EXAMEN) con evaluaciones ponderadas tienen al menos una nota registrada
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
  id, nombre,
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
