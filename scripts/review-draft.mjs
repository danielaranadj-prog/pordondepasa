import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Uso: npm run data:review -- /ruta/al/pordondepasa-borrador.json');
  process.exit(2);
}
const path = resolve(file);
if (statSync(path).size > 50_000_000) throw Error('El borrador supera 50 MB.');
const data = JSON.parse(readFileSync(path, 'utf8'));
const errors = [];
const warnings = [];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const point = value => object(value) && Number.isFinite(value.lat) && Number.isFinite(value.lng)
  && value.lat >= 21.2 && value.lat <= 21.8 && value.lng >= -105.2 && value.lng <= -104.5;
const unique = (items, kind) => {
  const ids = new Set();
  items.forEach((item, index) => {
    if (!object(item) || typeof item.id !== 'string' || !item.id.trim()) errors.push(`${kind} ${index + 1}: falta ID`);
    else if (ids.has(item.id)) errors.push(`${kind}: ID duplicado ${item.id}`);
    else ids.add(item.id);
  });
  return ids;
};
if (!object(data) || data.schemaVersion !== 1 || data.dataset !== 'pordondepasa-draft' || data.status !== 'draft') {
  errors.push('No es un borrador PorDóndePasa v1.');
}
for (const key of ['routes', 'stops', 'places', 'ads']) {
  if (!Array.isArray(data?.[key])) errors.push(`Falta la lista ${key}.`);
}
if (errors.length === 0) {
  const routeIds = unique(data.routes, 'Ruta');
  unique(data.stops, 'Parada');
  unique(data.places, 'Lugar');
  unique(data.ads, 'Campaña');
  data.routes.forEach(route => {
    if (!object(route)) return;
    if (typeof route.name !== 'string' || !route.name.trim()) errors.push(`Ruta ${route.id}: falta nombre`);
    if (typeof route.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(route.color)) errors.push(`Ruta ${route.id}: color inválido`);
    for (const direction of ['ida', 'vuelta']) {
      const trace = route[direction];
      if (!Array.isArray(trace) || !trace.every(p => Array.isArray(p) && p.length === 2 && point({ lat: p[0], lng: p[1] }))) {
        errors.push(`Ruta ${route.id}: trazo ${direction} inválido`);
      } else if (trace.length < 2) warnings.push(`Ruta ${route.id}: ${direction} tiene menos de dos puntos`);
    }
  });
  data.stops.forEach(stop => {
    if (!object(stop)) return;
    if (!point(stop.coordinates)) errors.push(`Parada ${stop.id}: coordenadas inválidas`);
    if (!['ida', 'vuelta'].includes(stop.direction)) errors.push(`Parada ${stop.id}: falta sentido`);
    if (Array.isArray(stop.routeIds)) for (const id of stop.routeIds) if (!routeIds.has(id)) warnings.push(`Parada ${stop.id}: ruta desconocida ${id}`);
  });
  data.places.forEach(place => {
    if (!object(place)) return;
    if (!point(place.coordinates)) errors.push(`Lugar ${place.id}: coordenadas inválidas`);
    if (place.status !== 'verificado') warnings.push(`Lugar ${place.id}: aún no verificado`);
  });
  data.ads.forEach(ad => {
    if (!object(ad)) return;
    if ('clientId' in ad || 'notes' in ad) errors.push(`Campaña ${ad.id}: contiene datos internos`);
    if (ad.coordinates && !point(ad.coordinates)) errors.push(`Campaña ${ad.id}: coordenadas inválidas`);
    if (Array.isArray(ad.routeIds)) for (const id of ad.routeIds) if (!routeIds.has(id)) warnings.push(`Campaña ${ad.id}: ruta desconocida ${id}`);
  });
}
const current = JSON.parse(readFileSync(new URL('../public/data/tepic-routes.json', import.meta.url), 'utf8'));
const currentIds = new Set(current.routes.map(route => route.id));
const draftIds = new Set((data.routes || []).map(route => route.id));
const removed = [...currentIds].filter(id => !draftIds.has(id));
if (removed.length) warnings.push(`${removed.length} rutas publicadas no aparecen en el borrador: ${removed.slice(0, 10).join(', ')}`);
console.log(JSON.stringify({ valid: errors.length === 0, counts: Object.fromEntries(['routes', 'stops', 'places', 'ads'].map(key => [key, data[key]?.length ?? 0])), errors, warnings }, null, 2));
process.exitCode = errors.length ? 1 : 0;
