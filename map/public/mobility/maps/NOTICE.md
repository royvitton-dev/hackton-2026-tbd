# Road and charging map data

© OpenStreetMap contributors. The databases in `index.json` and `raw/*.json`
are extracted/adapted OpenStreetMap data, available under the
[Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
See [OpenStreetMap copyright and attribution](https://www.openstreetmap.org/copyright).

Source: [Geofabrik South Korea](https://download.geofabrik.de/asia/south-korea.html),
`south-korea-260920.osm.pbf`, snapshot **2026-09-20T20:22:06Z**.
Each `.source.json` records the source URL, country-file SHA-256, local-file
SHA-256, bounds, extraction method and acquisition time. The large country PBF
is not distributed with the app. The local extracts are distributed here.

Changes: extract roads, buildings, charging stations, barrier nodes and turn
restrictions for 20 small areas; retain original OSM IDs and tags; calculate
road connections and candidate routes. Charger fields come from the original
tags. Missing availability, power, capacity or opening hours are not inferred.
Building display heights use the original height, otherwise levels × 3 m,
otherwise a **6 m visualization assumption**. These are not surveyed 3D models.

OSM road/charger data is not a record of a vehicle actually driving the route.
The animation is a simulation. No current traffic, charger availability,
electrical wiring or radio measurements are supplied by these snapshots.
