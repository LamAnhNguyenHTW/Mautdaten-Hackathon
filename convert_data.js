const fs = require('fs');
const path = require('path');
const shapefile = require('shapefile');
const proj4 = require('proj4');

// UTM32N → WGS84 projection
const UTM32N = '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
const WGS84 = '+proj=longlat +datum=WGS84 +no_defs';

// Bounding boxes for Accident data extraction
const BBOXES = {
    berlin: { minLng: 13.05, maxLng: 13.78, minLat: 52.33, maxLat: 52.69 },
    dortmund: { minLng: 7.20, maxLng: 7.70, minLat: 51.40, maxLat: 51.65 },
    kassel: { minLng: 9.35, maxLng: 9.60, minLat: 51.25, maxLat: 51.40 }
};

const OUT_DIR = path.join(__dirname, 'daten', 'geojson');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function inBerlin(lng, lat) {
    return lng >= BBOXES.berlin.minLng && lng <= BBOXES.berlin.maxLng &&
           lat >= BBOXES.berlin.minLat && lat <= BBOXES.berlin.maxLat;
}

function getCityForCoord(lng, lat) {
    for (const [name, box] of Object.entries(BBOXES)) {
        if (lng >= box.minLng && lng <= box.maxLng &&
            lat >= box.minLat && lat <= box.maxLat) {
            return name;
        }
    }
    return null;
}

// ── 1. Convert Unfallorte CSV (Berlin, Dortmund, Kassel) ──
function convertUnfallorte() {
    console.log('📍 Converting Unfallorte for Berlin, Dortmund and Kassel...');
    const csv = fs.readFileSync(path.join(__dirname, 'Daten', 'Unfallorte2024_LinRef.csv'), 'utf-8');
    const lines = csv.split('\n');
    const header = lines[0].replace('\r', '').split(';');
    
    const iX = header.indexOf('XGCSWGS84');
    const iY = header.indexOf('YGCSWGS84');
    const iKAT = header.indexOf('UKATEGORIE');
    const iART = header.indexOf('UART');
    const iMONAT = header.indexOf('UMONAT');
    const iSTUNDE = header.indexOf('USTUNDE');
    const iRAD = header.indexOf('IstRad');
    const iPKW = header.indexOf('IstPKW');
    const iFUSS = header.indexOf('IstFuss');
    const iKRAD = header.indexOf('IstKrad');
    const iGKFZ = header.indexOf('IstGkfz');
    
    const featuresByCity = { berlin: [], dortmund: [], kassel: [] };
    let skipped = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].replace('\r', '');
        if (!line) continue;
        const cols = line.split(';');
        
        let lng = parseFloat(cols[iX]);
        let lat = parseFloat(cols[iY]);
        if (cols[iX] && cols[iX].includes(',')) lng = parseFloat(cols[iX].replace(',', '.'));
        if (cols[iY] && cols[iY].includes(',')) lat = parseFloat(cols[iY].replace(',', '.'));
        
        if (isNaN(lng) || isNaN(lat)) { skipped++; continue; }
        
        const city = getCityForCoord(lng, lat);
        if (!city) continue; // Wait, if it's not in the cities, we effectively skip it.
        
        const kategorie = parseInt(cols[iKAT]) || 3;
        const art = parseInt(cols[iART]) || 0;
        
        featuresByCity[city].push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: {
                kat: kategorie,
                art: art,
                monat: parseInt(cols[iMONAT]) || 0,
                stunde: parseInt(cols[iSTUNDE]) || 0,
                rad: cols[iRAD] === '1',
                pkw: cols[iPKW] === '1',
                fuss: cols[iFUSS] === '1',
                krad: cols[iKRAD] === '1',
                gkfz: cols[iGKFZ] === '1',
            }
        });
    }
    
    for (const [city, features] of Object.entries(featuresByCity)) {
        const geojson = { type: 'FeatureCollection', features };
        fs.writeFileSync(path.join(OUT_DIR, `unfaelle_${city}.json`), JSON.stringify(geojson));
        console.log(`   ✅ ${features.length} Unfälle in ${city}`);
    }
}

// ── 2. Convert Shapefile to GeoJSON (Berlin bbox) ──
async function convertShapefile(name, filterBerlin = true) {
    console.log(`🗺️  Converting ${name}...`);
    const shpPath = path.join(__dirname, 'Daten', `${name}.shp`);
    const dbfPath = path.join(__dirname, 'Daten', `${name}.dbf`);
    
    if (!fs.existsSync(shpPath)) {
        console.log(`   ⚠️ ${shpPath} not found, skipping`);
        return;
    }
    
    const features = [];
    const source = await shapefile.open(shpPath, dbfPath);
    
    while (true) {
        const result = await source.read();
        if (result.done) break;
        
        const feature = result.value;
        if (!feature.geometry) continue;
        
        // Transform coordinates from UTM32N to WGS84
        const transformed = transformGeometry(feature.geometry);
        
        // Filter by Berlin bbox if requested
        if (filterBerlin) {
            const coords = getFirstCoord(transformed);
            if (coords && !inBerlin(coords[0], coords[1])) continue;
        }
        
        features.push({
            type: 'Feature',
            geometry: transformed,
            properties: feature.properties || {}
        });
    }
    
    const geojson = { type: 'FeatureCollection', features };
    fs.writeFileSync(path.join(OUT_DIR, `${name}_berlin.json`), JSON.stringify(geojson));
    console.log(`   ✅ ${features.length} Features für Berlin`);
}

function transformCoord(coord) {
    const [x, y] = coord;
    const [lng, lat] = proj4(UTM32N, WGS84, [x, y]);
    return [Math.round(lng * 1000000) / 1000000, Math.round(lat * 1000000) / 1000000];
}

function transformGeometry(geom) {
    switch (geom.type) {
        case 'Point':
            return { type: 'Point', coordinates: transformCoord(geom.coordinates) };
        case 'MultiPoint':
            return { type: 'MultiPoint', coordinates: geom.coordinates.map(transformCoord) };
        case 'LineString':
            return { type: 'LineString', coordinates: geom.coordinates.map(transformCoord) };
        case 'MultiLineString':
            return { type: 'MultiLineString', coordinates: geom.coordinates.map(ring => ring.map(transformCoord)) };
        case 'Polygon':
            return { type: 'Polygon', coordinates: geom.coordinates.map(ring => ring.map(transformCoord)) };
        case 'MultiPolygon':
            return { type: 'MultiPolygon', coordinates: geom.coordinates.map(poly => poly.map(ring => ring.map(transformCoord))) };
        default:
            return geom;
    }
}

function getFirstCoord(geom) {
    if (!geom || !geom.coordinates) return null;
    let c = geom.coordinates;
    while (Array.isArray(c[0])) c = c[0];
    return c.length >= 2 ? c : null;
}

// ── Run all conversions ──
async function main() {
    console.log('🚀 Starting data conversion for Berlin...\n');
    
    // 1. Unfallorte
    convertUnfallorte();
    
    // We only re-convert shapefiles if needed, for now we will skip them so script runs fast and just converts accidents
    // 2. Shapefiles
    /*
    await convertShapefile('ampel');
    await convertShapefile('kreisverkehr');
    await convertShapefile('laermschutzwand');
    await convertShapefile('strassenemission');
    await convertShapefile('laermstatistik');
    */
    
    console.log('\n✅ All done! GeoJSON files are in daten/geojson/');
}

main().catch(console.error);
