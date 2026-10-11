import type {Point} from './router';

export type Place={
  id:string;
  name:string;
  category:string;
  aliases:string[];
  neighborhood:string;
  municipality:string;
  entrance:string;
  status:string;
  coordinates:Point;
  access:Point;
  accessMeters:number
};

export const normalizePlace=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

export function searchPlaces(places:Place[],text:string,limit=8):Place[]{
  const term=normalizePlace(text.trim());
  if(term.length<2)return [];
  return places.filter(place=>[place.name,...place.aliases,place.neighborhood].some(value=>normalizePlace(value).includes(term)))
   .sort((a,b)=>Number(normalizePlace(b.name).startsWith(term))-Number(normalizePlace(a.name).startsWith(term))||Number(b.status==='verificado')-Number(a.status==='verificado')||a.name.localeCompare(b.name,'es'))
   .slice(0,limit);
}

/**
 * Retorna el ícono representativo de acuerdo a la categoría o tipo de lugar definido en el GeoJSON/Dataset.
 */
export function getPlaceCategoryIcon(categoryOrPlace?: string | { category?: string; name?: string }): string {
  if (!categoryOrPlace) return '📍';
  const category = typeof categoryOrPlace === 'string'
    ? categoryOrPlace.toLowerCase().trim()
    : (categoryOrPlace.category || '').toLowerCase().trim();
  const name = typeof categoryOrPlace === 'object' && categoryOrPlace.name
    ? categoryOrPlace.name.toLowerCase()
    : '';

  // 1. Mapeo directo por categoría oficial del GeoJSON
  switch (category) {
    case 'hospital':
    case 'salud':
    case 'clinica':
      return '🏥';
    case 'escuela':
    case 'universidad':
    case 'educacion':
      return '🎓';
    case 'plaza':
    case 'tienda':
    case 'supermercado':
    case 'comercial':
      return '🛍️';
    case 'religion':
    case 'iglesia':
    case 'templo':
      return '⛪';
    case 'parque':
    case 'jardin':
    case 'plaza_publica':
      return '🌳';
    case 'museo':
    case 'cultura':
      return '🏛️';
    case 'cine':
      return '🎬';
    case 'teatro':
      return '🎭';
    case 'restaurante':
    case 'comida':
    case 'alimentos':
      return '🍔';
    case 'terminal':
    case 'central':
    case 'transporte':
      return '🚌';
    case 'estadio':
      return '🏟️';
    case 'deporte':
    case 'cancha':
      return '⚽';
    case 'gimnasio':
    case 'gym':
      return '🏋️';
    case 'gobierno':
      return '🏛️';
    case 'oficina':
      return '🏢';
    case 'cementerio':
    case 'panteon':
      return '🪦';
    case 'mercado':
      return '🏪';
    case 'monumento':
      return '⛲';
    case 'agencia':
    case 'automotriz':
      return '🚗';
    case 'banco':
      return '🏦';
    case 'farmacia':
      return '💊';
    default:
      break;
  }

  // 2. Inferencia por palabras clave en el nombre si la categoría es 'otro' o viene vacía
  if (/catedral|iglesia|templo|parroquia|convento|capilla/i.test(name)) return '⛪';
  if (/hospital|clinica|imss|issste|sanatorio|medico|rehabilitacion|salud/i.test(name)) return '🏥';
  if (/escuela|prepa|colegio|universidad|instituto|facultad|conalep|cetis|tecnologico/i.test(name)) return '🎓';
  if (/walmart|soriana|chedraui|liverpool|sam's|bodega aurrera|coppel|ley|plaza/i.test(name)) return '🛍️';
  if (/mercado/i.test(name)) return '🏪';
  if (/cine|cinemex|cinepolis|labcinema/i.test(name)) return '🎬';
  if (/teatro|acustica/i.test(name)) return '🎭';
  if (/museo|galeria/i.test(name)) return '🏛️';
  if (/parque|alameda|ecologico/i.test(name)) return '🌳';
  if (/estadio|arena|cancha|deportiv|auditorio/i.test(name)) return '🏟️';
  if (/gimnasio|gym|fitness|climbing/i.test(name)) return '🏋️';
  if (/restaurante|carl's|domino|tacos|cafe|burger|pizza/i.test(name)) return '🍔';
  if (/terminal|autobus|tufesa|omnibus/i.test(name)) return '🚌';
  if (/panteon|cementerio/i.test(name)) return '🪦';
  if (/palacio|gobierno|sre|ine\b/i.test(name)) return '🏛️';
  if (/monumento/i.test(name)) return '⛲';

  return '📍';
}

/**
 * Retorna una etiqueta legible para la categoría del lugar.
 */
export function getPlaceCategoryLabel(category?: string): string {
  if (!category) return 'Lugar';
  switch (category.toLowerCase().trim()) {
    case 'hospital': return 'Hospital / Salud';
    case 'escuela': return 'Educación';
    case 'plaza': return 'Comercio / Plaza';
    case 'religion': return 'Templo / Religión';
    case 'parque': return 'Parque';
    case 'museo': return 'Museo / Cultura';
    case 'cine': return 'Cine';
    case 'teatro': return 'Teatro';
    case 'restaurante': return 'Restaurante';
    case 'terminal': return 'Terminal de autobuses';
    case 'estadio': return 'Estadio';
    case 'deporte': return 'Deporte';
    case 'gimnasio': return 'Gimnasio';
    case 'gobierno': return 'Gobierno';
    case 'oficina': return 'Oficina pública';
    case 'cementerio': return 'Panteón';
    case 'mercado': return 'Mercado';
    case 'monumento': return 'Monumento';
    case 'agencia': return 'Agencia';
    default: return 'Lugar de interés';
  }
}
