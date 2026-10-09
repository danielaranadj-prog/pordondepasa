const fs = require('fs');
const d = JSON.parse(fs.readFileSync('/Users/danielarana/Downloads/routes.json', 'utf8')).routes[0];
const ida = d.ida;
const vuelta = d.vuelta;
let isReverse = true;
for(let i=0; i<ida.length; i++) {
  if (ida[i][0] !== vuelta[vuelta.length - 1 - i][0] || ida[i][1] !== vuelta[vuelta.length - 1 - i][1]) {
    isReverse = false;
    break;
  }
}
console.log("Is vuelta exact reverse of ida?", isReverse);
