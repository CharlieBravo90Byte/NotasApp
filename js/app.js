// ══════════════════════════════════════
//  app.js — Inicialización v3
// ══════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        await cargarSelectUsuarios();
        await cargarSelectPlantillas();
        console.log('✅ NotasApp v3.0 iniciado correctamente');
    } catch (error) {
        console.error('❌ Error al iniciar NotasApp:', error);
        toast('Error al iniciar la aplicación: ' + error.message, 'error');
    }
});
