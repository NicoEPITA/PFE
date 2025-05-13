// script.js

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
let mentalDataByYear = {};
let availableYears = new Set();

const colorByTrouble = {
    depression: '#e41a1c',
    anxiety: '#377eb8',
    bipolar: '#984ea3',
    schizophrenia: '#ff7f00',
    eating: '#4daf4a'
};

const indicatorFullLabel = {
    depression: 'Troubles dépressifs',
    anxiety: 'Troubles anxieux',
    bipolar: 'Troubles bipolaires',
    schizophrenia: 'Schizophrénie',
    eating: 'Troubles alimentaires'
};

const mentalLayers = {
    depression: L.layerGroup().addTo(map),
    anxiety: L.layerGroup().addTo(map),
    bipolar: L.layerGroup().addTo(map),
    schizophrenia: L.layerGroup().addTo(map),
    eating: L.layerGroup().addTo(map)
};

const countryAliases = {
    "United States": "United States of America",
    "Congo (Democratic Republic of the)": "Democratic Republic of the Congo",
    "Czechia": "Czech Republic",
    "Russian Federation": "Russia",
    "Korea (Republic of)": "South Korea",
    "Democratic People's Republic of Korea": "North Korea",
    "Syrian Arab Republic": "Syria",
    "Iran (Islamic Republic of)": "Iran",
    "Venezuela (Bolivarian Republic of)": "Venezuela",
    "Viet Nam": "Vietnam",
    "Lao People's Democratic Republic": "Laos",
    "Côte d'Ivoire": "Ivory Coast",
    "Tanzania (United Republic of)": "United Republic of Tanzania",
    "Bolivia (Plurinational State of)": "Bolivia",
    "Brunei": "Brunei Darussalam",
    "Moldova (Republic of)": "Moldova",
    "Palestine": "State of Palestine",
    "Micronesia": "Micronesia (Federated States of)",
    "Serbia": "Republic of Serbia",
    "Guinea-Bissau": "Guinea Bissau"
};

function getColor(hdi) {
    if (isNaN(hdi)) return '#666';
    const red = hdi < 0.5 ? 220 : Math.round(220 - (hdi - 0.5) * 2 * 220);
    const green = hdi > 0.5 ? 180 : Math.round(hdi * 2 * 180);
    const blue = hdi > 0.5 ? Math.round((hdi - 0.5) * 2 * 120) : 0;
    return `rgb(${red},${green},${blue})`;
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

        if (!country || indicator !== 'hdi' || isNaN(year) || isNaN(value)) continue;

        if (!hdiDataByYear[year]) hdiDataByYear[year] = {};
        hdiDataByYear[year][country] = value;
        availableYears.add(year);
    }
}

async function loadMentalHealthData() {
    const res = await fetch('mental-illnesses-prevalence.csv');
    const text = await res.text();
    const lines = text.split('\n');
    const header = lines[0].split(',');

    const yearCol = header.indexOf('Year');
    const countryCol = header.indexOf('Entity');
    const keys = {
        depression: 'Depressive disorders',
        anxiety: 'Anxiety disorders',
        bipolar: 'Bipolar disorders',
        schizophrenia: 'Schizophrenia disorders',
        eating: 'Eating disorders'
    };

    const colsMap = {};
    for (let key in keys) {
        colsMap[key] = header.findIndex(h => h.startsWith(keys[key]));
    }

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const year = parseInt(cols[yearCol]);
        const country = cols[countryCol]?.trim();
        if (!country || isNaN(year)) continue;

        if (!mentalDataByYear[year]) mentalDataByYear[year] = {};

        mentalDataByYear[year][country] = {};
        for (let key in colsMap) {
            const val = parseFloat(cols[colsMap[key]]);
            mentalDataByYear[year][country][key] = !isNaN(val) ? val : null;
        }
    }
}

