# Corrección de Pedregal y México — 29 de octubre de 2026

Estado: aplicada al JSON local; sin push, despliegue ni escritura en Supabase.

## Resultado medido con el motor de la app

| Ruta | Vértices antes → después | Mayor arista antes → después | Separación inicio/fin después |
| --- | --- | --- | --- |
| Pedregal | 249 → 246 | 590.30 → 410.53 m | 0 m |
| México | 81 → 124 | 1,550.19 → 888.26 m | 1.18 m |

Los valores difieren ligeramente de los del diagnóstico porque se usa la misma aproximación equirectangular `meters()` del motor. El umbral sigue siendo 1,000 m y el criterio de cierre sigue siendo 5 m. Ninguna de las dos rutas corregidas supera ese umbral. Esto verifica consistencia con los datos aportados; no equivale a una nueva verificación en campo de la operación de cada unidad.

Pedregal se reordena como A → D → C → B, sin invertir ningún bloque. La prueba compara el multiconjunto de aristas dirigidas legítimas antes y después: conserva exactamente todas, eliminando únicamente las tres conexiones artificiales entre bloques. Las uniones son coordenadas idénticas, sin interpolación ni tolerancia adicional.

México conserva los 81 vértices originales y su orden. Añade los 21 puntos de `tepic-bellavista-ida[94..114]` después del índice original 54 y los 22 de `bellavista-tepic-vuelta[174..195]` después del 60. No se densifica una recta inventando puntos. Se reutiliza la geometría digitalizada del corredor, con su sentido de recorrido. El segmento original 72→73 de 888.26 m sigue igual; no se declara una captura nueva de ese tramo.

## Procedimiento reproducible y reversible

Requiere Node 24, como el proyecto. Desde la raíz del repositorio:

```sh
node scripts/patch-route-geometry.mjs --check > /tmp/pordondepasa-plan-geometria.json
node scripts/patch-route-geometry.mjs --apply --audit docs/geometry/20261029-pedregal-mexico.audit.json > /tmp/pordondepasa-resultado-geometria.json
node scripts/build-dataset-manifest.mjs
node --test src/lib/*.test.ts
npm run check
npm run build:passenger
```

`--check` no escribe datos. `--apply` exige un archivo de auditoría nuevo antes de modificar el JSON. Si ya está aplicado, devuelve `already-applied`, no inserta otra vez los puntos y no escribe el archivo de rutas. No sobrescribe una auditoría existente. El plan guardado contiene las coordenadas originales de ambas rutas, los hashes de entrada/salida, los límites de los bloques y las fuentes de Bellavista.

El script rechaza coordenadas distintas tanto de la base exacta como del resultado reconocido, IDs duplicados, cambios de las fuentes Bellavista, uniones incompatibles y resultados con saltos mayores de 1 km. Solo sustituye `coordinates` en los dos IDs; verifica que los metadatos y todas las otras rutas permanecen intactos. Prepara el archivo completo en un temporal y lo reemplaza mediante rename, comprobando que no haya cambios concurrentes.

Para revertir exclusivamente este parche, leer `originalCoordinates` de cada elemento de `targets` en la auditoría y restaurarlas solamente si el hash actual coincide con su `afterSha256`. Comprobar después `beforeSha256`, regenerar el manifiesto y repetir pruebas/compilación. No restaurar todo el repositorio ni sobrescribir cambios posteriores. La recuperación exacta también se comprueba con `originalCoordinates()` en la prueba automatizada.

## Efectos secundarios evaluados

- **router.ts:** no cambia su algoritmo ni el límite de seguridad. El cierre real de Pedregal permite cruzar la costura fin/inicio. Los nuevos vértices de México incorporan el corredor norte al índice y evitan rechazar viajes por sus dos saltos. Distancias, tiempos y posiciones acumuladas pueden cambiar: es una consecuencia esperada de corregir geometría.
- **detours.ts:** ninguna tabla de reemplazos por índice incluye `pedregal` o `m-xico`; no se altera una referencia de desvío existente. El cargador compartido por planeación y exploración conserva la misma secuencia de desvíos y cortes conocidos.
- **navigation.ts:** recalcula progreso, cercanía y lado respecto al nuevo trazo, sin modificar los filtros. Las búsquedas Victoria→Banderas, Madero→Banderas y Banderas→Victoria conservan respectivamente las mismas 19, 22 y 10 referencias que antes. No se marcan referencias como paradas oficiales. Las fuentes de paradas no fueron editadas.
- **Publicidad y favoritos:** IDs, colores, nombres y orden de rutas se mantienen; no se borran ni activan campañas, favoritos o cuentas.
- **Caché y viajes guardados:** el manifiesto pasa de `tepic-d2037f3e1523ef0f` a `tepic-d8f24a0165bc3e1b`. La protección existente rechaza viajes guardados del conjunto anterior y pide calcular un viaje con los datos actuales. Publicar juntos JSON, manifiesto y código compilado evita mezclar versiones; no subir solo el JSON.
- **Explorador:** las dos rutas pasan a una línea continua por sus vértices registrados. Mantiene el corte conservador de saltos de otras rutas; no se eleva el umbral para esconderlas.

## Supabase

En el código y las migraciones de este repositorio, las geometrías se leen de archivos estáticos; la tabla de favoritos solo conserva `route_id`. No existe aquí una migración de una tabla de geometrías que deba actualizarse para este parche. No se inspeccionó ni modificó el esquema de un servidor remoto, por lo que esto no afirma que no haya tablas manuales fuera del repositorio.

Si se incorpora sincronización de geometrías, aplicar una revisión de datos, no borrar/recrear rutas ni cambiar IDs:

1. Identificar la tabla/columna y representación real antes de escribir SQL. En JSON se usan objetos `{lat,lng}`; GeoJSON/PostGIS emplea `[lng,lat]` con SRID 4326. Un recorrido cerrado sigue siendo una línea de transporte, no un polígono. No fusionar fragmentos separados con una recta.
2. Preparar una revisión nueva con `patchId`, hashes, procedencia y copia anterior recuperable; conservar la revisión activa mientras se valida.
3. En una transacción, bloquear/verificar las dos filas de la revisión esperada y comparar sus hashes de coordenadas. Escribir ambas geometrías corregidas, comprobar conteos, cierre y aristas. Si falla una, revertir ambas. Un control de 1 km en base de datos debe calcular metros, no grados.
4. Activar una sola revisión coherente y entregar su versión a ambos consumidores: planeador y explorador. Mantener permisos de administración existentes; una geometría pública no requiere exponer información privada de cuentas ni claves del servidor.
5. Leer de vuelta la revisión publicada, contrastar hashes y ejecutar las mismas regresiones. La auditoría local contiene los valores para realizar esta comparación. No ejecutar un `UPDATE` genérico contra un esquema supuesto.

## Comprobaciones

32 archivos de pruebas aprobados, incluyendo los existentes `mexicoCorridor.test.ts`, `router.test.ts`, navegación, trasbordos y desvíos. La nueva prueba `routeGeometryPatch.test.ts` cubre conservación de aristas de Pedregal, viajes por el norte de México en ambos sentidos, cruce de la costura del circuito, idempotencia y rechazo de fuentes modificadas. Astro: 133 archivos revisados, cero errores, advertencias o sugerencias. Comparación contra HEAD: solo cambian las geometrías de `pedregal` y `m-xico` entre las 59 rutas.
