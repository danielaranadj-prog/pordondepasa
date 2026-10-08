# Vector basemap

OpenFreeMap (Positron by day, Dark at night) replaces the raster street background.
MapLibre is loaded on demand through its Leaflet adapter, preserving existing
route polylines, drag markers, stops, heading-up rotation, and GPS progress.
The map follows system appearance live and retains provider attribution.
No API key is required. If WebGL initialization fails, the original OSM raster
layer remains available. Public hosting depends on network/provider availability;
it is not an offline map or an SLA-backed service.

Routing, stops and transit data are unchanged. Native phone heading and GPS
must still be tested on a physical device during street trials.

Verification: desktop map loaded, manual origin/destination produced five transit
options, and starting navigation displayed colored routes and four stops without
console errors. GPS/compass movement needs physical-device verification.
MapLibre and its worker add download weight but are lazy-loaded after opening
the map; the initial search screen does not require their JavaScript.
`npm audit` also reports existing Astro/esbuild/sharp advisories (including critical
severity on Astro). These are not MapLibre advisories; upgrading the framework is
a separate compatibility task to address before the next production deployment.
