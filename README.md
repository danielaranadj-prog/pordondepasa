# PorDóndePasa

Web app de transporte público de Tepic y Xalisco: Astro, React y Leaflet/OpenStreetMap. Identificadores sin acento: PorDondePasa / pordondepasa.

## Desarrollo y publicación

Desarrollo: npm ci y npm run dev. Compilación en la raíz: npm run build.

Para publicar bajo /pordondepasa/: PUBLIC_BASE_PATH=/pordondepasa/ npm run build.
Los recursos, paradas, trabajador de rutas y manifiesto respetan esa base.
Integrar el CONTENIDO de dist/ en el directorio pordondepasa/ del sitio existente usando su flujo de publicación.

El repositorio por sí solo no publica www.instantetrips.com/pordondepasa/. Falta integrar este artefacto en el alojamiento que sirve Instantetrips. No cambiar dominio personalizado, CNAME ni DNS de la web actual. No se ha activado despliegue automático.

Para volver a la vista previa local en la raíz tras compilar para subdirectorio, ejecutar npm run build y npm run preview.

## Datos y privacidad

- public/data/tepic-routes.json y public/data/stops/: trazos y paradas originales preservados. Ruta 24 excluida del cálculo.
- public/data/tepic-walk-network.json: red derivada de OpenStreetMap, © OpenStreetMap contributors, ODbL 1.0; atribución y fecha incluidas en el archivo. https://www.openstreetmap.org/copyright
- Cálculos en un trabajador local. La búsqueda usa paradas guardadas; no hay geocodificador externo.
- Mosaicos descargados de tile.openstreetmap.org. Su proveedor recibe solicitudes de mapa; la app no es totalmente offline ni libre de terceros.
- Ubicación/brújula requieren permisos y HTTPS en teléfonos. Uber recibe origen/destino al abrirse tras confirmación del usuario.
- No subir .env, claves, datos privados, node_modules ni dist.

## Verificación

npm run check y npm run build.
Con Node compatible: node --experimental-strip-types src/lib/router.test.ts.
También ejecutar navigation.test.ts, heading.test.ts y walking.test.ts de igual forma.

## Limitaciones

Tiempo, espera y tarifa estimados, no datos en tiempo real. Caminatas sobre vías conectadas en la extracción local; accesibilidad, cruces y cambios en campo requieren validación. Cobertura aproximada: latitudes 21.40–21.57 y longitudes −105.01–−104.80. Sin red conectada no se inventa una diagonal. Sin garantía de GPS/brújula o seguimiento en segundo plano.

Autenticación, suscripciones, PWA offline completa y empaquetado Capacitor quedan para fases futuras; el manifiesto no implementa funcionamiento offline.