function drawHDIMap(year, continent = 'world') {
    if (geoLayer) map.removeLayer(geoLayer);

    const filtered = allGeoData.features.filter(feature => {
        let name = feature.properties.name;
        for (let alias in countryAliases) if (countryAliases[alias] === name) name = alias;
        if (continent === 'world') return true;
        return countryToContinent[name] === continent;
    });

    geoLayer = L.geoJSON({ type: "FeatureCollection", features: filtered }, {
        style: feature => {
            let name = feature.properties.name;
            for (let alias in countryAliases) if (countryAliases[alias] === name) name = alias;
            const hdi = hdiDataByYear[year]?.[name];
            return {
                fillColor: getColor(hdi),
                weight: 1,
                color: 'white',
                fillOpacity: 0.7
            };
        },
        onEachFeature: function (feature, layer) {
            let name = feature.properties.name;
            for (let alias in countryAliases) if (countryAliases[alias] === name) name = alias;
            const hdi = hdiDataByYear[year]?.[name];
            layer.bindPopup(`<strong>${name}</strong><br>HDI (${year}) : ${hdi ? hdi.toFixed(3) : "Donnée non disponible"}`);
            layer.on({
    mouseover: function (e) {
        const layer = e.target;
        layer.setStyle({ weight: 3, color: '#000', fillOpacity: 0.9 });
        if (layer._path) layer._path.setAttribute('pointer-events', 'none');
    },
    mouseout: function (e) {
        geoLayer.resetStyle(e.target);
        if (e.target._path) e.target._path.setAttribute('pointer-events', 'auto');
    }
});
        }
    }).addTo(map);
}

function drawMentalLayers(year, continent = 'world') {
    Object.values(mentalLayers).forEach(layer => layer.clearLayers());
    const toggled = [...document.querySelectorAll('.mental-toggle:checked')].map(e => e.value);

    const filtered = allGeoData.features.filter(feature => {
        let name = feature.properties.name;
        for (let alias in countryAliases) if (countryAliases[alias] === name) name = alias;
        if (continent === 'world') return true;
        return countryToContinent[name] === continent;
    });

    filtered.forEach(f => {
        let name = f.properties.name;
        for (let alias in countryAliases) if (countryAliases[alias] === name) name = alias;
        const coords = L.latLngBounds(L.geoJSON(f).getBounds()).getCenter();
        const data = mentalDataByYear[year]?.[name];
        if (!data) return;

        toggled.forEach(trouble => {
            const val = parseFloat(data[trouble]);
            if (isNaN(val)) return;
            const radius = Math.sqrt(val) * 30000;
            L.circle(coords, {
                radius,
                color: colorByTrouble[trouble],
                fillColor: colorByTrouble[trouble],
                fillOpacity: 0.5,
                weight: 1
            }).bindPopup(`<strong>${name}</strong><br>${indicatorFullLabel[trouble]} : ${val.toFixed(2)} %`).addTo(mentalLayers[trouble]);
        });
    });
}

async function initMap() {
    await loadHDIData();
    await loadMentalHealthData();
    allGeoData = await fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
        .then(res => res.json());

    setupSlider();
    setupContinentSelector();
    drawHDIMap(document.getElementById("year-slider").value);
    drawMentalLayers(document.getElementById("year-slider").value);

    document.querySelectorAll('.mental-toggle').forEach(el => {
        el.addEventListener('change', () => {
            const year = parseInt(document.getElementById("year-slider").value);
            drawMentalLayers(year, document.getElementById("continent-selector").value);
        });
    });
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
        drawHDIMap(parseInt(slider.value), document.getElementById("continent-selector").value);
        drawMentalLayers(parseInt(slider.value), document.getElementById("continent-selector").value);
    });
}

function setupContinentSelector() {
    const selector = document.getElementById("continent-selector");
    selector.addEventListener("change", () => {
        const year = parseInt(document.getElementById("year-slider").value);
        drawHDIMap(year, selector.value);
        drawMentalLayers(year, selector.value);
    });
}

initMap();
