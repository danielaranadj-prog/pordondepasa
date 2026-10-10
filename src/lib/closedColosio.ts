// Colosio is closed in both directions between Prisciliano Sánchez and
// Miguel Ávalos Ordaz. These are the two carriageways from the preserved
// pre-detour route geometry, clipped at the OSM street intersections.
// Keeping this small dataset separate makes the closure visible regardless
// of which transit route the passenger selects.
export const closedColosioLines = [
 [
  [-104.8846511,21.5141126],[-104.8836542,21.5138463],
  [-104.8833278,21.5137497],[-104.8830994,21.5136227],
  [-104.8829312,21.5134698],[-104.8827832,21.5132793],
  [-104.8825499,21.5128866],[-104.8821511,21.5122095],
  [-104.8817449,21.5114854],[-104.8813962,21.5108764],
  [-104.8812407,21.510693],[-104.8809947,21.5105071],
  [-104.8806156,21.5103024],[-104.8792854,21.5097246],
 ],
 [
  [-104.8846783,21.5141955],[-104.8838521,21.5140187],
  [-104.8833876,21.5138844],[-104.8831893,21.513809],
  [-104.8830286,21.5137032],[-104.8828379,21.5135362],
  [-104.8826923,21.5133551],[-104.8824866,21.5130212],
  [-104.8818271,21.5118339],[-104.8814784,21.511286],
  [-104.8812777,21.5109686],[-104.8811473,21.5108064],
  [-104.8809113,21.5106182],[-104.8807507,21.5105264],
  [-104.8792284,21.5098350],
 ],
] as const;

export const closedColosioLabel = [-104.8820,21.5120] as const;
