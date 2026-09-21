const CENTER = [-76.53536, 3.43428];
const state = {
  demo: true,
  buildings: true,
  rings: true,
  market: true,
  dane: null,
  animationTime: 0
};

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  center: CENTER,
  zoom: 15.7,
  pitch: 60,
  bearing: -24,
  antialias: true,
  maxPitch: 80
});
map.addControl(new maplibregl.NavigationControl({visualizePitch:true}), 'top-right');

const overlay = new deck.MapboxOverlay({interleaved: true, layers: []});
map.addControl(overlay);

const ui = {
  tooltip: document.getElementById('tooltip'),
  loader: document.getElementById('loader'),
  daneStatus: document.getElementById('daneStatus'),
  people: document.getElementById('people'),
  households: document.getElementById('households'),
  homes: document.getElementById('homes'),
  maleBar: document.getElementById('maleBar'),
  femaleBar: document.getElementById('femaleBar'),
  maleLabel: document.getElementById('maleLabel'),
  femaleLabel: document.getElementById('femaleLabel'),
  genderTotal: document.getElementById('genderTotal'),
  ageBars: Array.from(document.querySelectorAll('#ageBars > div')),
  panel: document.getElementById('panel'),
  panelToggle: document.getElementById('panelToggle')
};

function fmt(n){
  if(n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('es-CO');
}
function sum(obj, keys){
  return keys.reduce((a,k) => a + Number(obj[k] || 0), 0);
}
function colorFor(v, max){
  const t = max > 0 ? Math.min(1, v / max) : 0;
  if (t < .28) return [64,109,90,145];
  if (t < .55) return [130,214,170,165];
  if (t < .78) return [255,198,107,180];
  return [255,140,88,195];
}

function getProps(p = {}){
  const personas = Number(p.POBLACION || p.personas || p.total_personas || 0);
  const hogares = Number(p.HOGARES || p.hogares || 0);
  const viviendas = Number(p.VIVIENDAS || p.viviendas || 0);
  const hombres = Number(p.HOMBRES || p.hombres || p.HOMBRE || 0);
  const mujeres = Number(p.MUJERES || p.mujeres || p.MUJER || 0);
  const age0_19 = sum(p, ['EDAD_0_4','EDAD_5_9','EDAD_10_14','EDAD_15_19','e_0_4','e_5_9','e_10_14','e_15_19']);
  const age20_39 = sum(p, ['EDAD_20_24','EDAD_25_29','EDAD_30_34','EDAD_35_39','e_20_24','e_25_29','e_30_34','e_35_39']);
  const age40_59 = sum(p, ['EDAD_40_44','EDAD_45_49','EDAD_50_54','EDAD_55_59','e_40_44','e_45_49','e_50_54','e_55_59']);
  const age60Mas = sum(p, ['EDAD_60_64','EDAD_65_69','EDAD_70_74','EDAD_75_79','EDAD_80_Y_MAS','e_60_64','e_65_69','e_70_74','e_75_79','e_80_y_mas']);
  return {personas, hogares, viviendas, hombres, mujeres, age0_19, age20_39, age40_59, age60Mas};
}

function buildLayers(t){
  const layers = [];
  const pulse = 1 + Math.sin(t/550) * .08;

  if(state.demo && state.dane?.features?.length){
    const max = Math.max(...state.dane.features.map(f => getProps(f.properties).personas), 1);
    layers.push(new deck.GeoJsonLayer({
      id: 'dane-layer',
      data: state.dane,
      pickable: true,
      filled: true,
      stroked: true,
      extruded: true,
      getFillColor: f => colorFor(getProps(f.properties).personas, max),
      getLineColor: [225,242,231,85],
      getLineWidth: 1,
      lineWidthUnits: 'pixels',
      getElevation: f => {
        const p = getProps(f.properties).personas;
        return Math.min(350, 14 + Math.sqrt(Math.max(0,p)) * 3.2);
      },
      material: {ambient:0.45,diffuse:0.65,shininess:32,specularColor:[118,160,140]},
      onHover: ({object, x, y}) => {
        if(!object){ ui.tooltip.style.display='none'; return; }
        const p = getProps(object.properties);
        ui.tooltip.innerHTML = `
          <strong>Manzana censal</strong>
          <span>Personas: ${fmt(p.personas)}</span>
          <span>Hogares: ${fmt(p.hogares)}</span>
          <span>Viviendas: ${fmt(p.viviendas)}</span>`;
        ui.tooltip.style.left = `${x+14}px`;
        ui.tooltip.style.top = `${y+14}px`;
        ui.tooltip.style.display = 'block';
      }
    }));
  }

  if(state.rings){
    layers.push(new deck.ScatterplotLayer({
      id:'rings',
      data:[
        {position:CENTER, radius:250, alpha:110},
        {position:CENTER, radius:650, alpha:66}
      ],
      pickable:false,
      filled:false,
      stroked:true,
      radiusUnits:'meters',
      lineWidthUnits:'pixels',
      getPosition:d=>d.position,
      getRadius:d=>d.radius,
      getLineColor:d=>[255,198,107,d.alpha],
      getLineWidth:d=>d.radius===250?2.2:1.2
    }));
  }

  if(state.market){
    layers.push(new deck.ColumnLayer({
      id:'market-column',
      data:[{position:CENTER}],
      diskResolution:48,
      radius:34 * pulse,
      elevationScale: 1,
      extruded: true,
      pickable: true,
      getPosition:d=>d.position,
      getElevation:125,
      getFillColor:[255,178,82,150],
      getLineColor:[255,230,188,225],
      getLineWidth:1.5,
      lineWidthUnits:'pixels',
      onHover: ({object, x, y}) => {
        if(!object){ ui.tooltip.style.display='none'; return; }
        ui.tooltip.innerHTML = `
          <strong>Galería Alameda</strong>
          <span>Mercado tradicional de Cali</span>
          <span>550+ locales</span>
          <span>10.000+ visitantes semanales</span>`;
        ui.tooltip.style.left = `${x+14}px`;
        ui.tooltip.style.top = `${y+14}px`;
        ui.tooltip.style.display = 'block';
      }
    }));

    layers.push(new deck.ScatterplotLayer({
      id:'market-pulse',
      data:[{position:CENTER}],
      pickable:false,
      filled:true,
      stroked:true,
      radiusUnits:'meters',
      getPosition:d=>d.position,
      getRadius:80 * pulse,
      getFillColor:[255,188,98,16],
      getLineColor:[255,208,117,94],
      getLineWidth:2,
      lineWidthUnits:'pixels'
    }));

    layers.push(new deck.TextLayer({
      id:'market-label',
      data:[{position:CENTER,text:'GALERÍA ALAMEDA'}],
      getPosition:d=>d.position,
      getText:d=>d.text,
      getSize:15,
      sizeUnits:'pixels',
      getColor:[255,246,222,245],
      getPixelOffset:[0,-42],
      fontFamily:'Manrope, sans-serif',
      fontWeight:800,
      outlineWidth:4,
      outlineColor:[8,16,13,220],
      billboard:true
    }));
  }

  return layers;
}

function animate(){
  overlay.setProps({layers: buildLayers(performance.now())});
  requestAnimationFrame(animate);
}

function updateDashboard(){
  if(!state.dane?.features?.length) return;
  const totals = state.dane.features.reduce((acc, f) => {
    const p = getProps(f.properties);
    acc.personas += p.personas;
    acc.hogares += p.hogares;
    acc.viviendas += p.viviendas;
    acc.hombres += p.hombres;
    acc.mujeres += p.mujeres;
    acc.a0 += p.age0_19;
    acc.a1 += p.age20_39;
    acc.a2 += p.age40_59;
    acc.a3 += p.age60Mas;
    return acc;
  }, {personas:0,hogares:0,viviendas:0,hombres:0,mujeres:0,a0:0,a1:0,a2:0,a3:0});

  ui.people.textContent = fmt(totals.personas);
  ui.households.textContent = fmt(totals.hogares);
  ui.homes.textContent = fmt(totals.viviendas);

  const genderSum = Math.max(1, totals.hombres + totals.mujeres);
  const malePct = totals.hombres / genderSum * 100;
  const femalePct = totals.mujeres / genderSum * 100;
  ui.maleBar.style.width = `${malePct}%`;
  ui.femaleBar.style.width = `${femalePct}%`;
  ui.maleLabel.textContent = `Hombres ${malePct.toFixed(1)}%`;
  ui.femaleLabel.textContent = `Mujeres ${femalePct.toFixed(1)}%`;
  ui.genderTotal.textContent = `${fmt(totals.hombres + totals.mujeres)} personas`;

  const ages = [totals.a0, totals.a1, totals.a2, totals.a3];
  const maxAge = Math.max(...ages, 1);
  ui.ageBars.forEach((row, i) => {
    row.querySelector('b').style.width = `${ages[i] / maxAge * 100}%`;
    row.querySelector('em').textContent = fmt(ages[i]);
  });
}

async function queryLayer(layerId){
  const d = 0.012;
  const envelope = [CENTER[0]-d, CENTER[1]-d, CENTER[0]+d, CENTER[1]+d].join(',');
  const base = `https://geoportal.dane.gov.co/mparcgis/rest/services/Grilla_DANE/Serv_Grilla_DANE/MapServer/${layerId}/query`;
  const params = new URLSearchParams({
    where:'1=1',
    geometry:envelope,
    geometryType:'esriGeometryEnvelope',
    inSR:'4326',
    spatialRel:'esriSpatialRelIntersects',
    outFields:'*',
    returnGeometry:'true',
    outSR:'4326',
    f:'geojson'
  });
  const res = await fetch(`${base}?${params.toString()}`);
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if(!json?.features?.length) throw new Error('sin datos');
  const hasPeople = json.features.some(f => getProps(f.properties).personas > 0);
  if(!hasPeople) throw new Error('sin población');
  return json;
}

async function loadDane(){
  const candidates = [5,4,3,2,1,0];
  for(const layerId of candidates){
    try{
      const data = await queryLayer(layerId);
      state.dane = data;
      updateDashboard();
      ui.daneStatus.textContent = 'Capa oficial cargada. Las cifras corresponden a las manzanas censales que intersectan el entorno consultado.';
      ui.daneStatus.className = 'status ok';
      return;
    }catch(err){
      // continue
    }
  }
  ui.daneStatus.textContent = 'No fue posible consultar el servicio DANE en este momento. El mapa sigue funcionando y puedes recargar para reintentar.';
  ui.daneStatus.className = 'status error';
}

function add3DBuildings(){
  const style = map.getStyle();
  const sources = style.sources || {};
  const layers = style.layers || [];
  const sourceName = Object.keys(sources).find(name => sources[name]?.type === 'vector');
  if(!sourceName) return;
  const beforeId = layers.find(l => l.type === 'symbol')?.id;
  try{
    map.addLayer({
      id:'custom-buildings-3d',
      source:sourceName,
      'source-layer':'building',
      type:'fill-extrusion',
      minzoom:14,
      paint:{
        'fill-extrusion-color':[
          'interpolate',['linear'],['coalesce',['get','render_height'],['get','height'],8],
          0,'#17241f',
          16,'#21342d',
          35,'#31483f',
          70,'#4a6154'
        ],
        'fill-extrusion-height':['coalesce',['get','render_height'],['get','height'],8],
        'fill-extrusion-base':['coalesce',['get','render_min_height'],['get','min_height'],0],
        'fill-extrusion-opacity':0.88
      }
    }, beforeId);
  }catch(e){
    console.warn('No fue posible añadir edificios 3D', e);
  }
}

function wireControls(){
  document.getElementById('toggleDemo').addEventListener('change', e => state.demo = e.target.checked);
  document.getElementById('toggleBuildings').addEventListener('change', e => {
    state.buildings = e.target.checked;
    if(map.getLayer('custom-buildings-3d')) map.setLayoutProperty('custom-buildings-3d', 'visibility', state.buildings ? 'visible' : 'none');
  });
  document.getElementById('toggleRings').addEventListener('change', e => state.rings = e.target.checked);
  document.getElementById('toggleMarket').addEventListener('change', e => state.market = e.target.checked);
  document.getElementById('resetView').addEventListener('click', () => map.flyTo({center:CENTER,zoom:15.7,pitch:60,bearing:-24,duration:1200}));
  document.getElementById('topView').addEventListener('click', () => map.flyTo({center:CENTER,zoom:16.2,pitch:0,bearing:0,duration:1200}));
  ui.panelToggle.addEventListener('click', () => ui.panel.classList.toggle('open'));
}

map.on('load', async () => {
  add3DBuildings();
  wireControls();
  animate();
  await loadDane();
  setTimeout(() => ui.loader.classList.add('hide'), 700);
});

map.on('click', () => ui.tooltip.style.display = 'none');
