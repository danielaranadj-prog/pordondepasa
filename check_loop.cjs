const fs = require('fs');

const mainDataPath = './public/data/tepic-routes.json';
const mainData = JSON.parse(fs.readFileSync(mainDataPath, 'utf8'));
const route = mainData.routes.find(r => r.id === 'r-o-suchiate');

if (!route) {
  console.log("Route not found");
  process.exit();
}

const coords = route.coordinates;
const first = coords[0];
const last = coords[coords.length - 1];

function distance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

const d = distance(first.lat, first.lng, last.lat, last.lng);
console.log(`First point: ${first.lat}, ${first.lng}`);
console.log(`Last point: ${last.lat}, ${last.lng}`);
console.log(`Distance between first and last: ${d.toFixed(2)} meters`);

