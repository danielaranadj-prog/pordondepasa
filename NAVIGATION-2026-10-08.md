# Navegación: revisión local del 8 de octubre de 2026

Respaldo previo: `/private/tmp/PorDondePasa-before-navigation-20261008.tar` (archivo de HEAD; el árbol estaba limpio). Git conserva también el commit anterior. Sin push ni despliegue.

## Decisiones

- Seguimiento con rotación y perspectiva nativas de MapLibre. Interpolación exponencial dependiente del tiempo y arco angular corto. La posición visual no alimenta el cálculo de progreso.
- Encuadre dentro del espacio entre encabezado y panel, ligeramente por debajo del centro. Zoom 17.5 a pie, 16.8 en camión, 18 cerca del final; transiciones suaves y menos movimiento con la preferencia de accesibilidad correspondiente.
- Arrastre o zoom manual suspenden el seguimiento sin cambiar el rumbo. El control de ubicación lo recupera.
- Brújula con zona muerta de 2 grados, caducidad de 4 segundos y compensación de orientación de pantalla. El rumbo GPS caduca a los 10 segundos. En camión tiene prioridad sobre la brújula.
- Lecturas GPS de más de 15 segundos o precisión peor de 60 metros se descartan. Se detectan saltos implausibles. La última ubicación visible se atenúa al caducar; no se fuerza sobre la ruta.
- Se mantienen los límites existentes de progreso monotónico, precisión y distancia al trazo. Sólo su recorte visual se interpola, siguiendo exactamente los segmentos originales.
- Línea de bus con borde oscuro fino; caminata punteada sin halo blanco continuo. Círculo geográfico de precisión y punto con indicador de orientación. Los stops no se recrean al avanzar.
- Panel recogido por defecto con estimación restante, ruta y confirmación manual. Detalles y paradas se expanden. Las estimaciones provienen de los tramos existentes; no son predicciones de tráfico ni horarios en tiempo real.
- Las maniobras peatonales se deducen de cambios claros de dirección en la geometría existente. No se inventan nombres de calles: sin correspondencia entre cada segmento y su nombre, se conserva la instrucción disponible. No se alteró el algoritmo de selección de rutas ni los datos.

## Verificación y límites

- Pruebas unitarias de orientación incluyen 359→1 y 1→359; pruebas de maniobra cubren derecha, recta y giro ya completado. Se ejecuta también la suite existente de rutas, stops, caminata y encuadre.
- Escena temporal de simulación en navegador local, retirada al terminar: GPS en origen, avance, giro de 90 grados, panel recogido/expandido, transición a camión, GPS impreciso y pérdida de señal. Punto visible medido entre encabezado y panel en viewport 390×844. Estilos de mapa oscuro y claro cargados; la interfaz usa las variables del tema del sistema.
- La simulación no equivale a validar sensores físicos. Quedan pruebas de calle en Safari/iPhone y Android: orientación de pantalla, interferencia magnética, calles paralelas, pérdida/recuperación de GPS y rendimiento/batería. La calidad de las maniobras depende de la geometría y conectividad peatonal disponibles.
- No se añadieron APIs de pago ni dependencias. El aviso de tamaño del bundle de MapLibre preexistente continúa.
