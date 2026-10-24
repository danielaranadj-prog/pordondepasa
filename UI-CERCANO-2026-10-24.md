# Nueva imagen «Cercano» — 24 de octubre de 2026

## Implementado

- Inicio con identidad propia, búsqueda principal, acceso al mapa y catálogo de rutas reales con filtro por nombre.
- Casa, trabajo, guardados y cuenta conservan las conexiones existentes; no se muestran funciones privadas si no se proporciona el panel de cuenta.
- Vista inicial estática con calles reales de Tepic y trazos de México/Río Suchiate. Se regenera con `node scripts/build-home-map.mjs` y conserva atribución OpenStreetMap.
- Comparador compacto de alternativas, tarjetas con jerarquía de tiempo/caminata/costo/transbordos e iconos SVG compartidos.
- Seguimiento con instrucciones grandes, datos del viaje completo separados de la distancia al siguiente paso y llegada aproximada solo con avance GPS fiable.
- Vista general del viaje, controles de voz/ubicación/reportes, detalle de referencias y ajustes de orientación. En espacios pequeños los controles secundarios pasan al panel para no tapar los créditos del mapa.
- Paletas clara y oscura del mapa, caminata diferenciada y marcador direccional cuando existe orientación real.

## Alcance protegido

No se modificaron los datos JSON de rutas, lugares o campañas, el cálculo del ruteador, los criterios de selección de anuncios, sus métricas ni los flujos de GPS/abordaje/recálculo. La entrada y configuración de cuentas que ya estaban en trabajo se conservaron, sin activar ni verificar OAuth en esta tarea.

La vista local pública usada para QA es una copia aislada de componentes y datos públicos, sin archivos `.env`, sin sesión y sin conexión a la base de datos. La entrada de cuenta del proyecto original no se reemplazó para obtener esa vista.

## Verificación

- `npm run check`: 92 archivos, 0 errores, 0 advertencias, 0 sugerencias.
- `npm run test:unit`: 20 pruebas correctas; incluye ruteo México, GPS, caminatas, anuncios y contraste de las etiquetas del mapa.
- Verificación adicional del paquete preparado para publicar, aislado del trabajo de cuentas: 84 archivos sin errores, sus 19 pruebas correctas y compilación exitosa. La prueba restante pertenece al trabajo de cuentas no incluido.
- `npm run build`: correcto. Permanece el aviso de tamaño del paquete MapLibre; no se eliminó ni ocultó.
- Revisión visual en navegador: inicio, búsqueda, catálogo/filtro/cierre con teclado, origen confirmado, alternativas reales Centro de Tepic → Las Banderas, selección de tarjetas, seguimiento manual, reporte deshabilitado sin GPS y vista general.
- Pantallas revisadas: 390 × 844 y 320 × 568, además del inicio de escritorio. Sin desbordamiento horizontal del documento en los tamaños móviles revisados.

Pendiente de validar en una unidad real: seguimiento con GPS del teléfono, orientación, alertas de bajada y convivencia del nuevo diseño con anuncios activos. Las pruebas de escritorio no sustituyen esa validación.

El paquete visual se prepara de forma independiente del trabajo pendiente de cuentas. La publicación del código no certifica el despliegue ni la validación de GPS en campo.
