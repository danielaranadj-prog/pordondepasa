# Vector basemap

OpenFreeMap (Positron by day, Dark at night) replaces the raster street background.
MapLibre is loaded on demand and now renders both the basemap and trip layers
directly. This avoids clipping caused by CSS rotation of the Leaflet adapter.
Route polylines, draggable destination, stop popups, heading-up camera and GPS
progress retain their existing data and semantics.
The map follows system appearance live and retains provider attribution.
No API key is required. WebGL initialization failures display an error; the prior
Leaflet implementation is retained in LegacyStreetMap.tsx for recovery, but is
not the active renderer. Public hosting depends on network/provider availability;
it is not an offline map or an SLA-backed service.

Routing, stops and transit data are unchanged. Native phone heading and GPS
must still be tested on a physical device during street trials.

Camera regression fix: native bearing rotates the viewport rather than a canvas
inside a rotated CSS pane. Native padding centers GPS/origin between the top
banner and bottom sheet; ResizeObserver recomputes when either changes size.
A temporary 390×844 browser harness verified 135° and 270° headings and open/
collapsed sheets. The harness was removed after testing. The location remained
visible and the canvas covered the full viewport without diagonal blank areas.

Verification: desktop map loaded, manual origin/destination produced five transit
options, and starting navigation displayed colored routes and four stops without
console errors. GPS/compass movement needs physical-device verification.
MapLibre and its worker add download weight but are lazy-loaded after opening
the map; the initial search screen does not require their JavaScript.
`npm audit` also reports existing Astro/esbuild/sharp advisories (including critical
severity on Astro). These are not MapLibre advisories; upgrading the framework is
a separate compatibility task to address before the next production deployment.
