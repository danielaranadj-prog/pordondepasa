# Recálculo peatonal local — 13 de octubre de 2026

## Alcance

Cuando el usuario confirma un camino diferente a pie, se recalcula solo el tramo peatonal activo desde su GPS al mismo endpoint: abordaje, siguiente unidad o acceso al destino. No se ejecuta `findRoutes` de nuevo. Los trazos fuente, segmentos de camión, sus colores, sentido, paradas, tarifas, trasbordos, identidad del viaje y campañas no se modifican. El ajuste se conserva en la opción seleccionada durante esta sesión; no se escribe en los archivos de rutas ni se envían coordenadas a un servicio nuevo.

## Protecciones

- Tres lecturas precisas (≤30 m), plausibles y continuas, que abarquen al menos ocho segundos. Separación del trazo >máximo(35 m, dos veces la precisión).
- Retroceso confirmado sobre la misma calle también puede ajustar la caminata para no congelar el progreso monotónico. La proximidad de llegada (25 m) no dispara otro cálculo.
- Intervalo mínimo de veinte segundos entre intentos. Después de un fallo, se requiere desplazamiento de veinte metros o reintento manual.
- Operación dedicada en el mismo worker, con red de calles cargada y reutilizada; no nuevas APIs, dependencias o consultas de IA.
- Preferencia suave por continuar en el sentido de desplazamiento GPS fiable; una penalización de salida de hasta 80 m no altera metros/minutos mostrados. El ruteo normal no recibe esta preferencia. No obliga a un circuito enorme para evitar cualquier regreso.
- La preferencia también se aplica si el GPS cae exactamente en un cruce; la salida inicial de longitud cero no la elimina. Pruebas adicionales verifican continuación, vuelta y distancia física en una bifurcación.
- Conserva el endpoint exacto y el límite de 1.800 m del motor peatonal. Una calle desconectada o sin cobertura devuelve fallo, nunca una diagonal.
- Rechaza respuestas antiguas si el usuario abordó, terminó, salió del seguimiento, cambió de geometría, perdió GPS, volvió al trazo anterior o se alejó del origen calculado.
- Reinicia el progreso y el recorte únicamente de la geometría reemplazada. La brújula, cámara, GPS y confirmación manual siguen montados.
- Una elección peatonal normal ya no ofrece registrar un desvío del transporte. Si falla, conserva el camino anterior, muestra aviso y permite reintento u otras opciones de viaje.

## Verificado

- Pruebas automatizadas: GPS impreciso/viejo, ruido sobre el trazo, salto imposible, pérdida de señal, retroceso, enfriamiento, caché por orientación, distancia física, extremos fijos, ausencia de mutación, abordaje/trasbordo/tramo final y continuidad sobre calles reales Miguel Lebrija–Río Suchiate.
- Revisión adicional antes de publicar: 320 recorridos peatonales sobre calles reales en cuatro orientaciones conservaron su distancia física, incluidos los accesos a la red, sin añadir el costo interno de preferencia al tiempo o distancia mostrados.
- Navegador con GPS simulado y worker real: ajuste de 809 m a 623 m, cambio de Roberto Fierro a Santiago Valle, mismo abordaje y camión; dos fixes posteriores redujeron la distancia a 614 m.
- Navegador: precisión de 55 m no cambió el viaje; una conexión faltante mantuvo el recorrido; abordaje durante una respuesta retrasada de prueba (1,8 s) descartó el resultado y dejó cero cambios en caminata/camión.
- Tamaños 390×844 y 320×568, tarjeta cerrada/abierta. En 320×568 expandido, la ubicación quedó entre el borde superior (116 px) y la tarjeta (193 px), sin quedar tapada.
- Los componentes de simulación se retiraron del proyecto antes de las comprobaciones y del build finales. El respaldo y las evidencias quedaron en `/private/tmp/pordondepasa-walk-reroute.ypyXqx`.
- Suite completa de pruebas y pruebas de desvíos aprobadas; `npm run check`: cero errores/advertencias y tres hints preexistentes; `npm run build` correcto (aviso preexistente de tamaño de MapLibre). Búsqueda normal en la versión compilada: Centro de Tepic → Las Banderas devolvió cinco opciones, México como primera opción de 26 minutos, sin errores nuevos de carga.

## Limitaciones y prueba física pendiente

No contamos con un inventario verificado de iluminación, seguridad, banquetas accesibles o disponibilidad de cruces: no se promete una calle “segura” o “más iluminada”. Se respeta la elección del usuario y la conectividad de la red local. Sigue siendo necesario caminar con Safari/Android real para ajustar sensibilidad GPS, verificar movimiento continuo y suspensión/reanudación. Una web en segundo plano puede dejar de recibir ubicación; se exige señal reciente antes de recalcular. No cambia automáticamente de unidad o de abordaje cuando no hay conexión peatonal válida.
