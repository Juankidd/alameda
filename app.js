import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const CENTER = [-76.53536, 3.43428];
const MARKET_POLYGON = [[
  [-76.53583,3.43464],[-76.53491,3.43459],[-76.53491,3.43393],[-76.53582,3.43397]
]];

const state = { demo:true, buildings:true, rings:true, market:true, dane:null };

const map = new maplibregl.Map({
  container:'map',
  style:'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  center:[CENTER[0]+0.0025,CENTER[1]-0.002],
  zoom:13.9,
  pitch:28,
  bearing:-48,
  antialias:true,
  maxPitch:80
});
map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');

const overlay = new deck.MapboxOverlay({
  interleaved:true,
  layers:[],
  getCursor:({isHovering})=>isHovering?'pointer':'grab'
});
map.addControl(overlay);

const ui = {
  tooltip:document.getElementById('tooltip'), loader:document.getElementById('loader'),
  daneStatus:document.getElementById('daneStatus'), people:document.getElementById('people'),
  households:document.getElementById('households'), homes:document.getElementById('homes'),
  maleBar:document.getElementById('maleBar'), femaleBar:document.getElementById('femaleBar'),
  maleLabel:document.getElementById('maleLabel'), femaleLabel:document.getElementById('femaleLabel'),
  genderTotal:document.getElementById('genderTotal'), ageBars:Array.from(document.querySelectorAll('#ageBars > div')),
  panel:document.getElementById('panel'), panelToggle:document.getElementById('panelToggle'),
  modelViewer:document.getElementById('modelViewer'), modelStage:document.getElementById('modelStage'),
  closeModel:document.getElementById('closeModel'), returnMap:document.getElementById('returnMap'),
  toggleRotate:document.getElementById('toggleRotate'), openModelHero:document.getElementById('openModelHero')
};

const fmt=n=>(n===null||n===undefined||Number.isNaN(Number(n)))?'—':Number(n).toLocaleString('es-CO');
const sum=(obj,keys)=>keys.reduce((a,k)=>a+Number(obj[k]||0),0);

function colorFor(v,max){
  const t=max>0?Math.min(1,v/max):0;
  if(t<.28)return[64,109,90,145];
  if(t<.55)return[130,214,170,165];
  if(t<.78)return[255,198,107,180];
  return[255,140,88,195];
}

function getProps(p={}){
  const personas=Number(p.POBLACION||p.personas||p.total_personas||0);
  const hogares=Number(p.HOGARES||p.hogares||0);
  const viviendas=Number(p.VIVIENDAS||p.viviendas||0);
  const hombres=Number(p.HOMBRES||p.hombres||p.HOMBRE||0);
  const mujeres=Number(p.MUJERES||p.mujeres||p.MUJER||0);
  const age0_19=sum(p,['EDAD_0_4','EDAD_5_9','EDAD_10_14','EDAD_15_19','e_0_4','e_5_9','e_10_14','e_15_19']);
  const age20_39=sum(p,['EDAD_20_24','EDAD_25_29','EDAD_30_34','EDAD_35_39','e_20_24','e_25_29','e_30_34','e_35_39']);
  const age40_59=sum(p,['EDAD_40_44','EDAD_45_49','EDAD_50_54','EDAD_55_59','e_40_44','e_45_49','e_50_54','e_55_59']);
  const age60Mas=sum(p,['EDAD_60_64','EDAD_65_69','EDAD_70_74','EDAD_75_79','EDAD_80_Y_MAS','e_60_64','e_65_69','e_70_74','e_75_79','e_80_y_mas']);
  return{personas,hogares,viviendas,hombres,mujeres,age0_19,age20_39,age40_59,age60Mas};
}

let marketOpenPending=false;
function requestOpenMarket(){
  if(marketOpenPending||ui.modelViewer.classList.contains('open'))return;
  marketOpenPending=true;
  ui.tooltip.style.display='none';
  map.flyTo({center:CENTER,zoom:17.25,pitch:67,bearing:-18,duration:850,essential:true});
  setTimeout(()=>{ marketOpenPending=false; openMarketViewer(); },620);
}

