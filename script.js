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

    const geoData = await fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
        .then(res => res.json());

    function style(feature) {
        const year = parseInt(document.getElementById("year-slider").value);
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
    }

    function onEachFeature(feature, layer) {
        const year = parseInt(document.getElementById("year-slider").value);
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
            Revenu/hab. : ${gni ? gni.toLocaleString() + "$ PPA" : "Donnée non disponible"}<br>
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

    geoLayer = L.geoJSON(geoData, {
        style: style,
        onEachFeature: onEachFeature
    }).addTo(map);

    setupSlider();
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

        geoLayer.setStyle(feature => {
            let countryName = feature.properties.name;
            for (let alias in countryAliases) {
                if (countryAliases[alias] === countryName) {
                    countryName = alias;
                    break;
                }
            }
            const hdi = hdiDataByYear[slider.value]?.[countryName]?.hdi;
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

            const data = hdiDataByYear[slider.value]?.[countryName];
            const hdi = data?.hdi;
            const gni = data?.gnipc;
            const eys = data?.eys;
            const mys = data?.mys;
            const le = data?.le;

            layer.bindPopup(`
                <strong>${layer.feature.properties.name}</strong><br>
                HDI (${slider.value}) : ${hdi ? hdi.toFixed(3) : "Donnée non disponible"}<br>
                Revenu/hab. : ${gni ? gni.toLocaleString() + "$ PPA" : "Donnée non disponible"}<br>
                Scolarité attendue : ${eys ? eys.toFixed(1) + " ans" : "Donnée non disponible"}<br>
                Scolarité moyenne : ${mys ? mys.toFixed(1) + " ans" : "Donnée non disponible"}<br>
                Espérance de vie : ${le ? le.toFixed(1) + " ans" : "Donnée non disponible"}

            `);
        });
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

initMap();
