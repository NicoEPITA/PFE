let map = L.map('map', {
    center: [20, 0],
    zoom: 2,
    maxBounds: [[-90, -180], [90, 180]],
    maxBoundsViscosity: 1.0,
    worldCopyJump: false
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    noWrap: true,
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let geoLayer;
let allGeoData;
let hdiDataByYear = {};
let availableYears = new Set();

const countryAliases = {
    "United States": "United States of America",
    "Congo (Democratic Republic of the)" : "Democratic Republic of the Congo",
    "Czechia": "Czech Republic",
    "Russian Federation": "Russia",
    "Korea (Republic of)" : "South Korea",
    "Democratic People's Republic of Korea" : "North Korea",
    "Syrian Arab Republic" : "Syria",
    "Iran (Islamic Republic of)": "Iran",
    "Venezuela (Bolivarian Republic of)" : "Venezuela",
    "Viet Nam" : "Vietnam",
    "Lao People's Democratic Republic" : "Laos",
    "C�te d'Ivoire" : "Ivory Coast",
    "Tanzania (United Republic of)" : "United Republic of Tanzania",
    "Bolivia (Plurinational State of)" : "Bolivia",
    "Brunei": "Brunei Darussalam",
    "Moldova (Republic of)" : "Moldova",
    "Palestine": "State of Palestine",
    "Micronesia": "Micronesia (Federated States of)",
    "Serbia" : "Republic of Serbia",
    "Guinea-Bissau" : "Guinea Bissau",
};

function getColor(hdi) {
    if (isNaN(hdi)) return '#666';
    const red = hdi < 0.5 ? 220 : Math.round(220 - (hdi - 0.5) * 2 * 220);
    const green = hdi > 0.5 ? 180 : Math.round(hdi * 2 * 180);
    const blue = hdi > 0.5 ? Math.round((hdi - 0.5) * 2 * 120) : 0;
    return `rgb(${red},${green},${blue})`;
}

async function loadHDIData() {
    const res = await fetch('hdr-data.csv');
    const text = await res.text();
    const lines = text.split('\n');
    const header = lines[0].split(';');

    const indicatorCol = header.indexOf('indicatorCode');
    const yearCol = header.indexOf('year');
    const valueCol = header.indexOf('value');
    const countryCol = header.indexOf('country');

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';');
        const indicator = cols[indicatorCol]?.trim();
        const year = parseInt(cols[yearCol]);
        const value = parseFloat(cols[valueCol]?.replace(',', '.'));
        const country = cols[countryCol]?.trim();

        if (!country || !indicator || isNaN(year) || isNaN(value)) continue;

        if (!hdiDataByYear[year]) hdiDataByYear[year] = {};
        if (!hdiDataByYear[year][country]) hdiDataByYear[year][country] = {};
        hdiDataByYear[year][country][indicator] = value;

        availableYears.add(year);
    }
}

async function initMap() {
    await loadHDIData();

    allGeoData = await fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
        .then(res => res.json());

    drawMap();
    setupSlider();
    setupContinentFilter();
}

function drawMap(continent = "world") {
    if (geoLayer) {
        map.removeLayer(geoLayer);
    }

    const year = parseInt(document.getElementById("year-slider").value);

    const filteredFeatures = allGeoData.features.filter(feature => {
        let countryName = feature.properties.name;
    
        // Appliquer l'alias s'il existe
        for (let alias in countryAliases) {
            if (countryAliases[alias] === countryName) {
                countryName = alias;
                break;
            }
        }
    
        const mappedContinent = countryToContinent[countryName];
        return continent === "world" || mappedContinent === continent;
    });
    

    geoLayer = L.geoJSON({ type: "FeatureCollection", features: filteredFeatures }, {
        style: feature => {
            let countryName = feature.properties.name;
            for (let alias in countryAliases) {
                if (countryAliases[alias] === countryName) {
                    countryName = alias;
                    break;
                }
            }
            const hdi = hdiDataByYear[year]?.[countryName]?.hdi;
            return {
                fillColor: getColor(hdi),
                weight: 1,
                color: 'white',
                fillOpacity: 0.7
            };
        },
        onEachFeature: (feature, layer) => {
            let countryName = feature.properties.name;
            for (let alias in countryAliases) {
                if (countryAliases[alias] === countryName) {
                    countryName = alias;
                    break;
                }
            }
            const data = hdiDataByYear[year]?.[countryName];
            const hdi = data?.hdi;
            const gni = data?.gnipc;
            const eys = data?.eys;
            const mys = data?.mys;
            const le = data?.le;

            layer.bindPopup(`
                <strong>${feature.properties.name}</strong><br>
                HDI (${year}) : ${hdi ? hdi.toFixed(3) : "Donnée non disponible"}<br>
                Revenu/hab. : ${gni ? gni.toLocaleString() + " $ PPP" : "Donnée non disponible"}<br>
                Scolarité attendue : ${eys ? eys.toFixed(1) + " ans" : "Donnée non disponible"}<br>
                Scolarité moyenne : ${mys ? mys.toFixed(1) + " ans" : "Donnée non disponible"}<br>
                Espérance de vie : ${le ? le.toFixed(1) + " ans" : "Donnée non disponible"}
            `);

            layer.on({
                mouseover: function (e) {
                    const layer = e.target;
                    layer.setStyle({
                        weight: 3,
                        color: '#000',
                        fillOpacity: 0.9
                    });
                    layer.bringToFront();
                },
                mouseout: function (e) {
                    geoLayer.resetStyle(e.target);
                }
            });
        }
    }).addTo(map);
}