function buildLayers(t){
  const layers=[];
  const pulse=1+Math.sin(t/520)*.09;

  if(state.demo&&state.dane?.features?.length){
    const max=Math.max(...state.dane.features.map(f=>getProps(f.properties).personas),1);
    layers.push(new deck.GeoJsonLayer({
      id:'dane-layer',data:state.dane,pickable:true,filled:true,stroked:true,extruded:true,
      getFillColor:f=>colorFor(getProps(f.properties).personas,max),getLineColor:[225,242,231,80],
      getLineWidth:1,lineWidthUnits:'pixels',
      getElevation:f=>Math.min(340,14+Math.sqrt(Math.max(0,getProps(f.properties).personas))*3.1),
      material:{ambient:.45,diffuse:.65,shininess:32,specularColor:[118,160,140]},
      onHover:({object,x,y})=>{
        if(!object){ui.tooltip.style.display='none';return;}
        const p=getProps(object.properties);
        ui.tooltip.innerHTML=`<strong>Manzana censal</strong><span>Personas: ${fmt(p.personas)}</span><span>Hogares: ${fmt(p.hogares)}</span><span>Viviendas: ${fmt(p.viviendas)}</span>`;
        ui.tooltip.style.left=`${x+14}px`;ui.tooltip.style.top=`${y+14}px`;ui.tooltip.style.display='block';
      }
    }));
  }

  if(state.rings){
    layers.push(new deck.ScatterplotLayer({
      id:'rings',data:[{position:CENTER,radius:250,alpha:110},{position:CENTER,radius:650,alpha:64}],
      pickable:false,filled:false,stroked:true,radiusUnits:'meters',lineWidthUnits:'pixels',
      getPosition:d=>d.position,getRadius:d=>d.radius,getLineColor:d=>[255,198,107,d.alpha],getLineWidth:d=>d.radius===250?2.1:1.1
    }));
  }

  if(state.market){
    layers.push(new deck.PolygonLayer({
      id:'market-footprint',data:[{polygon:MARKET_POLYGON[0]}],pickable:true,stroked:true,filled:true,
      getPolygon:d=>d.polygon,getFillColor:[255,178,82,44],getLineColor:[255,215,151,220],
      getLineWidth:3,lineWidthUnits:'pixels',onClick:requestOpenMarket
    }));
    layers.push(new deck.ColumnLayer({
      id:'market-column',data:[{position:CENTER}],diskResolution:48,radius:32*pulse,elevationScale:1,extruded:true,pickable:true,
      getPosition:d=>d.position,getElevation:115,getFillColor:[255,178,82,145],getLineColor:[255,230,188,230],getLineWidth:1.5,lineWidthUnits:'pixels',
      onClick:requestOpenMarket,
      onHover:({object,x,y})=>{
        if(!object){ui.tooltip.style.display='none';return;}
        ui.tooltip.innerHTML='<strong>Galería Alameda</strong><span>Haz clic para abrir el modelo 3D</span><span>Arrastra el mapa para explorar el entorno</span>';
        ui.tooltip.style.left=`${x+14}px`;ui.tooltip.style.top=`${y+14}px`;ui.tooltip.style.display='block';
      }
    }));
    layers.push(new deck.ScatterplotLayer({
      id:'market-pulse',data:[{position:CENTER}],pickable:false,filled:true,stroked:true,radiusUnits:'meters',
      getPosition:d=>d.position,getRadius:78*pulse,getFillColor:[255,188,98,18],getLineColor:[255,208,117,95],getLineWidth:2,lineWidthUnits:'pixels'
    }));
    layers.push(new deck.TextLayer({
      id:'market-label',data:[{position:CENTER,text:'GALERÍA ALAMEDA · CLIC PARA EXPLORAR'}],pickable:true,
      getPosition:d=>d.position,getText:d=>d.text,getSize:14,sizeUnits:'pixels',getColor:[255,246,222,245],
      getPixelOffset:[0,-44],fontFamily:'Manrope, sans-serif',fontWeight:800,outlineWidth:4,outlineColor:[8,16,13,220],billboard:true,
      onClick:requestOpenMarket
    }));
  }
  return layers;
}

