# Auditoría de PorDóndePasa — 9 de octubre de 2026

Alcance: revisión estática de Astro/React, motor de rutas, red peatonal, datos, interfaz móvil y pruebas locales. No equivale a una validación en calle ni a un ensayo con menores o adultos mayores. No se hizo push ni deploy.

## Cambio aplicado ahora

Antes de calcular, el worker comprueba que origen y destino estén a 40 m o menos de una arista de la red peatonal. Si no, indica cuál punto corregir y abre directamente el modo de mover ese pin. No modifica automáticamente la coordenada elegida. Se probó en navegador con un destino fuera de la red y recuperando el cálculo al moverlo a una calle. Los 205 stops actuales sí tienen una arista a menos de 40 m. Esto valida proximidad a la *red disponible*, no que un punto esté legalmente sobre la banqueta, ni que esa calle esté abierta o sea segura.

Inicio de correcciones posterior: el planificador ya no usa como punto de subida/bajada un segmento sin vértices intermedios de más de 1 km ni ofrece un viaje que lo atraviese. Es una protección conservadora, no una reparación de la geometría ni una certificación de las rutas restantes; puede reducir opciones hasta que se revisen esos trazos. El ETA durante seguimiento conserva la espera estimada de buses todavía no abordados, el paso manual se mantiene si se vuelve a las opciones en la misma sesión y los tramos a pie inferiores a 5 m dejan de mostrar `0 min` en la tarjeta.

Hay una herramienta de revisión autocontenida en `offline/PorDondePasa-auditoria.html`, generada por `node scripts/build-route-audit.cjs`. Muestra como **puntos A y B sin línea de unión** los 54 pares de vértices separados por más de 1 km en los trazos activos con desvíos, sobre 69 359 segmentos de la red peatonal local. Los 56 contados anteriormente correspondían a los trazos base, antes de aplicar desvíos. Permite filtrar rutas, marcar pendiente/revisar/verificado en calle, guardar notas locales y exportar un JSON. Las marcas no modifican el algoritmo ni los datos de rutas; un segmento sólo debe corregirse con geometría y sentido confirmados.

**Primer corte explícito:** `src/lib/routeFragments.ts` separa Agrónomos Universidad entre los vértices 220 y 221, tras aplicar los desvíos y antes de planificar. Son dos bucles cerrados en el archivo fuente; se conservan los 241 vértices, nombre, color e ID público. No se crea una conexión ni un transbordo ficticio entre los fragmentos. El mapa de auditoría sigue mostrando el par original para revisión de campo, pero el planificador usa dos fragmentos. Pruebas con la red peatonal existente conservaron opciones válidas dentro de ambos fragmentos (22 y 10 min en dos pares de prueba); no demuestran que el recorrido completo sea correcto en calle. Los demás cortes siguen sujetos al filtro de 1 km y a validación posterior.

## Riesgos prioritarios

