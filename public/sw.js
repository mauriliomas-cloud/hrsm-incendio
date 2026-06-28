const CACHE_NAME = 'hrsm-incendio-v1'

const ASSETS = [
  '/',
  '/index.html',
  '/src/style.css',
  '/src/main.js',
  '/src/auth.js',
  '/src/db.js',
  '/src/utils.js',
  '/src/relatorio.js',
  '/src/supabase.js'
]

// Instala e faz cache dos arquivos principais
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  )
  self.skipWaiting()
})

// Remove caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Estratégia: tenta rede primeiro, se falhar usa cache
self.addEventListener('fetch', event => {
  // Ignora requisições ao Supabase (deixa o app lidar com erros)
  if (event.request.url.includes('supabase.co')) return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Atualiza cache com resposta mais recente
        const clone = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        return response
      })
      .catch(() => {
        // Sem internet — usa cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached
          // Se não tem cache, retorna página principal
          return caches.match('/')
        })
      })
  )
})
