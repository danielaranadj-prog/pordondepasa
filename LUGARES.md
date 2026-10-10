# Lugares de Tepic y Xalisco

La fuente editable sigue siendo el GeoJSON de la herramienta GPS. Para actualizar la copia publicada:

```sh
node scripts/import-places.mjs /ruta/pordondepasa-lugares.geojson
npm run check
npm run build
```

El importador valida IDs, puntos y una calle cercana; genera `public/data/places.json` sin modificar el archivo fuente. La búsqueda local combina lugares (también por alias) y las paradas existentes. La posición del lugar se conserva como pin y para el enlace a Uber. El planificador recibe por separado una proyección sobre la red peatonal existente; **ese acceso es estimado, no una entrada verificada**. No se traza un conector directo del acceso al pin, pues podría atravesar edificios o cruces inseguros. La app informa que se debe verificar la entrada y usar cruces permitidos.

En esta importación hay 85 lugares; 12 están a más de 40 m de la red peatonal. Antes de dar por buenas sus indicaciones en calle, revisar esos 12 accesos con la herramienta GPS. El modelo actual no conoce entradas peatonales, barreras físicas ni lados de calle. El cambio no modifica rutas, stops ni el algoritmo de selección de camiones, y no requiere API ni clave.