| Prioridad | Hallazgo y evidencia | Efecto para la persona | Acción propuesta |
|---|---|---|---|
| P0 | En `public/data/tepic-routes.json` hay 211 pares consecutivos de vértices separados más de 500 m; el mayor supera 5.7 km. Es un análisis geométrico del archivo, no confirmación en calle de cada segmento. | Algunos trazos o viajes pueden cruzar zonas sin seguir la vialidad real. | Generar reporte por ruta/segmento, clasificar discontinuidades intencionadas y corregir geometrías contra la calle y el sentido real; bloquear opciones que contengan saltos no revisados. |
| P0 | `src/lib/router.ts` usa puntos del trazo como lugares posibles de subida/bajada y conexiones a hasta 350 m, sin comprobar parada autorizada ni seguridad peatonal del punto. | Puede proponer un abordaje, bajada o trasbordo impracticable. | Definir zonas de abordaje por ruta y sentido, con estado verificado/provisional. Donde se acostumbra pedir parada, marcar tramos seguros verificables en vez de inventar paradas oficiales. |
| P1 | La búsqueda en `HomeScreen.tsx` y `TransitApp.tsx` depende de 205 stops en tres archivos; no resuelve direcciones ni lugares generales. | Quien no conoce los nombres de las paradas tiene que encontrar el destino manualmente en el mapa. | Crear catálogo local de lugares con nombres y alias; luego búsqueda de calles/direcciones por fuente abierta, con cobertura y atribución verificadas. |
| P1 | Sólo un stop contiene `routeIds`; `src/lib/navigation.ts` infiere el resto por cercanía y lado del trazo. | Paradas enfrentadas o cruces pueden asociarse a la ruta/sentido equivocado. | Herramienta de revisión por ruta y sentido; distinguir dato explícito de inferido en la interfaz y no presentar como oficial lo que no se comprobó. |
| P1 | `src/lib/router.ts` supone caminar a 78 m/min, camión a 270 m/min, espera fija de 7 min por abordaje y tarifa de $10 por unidad. `FollowRoute.tsx` calcula el tiempo restante sólo sumando tiempos de tramos y omite la espera prevista. | Hora y costo pueden parecer más exactos de lo que son; el ETA cambia al empezar seguimiento. | Unificar cálculo de tiempo en un módulo, mostrar rango e indicar supuestos; recoger tiempos y tarifas reales antes de prometer precisión. |
| P1 | El progreso manual de `FollowRoute.tsx` reside en estado local del componente. Salir y volver a entrar crea de nuevo el paso inicial. | La persona puede perder el avance de su viaje. | Guardar sesión del viaje en la app, con opción explícita de reanudar/cancelar. |
| P1 | No se encontró service worker; el manifiesto no tiene iconos. El mapa y los datos se obtienen por red. | No hay navegación offline confiable ni instalación PWA completa. | Primero estados claros de sin conexión/datos incompletos; después caché versionada con límites y pruebas de actualización. |
| P2 | Hay elementos de 9–12 px en CSS y etiquetas densas; la tarjeta de ruta aún muestra transferencias de `0 min`. | Lectura difícil al caminar, bajo sol o para personas con visión reducida. | Auditar contraste, escala de texto, zoom del sistema, áreas táctiles y lector de pantalla; sustituir `0 min` por texto contextual. |
| P2 | Datos de rutas (~1.05 MB), red peatonal (~2.80 MB), MapLibre (~1.08 MB minificado) y worker de MapLibre (~0.51 MB) son considerables. `npm run build` advierte un chunk >500 kB. | Riesgo de arranque lento en teléfonos modestos y redes lentas. | Medir LCP/INP y primer resultado en teléfonos reales; perfilar CPU/memoria, diferir carga no crítica y particionar datos por región si la medición lo justifica. |

## Lo que funciona / límites observados

- El modo de selección responde al error fuera de calle y permite corregir sin perder el destino. Los stops existentes son cercanos a la red peatonal, según la misma regla de 40 m.
- El cálculo peatonal usa la red de calles; el seguimiento distingue lecturas GPS imprecisas y tiene confirmación manual de abordaje/descenso. Estas defensas existen en código, pero aún requieren recorrido real con iPhone/Android.
- Hay soporte visual claro/oscuro, colores por ruta y un mapa vectorial. No hay garantía de que todos los trazos, stops o desvíos sean correctos en campo.
- El build y `astro check` pasan; también las pruebas unitarias existentes y el script de desvíos. La prueba de interacción se hizo en navegador local a 390×844. No se comprobó GPS real, permisos Safari, giro físico, pérdida de red, lector de pantalla ni rendimiento de gama baja.

## Secuencia recomendada, sin romper el motor actual

1. **Seguridad y confianza de datos:** auditar saltos geométricos y puntos de abordaje/bajada; añadir estado de verificación por ruta y sentido. Mantener el motor actual como base y filtrar sólo casos demostrablemente inseguros.
2. **Consistencia del viaje:** corregir ETA/espera, conservar progreso del seguimiento y probar todos los estados vacíos o fallidos.
3. **Accesibilidad real:** pruebas guiadas con estudiante, persona adulta mayor y usuario primerizo; objetivos: encontrar destino sin conocer stops, entender dónde subir/bajar, poder corregir un error y completar el viaje sin leer letras diminutas.
4. **Búsqueda útil:** cargar el catálogo local de lugares producido con la herramienta GPS, incluir alias y categorías, medir búsquedas sin resultado y respetar privacidad. Evitar prometer cobertura que el catálogo no tenga.
5. **Rendimiento y resiliencia:** medir en dispositivos y redes reales antes de optimizar; luego PWA/offline si aporta valor y puede mantenerse actualizado.
6. **IA sólo donde añade valor comprobable:** tolerancia a errores de escritura, sinónimos y explicación en lenguaje sencillo de una opción ya calculada. Una IA no debe inventar calles, stops, tarifas, seguridad ni desvíos. Empezar con búsqueda local determinista y medir fallos; decidir después si un servicio de IA justifica costo, latencia y privacidad.

## Criterio de salida antes de monetización

Una ruta sugerida debe poder explicarse con trazo y sentido verificados, acceso peatonal conectado, punto de subida/bajada practicable y ETA etiquetado como estimación. Los errores deben permitir recuperarse sin reiniciar. Medirlo en recorridos de calle variados y con personas que no conocen la app, antes de añadir anuncios o suscripciones.
