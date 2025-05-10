// Initialiser la carte sans répétition
var map = L.map('map', {
    center: [20, 0],
    zoom: 2,
    worldCopyJump: false,
    maxBounds: [[-90, -180], [90, 180]],
    maxBoundsViscosity: 1.0
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    noWrap: true,
}).addTo(map);

// Charger les données HDI depuis le CSV
async function loadHDIData() {
    const response = await fetch('HDI.csv');
    const data = await response.text();
    const lines = data.split('\n').slice(8); // Ignore les premières lignes inutiles

    const hdiData = {};
    lines.forEach(line => {
        const cols = line.split(';');
        if (cols.length > 2) {
            const country = cols[1].trim();
            const hdi = cols[2].trim().replace(',', '.'); // Remplacer la virgule par un point pour décimal
            if (country && !isNaN(hdi)) {
                hdiData[country] = parseFloat(hdi);
            }
        }
    });
    return hdiData;
}


// Fonction pour obtenir une couleur selon le HDI
function getColor(hdi) {
    return hdi > 0.8 ? '#1a9850' :      // vert (HDI élevé)
           hdi > 0.6 ? '#fee08b' :      // orange clair (moyen-haut)
           hdi > 0.4 ? '#fdae61' :      // orange foncé (moyen-bas)
                       '#d73027';       // rouge (HDI faible)
}

// Charger GeoJSON et HDI, puis afficher
Promise.all([
    fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json').then(res => res.json()),
    loadHDIData()
]).then(([geoData, hdiData]) => {
    L.geoJSON(geoData, {
        style: function(feature) {
            let countryName = feature.properties.name;
            let hdi = hdiData[countryName];

            return {
                fillColor: hdi ? getColor(hdi) : '#ccc', // Gris si HDI inconnu
                weight: 1,
                color: 'white',
                fillOpacity: 0.7
            };
        },
        onEachFeature: function(feature, layer) {
            let countryName = feature.properties.name;
            let hdi = hdiData[countryName];

            layer.bindPopup(`<strong>${countryName}</strong><br>HDI: ${hdi ? hdi : 'Donnée non disponible'}`);

            layer.on({
                mouseover: highlightFeature,
                mouseout: resetHighlight,
            });
        }
    }).addTo(map);
});

// Style hover
function highlightFeature(e) {
    var layer = e.target;
    layer.setStyle({
        weight: 3,
        color: '#000',
        fillOpacity: 0.9
    });
    layer.bringToFront();
}

// Reset hover
function resetHighlight(e) {
    var layer = e.target;
    layer.setStyle({
        weight: 1,
        color: 'white',
        fillOpacity: 0.7
    });
}
