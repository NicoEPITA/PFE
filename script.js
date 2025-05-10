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


function getColor(hdi) {
    if (isNaN(hdi)) return '#ccc';

    const red = hdi < 0.5 ? 220 : Math.round(220 - (hdi - 0.5) * 2 * 220);
    
    const green = hdi > 0.5 ? 180 : Math.round(hdi * 2 * 180);

    const blue = hdi > 0.5 ? Math.round((hdi - 0.5) * 2 * 120) : 0;

    return `rgb(${red},${green},${blue})`;
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

// Ajout d'une légende personnalisée en bas à droite
var legend = L.control({ position: 'bottomright' });

legend.onAdd = function (map) {
    var div = L.DomUtil.create('div', 'info legend'),
        grades = [0, 0.25, 0.5, 0.75, 1],
        labels = [];

    div.innerHTML += "<strong>Échelle HDI</strong><br>";

    // Boucle sur les intervalles et génère les labels avec couleurs associées
    for (var i = 0; i < grades.length - 1; i++) {
        var color = getColor((grades[i] + grades[i + 1]) / 2); // Couleur moyenne pour l'intervalle
        div.innerHTML +=
            '<i style="background:' + color + '; width:18px; height:18px; float:left; margin-right:5px; opacity:0.8;"></i> ' +
            grades[i] + ' - ' + grades[i + 1] + '<br>';
    }

    return div;
};

legend.addTo(map);