function animateMap(){overlay.setProps({layers:buildLayers(performance.now())});requestAnimationFrame(animateMap);}

function updateDashboard(){
  if(!state.dane?.features?.length)return;
  const t=state.dane.features.reduce((a,f)=>{const p=getProps(f.properties);a.personas+=p.personas;a.hogares+=p.hogares;a.viviendas+=p.viviendas;a.hombres+=p.hombres;a.mujeres+=p.mujeres;a.a0+=p.age0_19;a.a1+=p.age20_39;a.a2+=p.age40_59;a.a3+=p.age60Mas;return a;},{personas:0,hogares:0,viviendas:0,hombres:0,mujeres:0,a0:0,a1:0,a2:0,a3:0});
  ui.people.textContent=fmt(t.personas);ui.households.textContent=fmt(t.hogares);ui.homes.textContent=fmt(t.viviendas);
  const gs=Math.max(1,t.hombres+t.mujeres),mp=t.hombres/gs*100,fp=t.mujeres/gs*100;
  ui.maleBar.style.width=`${mp}%`;ui.femaleBar.style.width=`${fp}%`;ui.maleLabel.textContent=`Hombres ${mp.toFixed(1)}%`;ui.femaleLabel.textContent=`Mujeres ${fp.toFixed(1)}%`;ui.genderTotal.textContent=`${fmt(t.hombres+t.mujeres)} personas`;
  const ages=[t.a0,t.a1,t.a2,t.a3],mx=Math.max(...ages,1);ui.ageBars.forEach((r,i)=>{r.querySelector('b').style.width=`${ages[i]/mx*100}%`;r.querySelector('em').textContent=fmt(ages[i]);});
}

async function queryLayer(layerId){
  const d=.012,envelope=[CENTER[0]-d,CENTER[1]-d,CENTER[0]+d,CENTER[1]+d].join(',');
  const base=`https://geoportal.dane.gov.co/mparcgis/rest/services/Grilla_DANE/Serv_Grilla_DANE/MapServer/${layerId}/query`;
  const params=new URLSearchParams({where:'1=1',geometry:envelope,geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'*',returnGeometry:'true',outSR:'4326',f:'geojson'});
  const res=await fetch(`${base}?${params}`);if(!res.ok)throw new Error(`HTTP ${res.status}`);const json=await res.json();
  if(!json?.features?.length||!json.features.some(f=>getProps(f.properties).personas>0))throw new Error('sin datos');return json;
}
async function loadDane(){
  for(const id of [5,4,3,2,1,0]){try{state.dane=await queryLayer(id);updateDashboard();ui.daneStatus.textContent='Capa oficial cargada. Las cifras corresponden a las manzanas censales que intersectan el entorno consultado.';ui.daneStatus.className='status ok';return;}catch{}}
  ui.daneStatus.textContent='No fue posible consultar el servicio DANE en este momento. El mapa sigue funcionando y puedes recargar para reintentar.';ui.daneStatus.className='status error';
}

function add3DBuildings(){
  const style=map.getStyle(),sources=style.sources||{},layers=style.layers||{},sourceName=Object.keys(sources).find(n=>sources[n]?.type==='vector');
  if(!sourceName)return;const beforeId=(Array.isArray(layers)?layers:[]).find(l=>l.type==='symbol')?.id;
  try{map.addLayer({id:'custom-buildings-3d',source:sourceName,'source-layer':'building',type:'fill-extrusion',minzoom:14,paint:{'fill-extrusion-color':['interpolate',['linear'],['coalesce',['get','render_height'],['get','height'],8],0,'#17241f',16,'#21342d',35,'#31483f',70,'#4a6154'],'fill-extrusion-height':['coalesce',['get','render_height'],['get','height'],8],'fill-extrusion-base':['coalesce',['get','render_min_height'],['get','min_height'],0],'fill-extrusion-opacity':.88}},beforeId);}catch(e){console.warn('Edificios 3D:',e);}
}

