const CACHE = 'notasapp-shell-v7';
const ARCHIVOS = [
    './', './index.html', './manifest.webmanifest?v=2', './icons/icon-192-v2.png', './icons/icon-512-v2.png',
    './css/styles.css?v=9', './js/db.js?v=8', './js/calculos.js?v=7', './js/ui.js?v=11',
    './js/malla.js?v=8', './js/programas-incluidos.js?v=1', './js/importar-pdf.js?v=8', './js/portal.js?v=5', './js/app.js', './js/pwa.js',
    './vendor/pdfjs/pdf.min.js', './vendor/pdfjs/pdf.worker.min.js',
    './vendor/tesseract/tesseract.min.js', './vendor/tesseract/worker.min.js',
    './vendor/tesseract/tesseract-core-lstm.wasm.js', './vendor/tesseract/tesseract-core-simd-lstm.wasm.js',
    './vendor/tesseract/spa.traineddata.gz'
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ARCHIVOS)));
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys
        .filter(key => key.startsWith('notasapp-shell-') && key !== CACHE)
        .map(key => caches.delete(key)))));
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;
    const scope = new URL(self.registration.scope);
    if (!url.pathname.startsWith(scope.pathname)) return;
    if (request.mode === 'navigate') {
        event.respondWith(fetch(request).catch(() => caches.match(new URL('./index.html', scope).href)));
        return;
    }
    event.respondWith(fetch(request).catch(() => caches.match(request)));
});
