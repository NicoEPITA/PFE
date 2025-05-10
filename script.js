// Initialiser la carte centrée sur le monde avec une limite stricte des bords visibles
var map = L.map('map', {
    center: [20, 0],
    zoom: 2,
    worldCopyJump: false,   // Empêche la répétition infinie de la carte
    maxBounds: [
        [-90, -180],
        [90, 180]
    ],
    maxBoundsViscosity: 1.0 // Empêche complètement le déplacement au-delà des limites
});

// Ajouter un fond de carte (OpenStreetMap) avec noWrap activé
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    noWrap: true,  // Empêche la répétition horizontale du fond de carte
}).addTo(map);

// Charger les données GeoJSON pour les pays
fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
    .then(response => response.json())
    .then(data => {
        L.geoJSON(data, {
            style: {
                color: "#2262CC",
                weight: 1,
                fillOpacity: 0.2
            },
            onEachFeature: function(feature, layer) {
                layer.on({
                    mouseover: highlightFeature,
                    mouseout: resetHighlight,
                });
            }
        }).addTo(map);
    });

// Surligner un pays
function highlightFeature(e) {
    var layer = e.target;
    layer.setStyle({
        weight: 3,
        color: '#666',
        fillOpacity: 0.7
    });
    layer.bringToFront();
}

// Réinitialiser le style original
function resetHighlight(e) {
    var layer = e.target;
    layer.setStyle({
        weight: 1,
        color: "#2262CC",
        fillOpacity: 0.2
    });
}