function setupSlider() {
    const slider = document.getElementById("year-slider");
    const label = document.getElementById("selected-year");

    const years = Array.from(availableYears).sort((a, b) => a - b);
    slider.min = years[0];
    slider.max = years[years.length - 1];
    slider.value = slider.max;
    label.textContent = slider.value;

    slider.addEventListener("input", () => {
        label.textContent = slider.value;
        drawMap(document.getElementById("continent-selector").value);
    });
    let intervalId = null;
const playButton = document.getElementById("play-button");

playButton.addEventListener("click", () => {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        playButton.textContent = "▶️ Lecture";
    } else {
        let currentYear = parseInt(slider.value);
        const maxYear = parseInt(slider.max);
        intervalId = setInterval(() => {
            if (currentYear > maxYear) {
                clearInterval(intervalId);
                intervalId = null;
                playButton.textContent = "▶️ Lecture";
                return;
            }

            slider.value = currentYear;
            label.textContent = currentYear;
            geoLayer.setStyle(feature => {
                let countryName = feature.properties.name;
                for (let alias in countryAliases) {
                    if (countryAliases[alias] === countryName) {
                        countryName = alias;
                        break;
                    }
                }
                const hdi = hdiDataByYear[currentYear]?.[countryName]?.hdi;
                return {
                    fillColor: getColor(hdi),
                    weight: 1,
                    color: 'white',
                    fillOpacity: 0.7
                };
            });

            geoLayer.eachLayer(layer => {
                let countryName = layer.feature.properties.name;
                for (let alias in countryAliases) {
                    if (countryAliases[alias] === countryName) {
                        countryName = alias;
                        break;
                    }
                }
                const data = hdiDataByYear[currentYear]?.[countryName];
                const hdi = data?.hdi;
                const gni = data?.gnipc;
                const eys = data?.eys;
                const mys = data?.mys;
                const le = data?.le;

                layer.bindPopup(`
                    <strong>${layer.feature.properties.name}</strong><br>
                    HDI (${currentYear}) : ${hdi ? hdi.toFixed(3) : "Donnée non disponible"}<br>
                    Revenu/hab. : ${gni ? gni.toLocaleString() + " $ PPP" : "Donnée non disponible"}<br>
                    Scolarité attendue : ${eys ? eys.toFixed(1) + " ans" : "Donnée non disponible"}<br>
                    Scolarité moyenne : ${mys ? mys.toFixed(1) + " ans" : "Donnée non disponible"}<br>
                    Espérance de vie : ${le ? le.toFixed(1) + " ans" : "Donnée non disponible"}
                `);
            });

            currentYear++;
        }, 200);

        playButton.textContent = "⏸ Pause";
    }
});
}

function setupContinentFilter() {
    const selector = document.getElementById("continent-selector");
    selector.addEventListener("change", () => {
        const selectedContinent = selector.value;
        drawMap(selectedContinent);

        if (selectedContinent === "world") {
            map.setView([20, 0], 2); // vue globale
            return;
        }

        // Récupérer les features du continent
        const filteredFeatures = allGeoData.features.filter(feature => {
            let countryName = feature.properties.name;
            for (let alias in countryAliases) {
                if (countryAliases[alias] === countryName) {
                    countryName = alias;
                    break;
                }
            }
            return countryToContinent[countryName] === selectedContinent;
        });

        if (filteredFeatures.length > 0) {
            const group = L.featureGroup(filteredFeatures.map(f =>
                L.geoJSON(f)
            ));
            map.fitBounds(group.getBounds().pad(0.2));
        }
    });
}


const legend = L.control({ position: 'bottomright' });
legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'info legend');
    const grades = [0, 0.25, 0.5, 0.75, 1];
    div.innerHTML += "<strong>Échelle HDI</strong><br>";
    for (let i = 0; i < grades.length - 1; i++) {
        const color = getColor((grades[i] + grades[i + 1]) / 2);
        div.innerHTML += `<i style="background:${color};width:18px;height:18px;float:left;margin-right:5px;opacity:0.8;"></i> ${grades[i]} - ${grades[i + 1]}<br>`;
    }
    div.innerHTML += `<i style="background:#666;width:18px;height:18px;float:left;margin-right:5px;opacity:0.8;"></i> Données non disponibles<br>`;
    return div;
};
legend.addTo(map);

document.getElementById("fullscreen-toggle").addEventListener("click", () => {
    const mapContainer = document.getElementById("map-card-container");

    if (!document.fullscreenElement) {
        mapContainer.requestFullscreen().catch(err => {
            alert(`Erreur de passage en plein écran : ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
});

document.getElementById("export-button").addEventListener("click", () => {
    const year = document.getElementById("year-slider").value;

    const mapContainer = document.getElementById("map-card-container");

    // Attendre un court instant avant capture (par précaution visuelle)
    setTimeout(() => {
        html2canvas(mapContainer, {
            useCORS: true,
            allowTaint: true,
            scale: 2,
            windowWidth: mapContainer.scrollWidth,
            windowHeight: mapContainer.scrollHeight
        }).then(canvas => {
            const link = document.createElement("a");
            link.download = `carte-hdi-${year}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
        });
    }, 200);
});


initMap();