# 📊 NotasApp

Aplicación web para registrar y gestionar notas de cursos universitarios.  
Calcula promedios, determina exención de examen y muestra gráficos — todo guardado localmente en el navegador.

![Dark Mode](https://img.shields.io/badge/UI-Dark_Mode-1e1e2e?style=flat-square)
![Offline](https://img.shields.io/badge/Works-Offline-22c55e?style=flat-square)
![No Backend](https://img.shields.io/badge/Backend-None-6366f1?style=flat-square)

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
