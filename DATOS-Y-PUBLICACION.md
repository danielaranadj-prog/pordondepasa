# Datos y publicación de PorDóndePasa

## Estado actual

- GPS guarda rutas, paradas, lugares, campañas y clientes en IndexedDB (Dexie), local al navegador del administrador. No es todavía una base de datos compartida ni un respaldo remoto.
- La app del pasajero usa archivos estáticos en `public/data`. El planificador y su algoritmo siguen intactos.
- GPS ahora permite descargar un borrador completo `pordondepasa-borrador-AAAA-MM-DD.json`. Este archivo no incluye contactos de clientes ni notas internas de campañas. No publica nada.
- `npm run data:review -- /ruta/al/borrador.json` revisa estructura, IDs, coordenadas, sentidos, referencias entre datos y rutas que desaparecerían. Solo informa; no cambia datos publicados.

## Contrato del borrador v1

`{ schemaVersion: 1, dataset: "pordondepasa-draft", status: "draft", exportedAt, routes, stops, places, ads }`.

Las rutas conservan sus trazos `ida` y `vuelta` en coordenadas `[lat, lng]`. Lugares y paradas conservan coordenadas `{lat, lng}`. Este paquete es de revisión, no el formato que consume directamente el planificador; no copiarlo a `public/data`.

## Flujo propuesto para el panel en pordondepasa.com

1. **Borrador:** el editor cambia trazos, paradas y lugares. Cada cambio queda en un almacén privado y con autor/fecha. Antes de migrar GPS, exportar y respaldar su IndexedDB actual.
2. **Validación:** correr el validador y revisar visualmente nuevas geometrías, cortes, sentidos de paradas, destinos y cambios respecto de la versión publicada. Los avisos requieren decisión humana.
3. **Previsualización:** generar una versión de prueba separada de la app pública. Probar búsquedas y navegación con el mismo algoritmo actual.
4. **Aprobación:** solo un rol autorizado puede publicar. Crear un manifiesto inmutable con versión, fecha, hashes y archivos aprobados; conservar la versión anterior.
5. **Consumo:** la app descarga el manifiesto y un conjunto consistente de rutas, paradas, lugares y campañas. Si falla, usa la última versión íntegra en caché. No mezclar archivos de versiones distintas.
6. **Reversión:** cambiar el manifiesto a la última versión buena, sin borrar historial. Los reportes de usuarios no cambian rutas automáticamente.

## Límites y decisiones de seguridad

- No se ha creado todavía backend, autenticación, publicación remota ni sincronización automática. El paso actual es deliberadamente local y reversible.
- Clientes, contactos, notas internas, borradores y reportes deben quedar en almacenamiento privado; nunca en JSON público.
- El panel requiere login, segundo factor, roles, auditoría y respaldos. Un subdominio oculto no es una barrera de seguridad.
- Las campañas deben marcarse como publicidad. Ningún anuncio debe alterar una ruta de tránsito o redirigir un viaje sin elección del usuario.
- La app móvil no debe depender de conexión para sus rutas ya descargadas; los mosaicos de OpenFreeMap siguen requiriendo red salvo una solución offline separada.

## Próxima implementación, antes de hacer deploy

Elegir el backend de administración y crear un importador transaccional de este borrador hacia tablas privadas. Después añadir revisión visual, generación de snapshots compatibles con los formatos actuales de `public/data`, pruebas de rutas y publicación/versionado. No sustituir el planificador ni mover el panel GPS tal cual a una URL pública.
