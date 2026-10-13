# Revisión de la prueba en calle — 12 de octubre de 2026

## Hallazgos y correcciones

- **Versión publicada:** la consulta al archivo público de Vercel devolvió 67 puntos de Ruta México. El proyecto local y el commit `54bf11c` contienen 81, con el corredor Tepic–Xalisco continuo en ambos sentidos. La corrección anterior llegó a GitHub, pero no al sitio público. Debe verificarse el archivo servido después del próximo despliegue; un push exitoso no confirma publicación.
- **Victoria/Madero → Las Banderas:** la prueba utiliza los cruces reales de la red peatonal (Victoria `21.515208,-104.8903836`; Madero `21.5205434,-104.8883219`) y Banderas `21.472365,-104.889448`. Con el archivo corregido México aparece como opción directa entre los resultados finales, y también en el sentido contrario.
- **Paradas de regreso:** el filtro descartaba las paradas ajustadas al trazo cuando el viaje circular atravesaba el último y primer punto del archivo. Ahora reconoce ese intervalo y conserva la asignación geométrica al sentido correcto. Los registros de México mantienen su metadata original: todos dicen `ida`, por lo que ese texto no se utiliza como prueba de sentido.
- **Progreso congelado:** el primer avance confirmado estaba limitado a 150 m desde el comienzo del paso. Al confirmar un abordaje tarde, el seguimiento podía quedar permanentemente en cero. Ahora dos lecturas consistentes permiten iniciar a mitad del paso, con límites de velocidad para avances posteriores, control de ambigüedad y rechazo de saltos GPS. Admite precisión de hasta 40 m cuando la proyección es inequívoca.
- **Distancias y trasbordos:** se conserva el último avance confirmado durante lecturas imprecisas. El panel expandido muestra referencias de la ruta del paso actual y su punto de bajada. No confunde la distancia a un trasbordo con la distancia al destino final. La confirmación de abordaje/descenso sigue siendo manual.
- **Bajada anticipada:** avisos en pantalla a 500 m y 150 m de la bajada del paso de camión, únicamente con progreso fiable. Incluyen aviso por voz opcional y vibración donde el dispositivo la admite. No dependen de una parada oficial ni de un anuncio comercial.
- **Camino diferente:** tres o más lecturas fiables, alejadas más de 100 m durante 15 s, generan un aviso. Un avance sostenido en sentido contrario también se señala. Se ofrece recalcular desde la posición actual. La cercanía al destino se etiqueta como distancia en línea recta y se deja de mostrar un tiempo de llegada fiable del itinerario abandonado.
- **Unidad detenida:** se pregunta el motivo después de un minuto de lecturas recientes y estables durante el paso de camión. La pérdida de señal GPS produce un mensaje de señal, nunca una afirmación de tráfico o accidente.
- **Reportes locales:** el usuario puede elegir el motivo e iniciar expresamente un registro. Se guarda en este teléfono bajo una clave distinta de los anuncios, finaliza al volver al recorrido o por acción manual y se exporta en GeoJSON marcado `verified:false`. Una pérdida de señal separa los segmentos; no dibuja conexiones largas inventadas. Se conservan hasta 20 reportes de hasta 1,200 lecturas cada uno. Los reportes no se suben a un servidor ni modifican automáticamente las rutas.
- **Patrocinio:** seis segundos de lectura en la pauta de prueba; las pautas antiguas reciben entre cinco y seis segundos. El contador se pausa al ocultar la página. Se conserva el botón de continuar. El JSON de tacos estaba programado 08:30–22:00 y omitía el martes, aunque su texto decía lunes–viernes 09:00–14:00. Ahora ambos coinciden en 09:00–14:00, de lunes a viernes. No se modificaron las otras pautas.
- **Cámara:** el cálculo del espacio libre ahora incluye la tarjeta superior actual, además del panel inferior. Los avisos y la expansión de detalles actualizan ese espacio.

## Verificación

Pruebas de ruteo y caminata con datos reales de México en ambos sentidos, paradas del intervalo circular, abordaje tardío a 700 m, recuperación de señal, GPS impreciso, saltos imposibles, sentido contrario, desvíos, vehículo detenido, aviso de bajada, exportación de reportes y horario/duración de anuncios. Se corrigió una expectativa desactualizada en la prueba de desvíos que no contemplaba el desvío ya existente de Sauces 1; la geometría de ese desvío no se cambió.

En una vista móvil de 390×844 se simuló avance GPS: el panel pasó de 4.4 a 4.2 km; aparecieron las referencias de retorno; el aviso de bajada se mostró a 451 m. La posición quedó dentro del espacio entre tarjetas. En un desvío simulado, la distancia directa se actualizó de 4.1 a 3.9 km y el tiempo se presentó como no disponible. Se guardó y exportó un GeoJSON con 23 lecturas y `verified:false`.

También se comprobó el panel expandido en 430×932 y 320×568: la ubicación y los controles de recentrado quedaron en el área libre. En la pantalla pequeña, los controles adoptan una fila horizontal. El aviso de unidad detenida apareció tras un minuto de lecturas inmóviles en la simulación. Los archivos y reportes producidos en esta comprobación contienen posiciones simuladas.

La simulación comprueba comportamiento del código y la interfaz; todavía se requiere prueba física de GPS, voz y vibración en Safari/iPhone. Los avisos se ofrecen mientras la web está activa; no se afirma funcionamiento con pantalla bloqueada o seguimiento en segundo plano.

## Límites pendientes

- El GPS puede detectar que el camino no coincide, pero no puede identificar el nombre del camión si dos líneas comparten una avenida. El usuario debe seleccionar o recalcular el recorrido correcto.
- El consenso de reportes de varios usuarios requiere un servicio de recepción, revisión administrativa y reglas de aprobación; esta entrega prepara reportes locales exportables.
- Dos segmentos del extremo norte de Ruta México (aproximadamente 1.45 y 1.55 km) siguen sin suficientes puntos intermedios. Se conserva la protección que impide usarlos para indicar viajes no verificados. No afectan los casos Victoria/Madero–Banderas probados aquí.
- El despliegue público debe confirmarse mediante el contenido servido, no sólo por el estado de Git.

Respaldo del estado previo: `/private/tmp/pordondepasa-field-fixes.Y4PCWM/source-before.tar.gz`.