// ---------------- visor 3D conceptual ----------------
let viewer=null;
function box(w,h,d,color,x,y,z,roughness=.72,metalness=.04){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness,metalness}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;
}
function buildTree(group,x,z,s=1){
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.10,.14,.75,10),new THREE.MeshStandardMaterial({color:0x6c4f35,roughness:.9}));trunk.position.set(x,.6,z);trunk.castShadow=true;group.add(trunk);
  const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(.48*s,2),new THREE.MeshStandardMaterial({color:0x4f8d68,roughness:.85}));crown.position.set(x,1.22,z);crown.castShadow=true;group.add(crown);
}
function buildMarketDiorama(scene){
  const g=new THREE.Group();scene.add(g);
  const ground=box(25,.35,19,0x17241f,0,-.2,0);g.add(ground);
  // calles y andenes
  g.add(box(25,.035,2.0,0x2b3330,0,.005,-7.1));g.add(box(25,.035,2.0,0x2b3330,0,.005,7.1));g.add(box(2.2,.035,19,0x2b3330,-9.4,.005,0));g.add(box(2.2,.035,19,0x2b3330,9.4,.005,0));
  g.add(box(15.8,.16,11.3,0xcbbd9c,0,.12,0));
  // cuerpo principal y patios sugeridos
  g.add(box(14.7,2.55,9.9,0xcabf9f,0,1.47,0));
  g.add(box(11.4,1.9,7.0,0x544d3e,0,1.85,0));
  // cubierta de dos aguas
  const roofMat=new THREE.MeshStandardMaterial({color:0xb95f3d,roughness:.68,metalness:.02});
  const roof1=new THREE.Mesh(new THREE.BoxGeometry(7.7,.28,10.5),roofMat);roof1.position.set(-3.45,3.25,0);roof1.rotation.z=-.16;roof1.castShadow=true;g.add(roof1);
  const roof2=roof1.clone();roof2.position.x=3.45;roof2.rotation.z=.16;g.add(roof2);
  // marquesina frontal
  g.add(box(12.4,.18,1.15,0xd6b55d,0,2.45,-5.45,.55,.08));
  for(let i=-5;i<=5;i+=2){g.add(box(.16,2.05,.16,0x564f43,i,1.16,-5.05));}
  // accesos
  for(const x of [-4.2,0,4.2]){g.add(box(2.1,1.65,.12,0x253631,x,1.15,-5.02,.55,.18));}
  // puestos interiores visibles por el frente
  const stallColors=[0xd65f4a,0x4f9f75,0xe1a84f,0x5b83a8];
  for(let x=-5.5,i=0;x<=5.5;x+=2.2,i++){
    g.add(box(1.65,.8,1.35,0x8d7658,x,.7,-3.7));
    g.add(box(1.75,.10,.8,stallColors[i%stallColors.length],x,1.17,-4.2));
    for(let j=0;j<4;j++){
      const produce=new THREE.Mesh(new THREE.SphereGeometry(.10,10,8),new THREE.MeshStandardMaterial({color:[0xe9b44c,0x78a95b,0xd9674b,0x835f49][(i+j)%4],roughness:.9}));
      produce.position.set(x-.45+j*.3,1.16,-3.8);produce.castShadow=true;g.add(produce);
    }
  }
  // edificios del contexto
  const contexts=[[-10.8,0,3.4,3.2],[-10.7,-4.5,3.1,2.4],[-10.6,4.5,3.2,2.8],[10.8,-4.4,3.2,3.2],[10.8,4.3,3.2,2.5]];
  contexts.forEach(([x,z,w,h],i)=>g.add(box(w,h,3.6,i%2?0x24332d:0x2d3b35,x,h/2,z,.9,.02)));
  // árboles y personas
  [[-8,-5.8],[-8,5.8],[8,-5.8],[8,5.8]].forEach(([x,z])=>buildTree(g,x,z,.95));
  for(let i=0;i<14;i++){
    const px=-7+(i%7)*2.25,pz=i<7?-6.1:5.95;
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,.35,8),new THREE.MeshStandardMaterial({color:i%2?0xe1a84f:0x739a88,roughness:.8}));body.position.set(px,.25,pz);g.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.075,8,8),new THREE.MeshStandardMaterial({color:0xc99b7c,roughness:.9}));head.position.set(px,.49,pz);g.add(head);
  }
  return g;
}
function initViewer(){
  if(viewer)return viewer;
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x0a1511,20,42);
  const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(13,10,15);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;ui.modelStage.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xf1ead6,0x18241f,2.0));
  const key=new THREE.DirectionalLight(0xffe2b1,5.2);key.position.set(8,13,8);key.castShadow=true;key.shadow.mapSize.set(2048,2048);scene.add(key);
  const fill=new THREE.DirectionalLight(0x8bbfa8,2.1);fill.position.set(-10,7,-6);scene.add(fill);
  const group=buildMarketDiorama(scene);group.rotation.y=-.35;
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.06;controls.minDistance=9;controls.maxDistance=32;controls.maxPolarAngle=Math.PI*.48;controls.target.set(0,1.2,0);controls.autoRotate=true;controls.autoRotateSpeed=.65;
  let openingAt=0;
  function resize(){const r=ui.modelStage.getBoundingClientRect();const w=Math.max(1,r.width),h=Math.max(1,r.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  const ro=new ResizeObserver(resize);ro.observe(ui.modelStage);resize();
  function loop(){requestAnimationFrame(loop);if(!ui.modelViewer.classList.contains('open'))return;const now=performance.now();if(openingAt){const p=Math.min(1,(now-openingAt)/700),e=1-Math.pow(1-p,3);group.scale.setScalar(.08+.92*e);group.rotation.y=-.85+.5*e;if(p>=1)openingAt=0;}controls.update();renderer.render(scene,camera);}
  loop();
  renderer.domElement.addEventListener('dblclick',()=>{camera.position.set(13,10,15);controls.target.set(0,1.2,0);controls.update();});
  viewer={scene,camera,renderer,controls,group,startOpen(){openingAt=performance.now();group.scale.setScalar(.08);}};return viewer;
}
function openMarketViewer(){
  const v=initViewer();v.startOpen();ui.modelViewer.classList.add('open');ui.modelViewer.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
}
function closeMarketViewer(){ui.modelViewer.classList.remove('open');ui.modelViewer.setAttribute('aria-hidden','true');document.body.style.overflow='';}

function wireControls(){
  document.getElementById('toggleDemo').addEventListener('change',e=>state.demo=e.target.checked);
  document.getElementById('toggleBuildings').addEventListener('change',e=>{state.buildings=e.target.checked;if(map.getLayer('custom-buildings-3d'))map.setLayoutProperty('custom-buildings-3d','visibility',state.buildings?'visible':'none');});
  document.getElementById('toggleRings').addEventListener('change',e=>state.rings=e.target.checked);
  document.getElementById('toggleMarket').addEventListener('change',e=>state.market=e.target.checked);
  document.getElementById('resetView').addEventListener('click',()=>map.flyTo({center:CENTER,zoom:15.7,pitch:60,bearing:-24,duration:1200}));
  document.getElementById('topView').addEventListener('click',()=>map.flyTo({center:CENTER,zoom:16.2,pitch:0,bearing:0,duration:1200}));
  ui.panelToggle.addEventListener('click',()=>ui.panel.classList.toggle('open'));
  ui.openModelHero.addEventListener('click',requestOpenMarket);ui.closeModel.addEventListener('click',closeMarketViewer);ui.returnMap.addEventListener('click',closeMarketViewer);
  ui.modelViewer.addEventListener('click',e=>{if(e.target===ui.modelViewer)closeMarketViewer();});
  ui.toggleRotate.addEventListener('click',()=>{const v=initViewer();v.controls.autoRotate=!v.controls.autoRotate;ui.toggleRotate.setAttribute('aria-pressed',String(v.controls.autoRotate));ui.toggleRotate.textContent=v.controls.autoRotate?'Giro automático':'Giro pausado';});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&ui.modelViewer.classList.contains('open'))closeMarketViewer();});
}

map.on('load',async()=>{
  add3DBuildings();wireControls();animateMap();
  setTimeout(()=>map.flyTo({center:CENTER,zoom:15.7,pitch:60,bearing:-24,duration:2700,essential:true}),350);
  loadDane();setTimeout(()=>ui.loader.classList.add('hide'),650);
});
map.on('click',()=>ui.tooltip.style.display='none');
