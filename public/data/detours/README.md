# Cierre de Colosio: desvíos temporales

El responsable confirmó que el cierre está vigente y estima unos dos años de construcción. No hay fecha de reapertura confirmada; no programar una reversión automática. El año de inicio no ha sido confirmado por el responsable.

`colosio-21-de-febrero.geojson` conserva los 33 vértices suministrados, en orden GeoJSON [longitud, latitud]. El responsable confirmó que Hospitales 1 y 2 circulan por este desvío. El planificador aplica el trazo a ambas rutas, según su sentido. La ruta base en `tepic-routes.json` sigue intacta.

## Auditoría de continuidad

- Hospitales 2 (`cantera-hospitales-2`): reemplazado el tramo de los segmentos 397–418 (índices desde cero), sentido norte a sur. Los extremos del GeoJSON se proyectan sobre los segmentos vecinos; las conexiones quedan dentro de la tolerancia de 30 m.
- Hospitales 1 (`cantera-hospitales-1`): sustituido el tramo de los segmentos 96–128. Recorre el GeoJSON amarillo desde su extremo sur hasta el vértice 4 (21.5111785, -104.8860988). Allí se une al vértice 7 (21.5111883, -104.8860886) del trazo entregado hacia avenida Victoria, separados por ~1.5 m. Sigue por Prisciliano Sánchez, Vicente Guerrero y Zacatecas hasta Victoria, según la confirmación del responsable. Los primeros siete vértices del segundo GeoJSON corresponden al acceso desde Colosio y no forman parte del nuevo recorrido. El antiguo tramo cerrado y el acceso redundante quedan fuera del cálculo.
- San José de Mojarras, Buckingham, Las Cuevas y San Luis de Lozada no aparecen con esos nombres en el catálogo actual; no crear ni asociar rutas por conjetura.
- El GeoJSON verde ya fue recibido e integrado para Progreso 4, Progreso 5 y ambos pasos de Jazmines. Villas requiere identificar su equivalencia; 3 de Julio y La Yesca no figuran con esos nombres en el catálogo.

## Desvío activo local: Metates

`colosio-metates.geojson` conserva todos los vértices proporcionados. `src/lib/detours.ts` aplica una superposición temporal antes de la planificación; no altera `tepic-routes.json`, colores, IDs ni el algoritmo. Los segmentos son explícitos para no confundir ida y regreso. Las uniones se proyectan sobre el tramo original y se toleran como máximo 30 m (observados: aproximadamente 1–22 m); son conectores entre trazados, no certificación de carriles. Necesitan revisión en campo. No se inventan paradas nuevas; las existentes siguen filtrándose contra la geometría resultante y su sentido.

Para revertir en una nueva sesión del planificador, cambiar `properties.active` a `false` en el GeoJSON correspondiente. Si falta el archivo activo o falla la validación, el cálculo falla de forma explícita en lugar de usar silenciosamente el recorrido cerrado. No hay caducidad automática. La geometría base debe reauditarse si se edita: los índices de segmento dependen de ella.

Verificación: `node scripts/test-detours.cjs`, `npm run check` y `npm run build`. No se ha verificado circulación real ni continuidad vial mediante prueba en teléfono. No se hizo push ni deploy.

Queda por verificar en calle el giro en el cruce compartido, los puntos reales de abordaje y la ubicación de las paradas en ambos sentidos. No se cambiaron colores ni el algoritmo de selección.
