# 📊 NotasApp

Aplicación web para registrar y gestionar notas de cursos universitarios con **plantillas dinámicas**.  
Calcula promedios, determina exención de examen y muestra gráficos — todo guardado localmente en el navegador.

![Light Mode](https://img.shields.io/badge/UI-Light_Mode-f97316?style=flat-square)
![Offline](https://img.shields.io/badge/Works-Offline-16a34a?style=flat-square)
![No Backend](https://img.shields.io/badge/Backend-None-111827?style=flat-square)
![PDF Import](https://img.shields.io/badge/Import-PDF_UDLA-ea580c?style=flat-square)

---

## ¿Qué hace?

- **Gestiona alumnos** — cada persona tiene su espacio de notas separado, con opción de eliminar.
- **Plantillas de ramos dinámicas** — define cualquier estructura de evaluación con componentes y sub-evaluaciones personalizados (no hardcodeado).
- **Importa desde PDF** — sube el programa de asignatura UDLA y los componentes se extraen automáticamente.
- **Calcula automáticamente**:
  - Promedio ponderado de cada componente (con su peso %)
  - Promedio parcial combinado (sin examen)
  - Nota final ponderada según los pesos de la plantilla
  - Si el alumno puede eximirse del examen (umbral configurable por ramo)
  - Estado: **APROBADO / REPROBADO**
- **Gráfico de barras** con la distribución de notas por componente.
- **Exporta datos a JSON** para respaldo.
- **Funciona 100% offline** — no necesita servidor ni internet.

---

## Cómo correrlo

### Opción rápida

1. Abre `index.html` en tu navegador (doble clic).

### Opción con servidor local (recomendada)

```bash
# Python:
cd NotasApp
python -m http.server 8080
# → http://localhost:8080

# Node.js:
npx serve .
```

> No hay dependencias, no hay `npm install`, no hay base de datos externa.

---

## Cómo usarlo

1. **Crea un ramo** → abre "Gestionar Ramos" y define componentes (Examen, Cátedra, Ejercicio…) con su peso % y sub-evaluaciones.
2. **(Opcional) Importa desde PDF** → sube el programa PDF de la asignatura UDLA y la estructura se importa automáticamente para revisión.
3. **Crea un alumno** → clic en ＋ junto al selector de alumno.
4. **Selecciona alumno + ramo** → el panel de notas aparece con la estructura del ramo.
5. **Ingresa notas** → escribe la nota (1.0–7.0) por cada sub-evaluación.
6. **Revisa el dashboard** → promedios, exención y nota final se calculan al instante.
7. **Exporta datos** → botón en el header descarga un JSON de respaldo.

---

## Importación desde PDF (UDLA)

El botón **📄 Importar desde PDF** en el modal de gestión de ramos permite subir el archivo PDF del programa de asignatura UDLA.

### ¿Qué extrae?

| Campo | Fuente en el PDF |
|---|---|
| Sigla + Nombre del ramo | Encabezado del programa |
| Componentes (Examen, Cátedra…) | Tabla 7.1 PONDERACIONES |
| Peso % de cada componente | Columna "% Componente" |
| Sub-evaluaciones (Cátedra 1, Ej. 2…) | Columna "Subcomponente" |
| Porcentaje de cada sub-evaluación | Columna "% Subcomponente" |
| Umbral de exención | Sección "EXIMICIÓN DE EXAMEN" |
| Examen obligatorio | Si no existe sección EXIMICIÓN |

### Lógica del parser

El PDF usa **celdas combinadas (rowspan)**: el texto del componente aparece en el centro vertical de la celda, mientras sus subcomponentes están arriba y abajo. El parser resuelve esto con **clasificación de 4 columnas** por coordenada X + **emparejamiento por proximidad Y**:

```
┌──────────┬──────────┬────────────────────┬────────────┐
│  Col A   │  Col B   │      Col C         │   Col D    │
│ Nombre   │ %Comp.   │  Sub-evaluación    │ %Sub       │
│ EXAMEN   │   35     │  Examen            │  100       │
│ CATEDRA  │   45     │  Catedra 1         │  33.33     │
│          │          │  Catedra Recup.    │  33.33     │
│ EJERCICIO│   20     │  Ejercicio 1       │   25       │
└──────────┴──────────┴────────────────────┴────────────┘
```

Después de importar, el editor permite **revisar y modificar** todo antes de guardar.

### Colisión de ramos

Si el PDF corresponde a un ramo que ya existe, el sistema pregunta si deseas **actualizar el existente** o **crear uno nuevo**.

---

## Estructura del proyecto

```
NotasApp/
├── index.html              ← Página principal (HTML + modales)
├── css/
│   └── styles.css          ← Tema claro: blanco + naranja, texto negro
├── js/
│   ├── app.js              ← Inicialización y carga inicial
│   ├── db.js               ← IndexedDB v3 (usuarios, plantillas, notas)
│   ├── calculos.js         ← Lógica de promedios, ponderación, exención
│   ├── calculos_new.js     ← Versión actualizada de cálculos
│   └── ui.js               ← Interfaz, eventos, editor de plantillas, parser PDF
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
  umbralEximen,        // ej: 5.5 — nota mínima para eximirse
  examenObligatorio,   // bool — true si no hay condición de exención
  componentes: [
    {
      key, label, peso,   // ej: "CATEDRA", "Cátedra", 45
      color,              // color visual del componente
      subs: [
        { nombre, porcentaje }  // ej: "Cátedra 1", 33.33
      ]
    }
  ]
}
```

### `notas`
```js
{ id, usuarioId, plantillaId, componenteKey, subIdx, nota }
```

---

## Tecnologías

| Componente | Tecnología |
|---|---|
| Frontend | HTML5, CSS3, JavaScript ES6+ |
| Persistencia | IndexedDB v3 (nativa del navegador) |
| Gráficos | Chart.js 4.4 (CDN) |
| Parser PDF | pdf.js 3.11.174 (CDN, 100% en navegador) |
| Tipografía | Inter (Google Fonts) |
| Tema | Light Mode — Blanco + Naranja + Negro |

---

## Paleta de colores

| Rol | Color | Hex |
|---|---|---|
| Acento principal | Naranja | `#f97316` |
| Acento hover | Naranja oscuro | `#ea580c` |
| Texto principal | Negro | `#111827` |
| Fondo | Blanco/gris claro | `#f8fafc` |
| Éxito | Verde | `#16a34a` |
| Error/Peligro | Rojo | `#dc2626` |
| Advertencia | Ámbar | `#d97706` |

---

## Navegadores compatibles

Chrome 90+, Firefox 88+, Edge 90+, Safari 14+

---

## Licencia

Uso interno / privado — SoftKMC.


---

## ¿Qué hace?

- **Gestiona usuarios** — cada persona tiene su espacio de datos separado.
- **Registra ramos/asignaturas** — agrega tantos cursos como necesites.
- **Ingresa notas** por componente: Ejercicios (3), Cátedras (3), Examen Final.
- **Calcula automáticamente**:
  - Promedio de ejercicios y cátedras
  - Promedio parcial combinado
  - Si te eximes del examen (según un umbral configurable)
  - Nota final ponderada (20% ejercicios, 50% cátedras, 30% examen)
  - Estado: APROBADO / REPROBADO
- **Gráfico de barras** con la distribución de notas por componente.
- **Exporta datos a JSON** para respaldo.
- **Funciona 100% offline** — no necesita servidor ni internet.

---

## Cómo correrlo

### Opción rápida

1. Abre `index.html` en tu navegador (doble clic).

### Opción con servidor local (recomendada)

```bash
# Si tienes Python instalado:
cd NotasApp
python -m http.server 8080

# Luego abre: http://localhost:8080
```

```bash
# O si tienes Node.js:
npx serve .
```

> No necesitas instalar nada más. No hay dependencias, no hay `npm install`, no hay base de datos externa.

---

## Cómo usarlo

1. **Crea un usuario** → clic en el botón ＋ junto al selector de usuario.
2. **Crea un ramo** → clic en ＋ junto al selector de ramo.
3. **Ingresa notas** → escribe la nota (1.0 a 7.0) y el porcentaje de cada evaluación.
4. **Revisa el dashboard** → promedios, exención y nota final se calculan al instante.
5. **Exporta datos** → botón "Exportar" en el header descarga un JSON de respaldo.

---

## Estructura del proyecto

```
NotasApp/
├── index.html          ← Página principal
├── css/
│   └── styles.css      ← Estilos (dark mode, glassmorphism)
├── js/
│   ├── app.js          ← Inicialización
│   ├── db.js           ← IndexedDB (persistencia local)
│   ├── calculos.js     ← Lógica de notas y promedios
│   └── ui.js           ← Interfaz, eventos, gráficos
└── README.md           ← Este archivo
```

---

## Tecnologías

| Componente | Tecnología |
|---|---|
| Frontend | HTML5, CSS3, JavaScript ES6+ |
| Persistencia | IndexedDB (nativa del navegador) |
| Gráficos | Chart.js 4.4 |
| Tipografía | Inter (Google Fonts) |
| Diseño | Dark Mode + Glassmorphism |

---

## Navegadores compatibles

Chrome 90+, Firefox 88+, Edge 90+, Safari 14+

---

## Licencia

MIT
