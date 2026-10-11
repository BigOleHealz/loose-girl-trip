# State boundaries

`us-states.json` is derived from the [US Census Bureau's 2024 state/equivalent cartographic boundaries at 1:5,000,000](https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_state_5m.zip). It includes the 50 states, DC and US territories. The shapefile was converted to GeoJSON, retaining only names and abbreviations, simplified with Turf (0.01-degree tolerance, high quality) and rounded to four decimal places. It is imported only by server routing code, rather than downloaded by the browser or queried for every sample.

State mileage estimates classify midpoint samples at intervals of approximately five miles using Turf point-in-polygon, then allocate the ORS-reported distance across those samples. Unknown samples remain labeled **Outside mapped states**, so miles are not silently attributed to a neighboring state. Simplified borders, coastlines, road geometry and sparse samples can affect estimates near a border. This is a planning estimate, not a survey.

This is US federal Census data. Retain this provenance when updating the boundary file. Census cartographic boundaries are generalized coastlines and borders; they are not intended for legal boundary determinations.
