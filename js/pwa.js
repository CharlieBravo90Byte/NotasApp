// El navegador instala el trabajador solo en HTTPS o localhost.
if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').catch(error => {
            console.warn('No se pudo activar el funcionamiento sin conexión:', error);
        });
    });
}
