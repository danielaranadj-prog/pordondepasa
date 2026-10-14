# Nombres para trabajar por pantalla

Usa estos nombres al pedir un cambio. Puedes añadir «solo en esta pantalla; conserva los demás pasos».

| Pantalla | Cómo reconocerla |
| --- | --- |
| Inicio | Logo, buscador de destino y «Ubícalo en el mapa». |
| Rutas disponibles | Mapa y tarjetas de alternativas antes de elegir un viaje. |
| Editar origen / Editar destino | Selección del punto en el mapa o buscador de lugares. |
| Patrocinio de viaje | Presentación del anunciante antes de abrir la navegación. |
| Caminata al abordaje | Paso a pie para llegar al transporte; botón «Ya abordé». |
| Espera de ruta | Estado «EN ESPERA», tras confirmar «Esperar aquí». |
| Viaje en camión | Avance GPS, próximas paradas/referencias y botón «Ya bajé». |
| Caminata de transbordo | Caminata entre dos transportes. |
| Caminata final | Caminata desde la bajada hasta el destino. |
| Viaje finalizado | Confirmación de llegada y botón «Finalizar». |

Dentro de la navegación: **indicación superior**, **mapa**, **controles del mapa**, **resumen inferior** (ruta, acción y distancia), **panel de paradas** (lista desplegable), **aviso de bajada**, **panel de espera** y **aviso de abordaje asistido**.

Ejemplo: «En Viaje en camión, cambia solo el panel de paradas; conserva el aviso de bajada y el trazo».

En GPS: **Zonas**, **Rutas**, **Paradas / Gestor de Paradas**, **Lugares**, **Publicidad** (Patrocinio de viaje, Anuncio invisible, Pin dorado) y **Exportación**.

# Paradas de PorDóndePasa → GPS → archivo local

1. Abre **GPS → Paradas → Archivos de PorDóndePasa**.
2. Conecta los tres archivos originales de `PorDondePasa/public/data/stops`: `general-stops.json`, `insurgentes-stops.json` y `mexico-stops.json`.
3. Las paradas aparecen en el mapa y el gestor, con la etiqueta del archivo de origen. Selecciona un pin para cambiar su ubicación; edita el nombre y el tipo en el gestor. Los IDs originales, sentidos, vínculos con rutas y coordenadas completas se conservan al guardar.
4. Para agregar una parada, créala en el mapa, selecciónala y usa **Añadir parada seleccionada a este archivo** en el archivo correcto. No se agregan automáticamente otras paradas locales.
5. **Guardar con respaldo** muestra las nuevas, editadas y eliminadas, descarga una copia de seguridad y sobrescribe únicamente el archivo elegido. Si cambió fuera de GPS, se bloquea la escritura para que lo vuelvas a conectar y revises tus ediciones.
6. Sin acceso directo a archivos, usa **Descargar JSON** y reemplaza manualmente solo ese archivo en la carpeta indicada. No uses el importador de respaldo completo para este flujo: ese importador reemplaza todas las paradas del gestor.
7. Al volver a abrir GPS, reconecta los archivos: se conservan las copias ya editadas. **Recargar y descartar ediciones** es una operación separada, confirmada, que vuelve al contenido del archivo.
8. Recarga la app local para probarlos. Guardar JSON no publica en internet: después de validar los cambios, todavía hay que publicar el proyecto.

Se conservan los archivos separados porque la app usa su procedencia al asociar algunas paradas con el recorrido. No se cambia la geometría de las rutas ni los lugares, clientes o anuncios.

# Comportamiento de navegación

- La próxima parada/referencia se destaca en el panel y tiene etiqueta en el mapa solo durante el viaje en camión con avance GPS confiable. Tras pasarla, avanza la lista; **Ver anteriores** permite consultar el historial y **Seguir próxima** recupera el seguimiento.
- Una ubicación reciente, precisa y estable junto al mismo recorrido permite confirmar **Esperar aquí**, hasta 400 m antes/después del abordaje planeado. Se conserva la ruta, el sentido nativo y la bajada; no se crea un tramo nuevo ni se devuelve al usuario al punto anterior.
- Estar sobre el recorrido NO acredita que el abordaje sea legal o seguro. Se pide revisar el sentido, los carteles y las paradas permitidas; las referencias habituales no son paradas oficiales. No se ha inventado un límite exacto para el corredor del centro histórico.
- El abordaje asistido se evalúa únicamente después de confirmar la espera. Exige movimiento sostenido compatible con el recorrido, ofrece 10 segundos para cancelarlo y permite deshacerlo. El GPS no identifica el vehículo: un coche o corredor rápido pueden coincidir con la ruta. El botón manual sigue disponible.
- Tras cinco minutos desde la espera confirmada, con una ubicación reciente aún cerca del punto, se pide un motivo. El tiempo transcurrido se distingue del tiempo realmente observado con GPS; los periodos sin señal no se suman a este último. Las respuestas se guardan solo en ese dispositivo y se pueden exportar: no se envían aún al panel ni representan una frecuencia real en tiempo real.
- La caminata utiliza mayor zoom y calles más legibles, sin cambiar el proveedor del mapa. Donde faltan nombres en los datos cartográficos no se inventan etiquetas.

## Qué probar en la calle

México en ambos sentidos y Río Suchiate: confirmar espera una cuadra antes/después del punto elegido; abordar manualmente y con asistencia; cancelar/deshacer una inferencia; comprobar que la próxima referencia avance sin borrar datos; comprobar caminata con nombres de calles y aviso de bajada. Mantén la vista en el entorno, no en la pantalla.
