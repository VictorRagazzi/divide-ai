import assets from "./generated/leaflet.json";

// No user text is interpolated into this document. Points arrive through a
// validated bridge. Tiles are viewport-only, cached by the browser/WebView.
export const mapHtml = `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https://tile.openstreetmap.org data:; base-uri 'none'; connect-src 'none'">
<style>${assets.css}
html,body,#map{height:100%;width:100%;margin:0;background:#E7EBE4;font-family:system-ui}
.pin{border:0;background:none}.pin span{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);background:#172D20;color:white;border:3px solid white;box-shadow:0 2px 8px #0005;font-weight:800;font-size:16px}.pin b{transform:rotate(45deg)}.pin.destination span{background:#FFFFFF;color:#172D20;border-color:#172D20}
.leaflet-control-zoom a{width:40px;height:40px;line-height:40px}
#status{position:absolute;bottom:10px;left:64px;right:10px;z-index:1000;border-radius:8px;padding:8px;background:#fff;color:#344038;font-size:12px;pointer-events:none}
</style></head><body><div id="map" role="region" aria-label="Mapa de origem A e destino B"></div><div id="status" role="status">Carregando mapa…</div>
<script>/* ${assets.license} */
${assets.js.replace(/<\/script/gi, "<\\/script")}</script>
<script>
(function(){
var map=L.map('map',{zoomControl:false,attributionControl:false,worldCopyJump:true,minZoom:2,maxZoom:19}).setView([-19.932,-43.938],15);
L.control.zoom({position:'bottomleft',zoomInTitle:'Aproximar',zoomOutTitle:'Afastar'}).addTo(map);
var status=document.getElementById('status');
var tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,updateWhenIdle:true,keepBuffer:1}).addTo(map);
tiles.on('loading',function(){status.hidden=false;status.textContent='Carregando mapa…';});
var failed=false;
tiles.on('tileerror',function(){failed=true;status.hidden=false;status.textContent='Mapa indisponível. Confira sua conexão. Você pode buscar a rua ou bairro em Seu caminho.';});
tiles.on('load',function(){status.hidden=!failed;});
tiles.on('loading',function(){failed=false;});
var selected='origin',editable=false,topInset=0,markers={},lastPoints=null,lastInset=null;
function frameMap(){map.invalidateSize();var pins=Object.keys(markers).map(function(key){return markers[key].getLatLng();});if(!pins.length)return;map.fitBounds(pins,{paddingTopLeft:[50,Math.min(topInset+45,Math.max(45,map.getSize().y-100))],paddingBottomRight:[50,50],maxZoom:16,animate:false});}
function send(value){var raw=JSON.stringify(value);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(raw);else window.parent.postMessage(raw,'*');}
function valid(p){return p&&typeof p.latitude==='number'&&isFinite(p.latitude)&&Math.abs(p.latitude)<=85.05112878&&typeof p.longitude==='number'&&isFinite(p.longitude)&&Math.abs(p.longitude)<=180;}
function pick(key,p){if(!editable||!valid(p))return;if(markers[key])markers[key].setLatLng([p.latitude,p.longitude]);send({type:'selection',endpoint:key,point:p});}
function receive(raw){
 try{var value=typeof raw==='string'?JSON.parse(raw):raw;
 if(!value||value.type!=='update'||!value.points||(value.points.origin&&!valid(value.points.origin))||(value.points.destination&&!valid(value.points.destination)))return;
 selected=value.selected==='destination'?'destination':'origin';editable=value.editable===true;topInset=typeof value.topInset==='number'?Math.max(0,Math.min(value.topInset,600)):0;
 var changed=false;
 ['origin','destination'].forEach(function(key){var p=value.points[key];
 if(!p){if(markers[key]){map.removeLayer(markers[key]);delete markers[key];changed=true;}return;}
 if(!markers[key]){changed=true;markers[key]=L.marker([p.latitude,p.longitude],{draggable:editable,keyboard:true,title:key==='origin'?'Origem A':'Destino B',icon:L.divIcon({className:'pin '+key,html:'<span><b>'+(key==='origin'?'A':'B')+'</b></span>',iconSize:[42,42],iconAnchor:[21,42]})}).addTo(map);
 markers[key].on('dragend',function(){var c=markers[key].getLatLng();pick(key,{latitude:c.lat,longitude:((c.lng+180)%360+360)%360-180});});
 } else {var current=markers[key].getLatLng();if(Math.abs(current.lat-p.latitude)>0.000001||Math.abs(current.lng-p.longitude)>0.000001)changed=true;markers[key].setLatLng([p.latitude,p.longitude]);}
 if(editable)markers[key].dragging.enable();else markers[key].dragging.disable();});
 map.invalidateSize();
 if(!lastPoints||changed||lastInset!==topInset)frameMap();
 lastInset=topInset;
 lastPoints=value.points;
 }catch(e){}
}
window.divideMapUpdate=receive;
window.addEventListener('message',function(event){if(event.source===window.parent)receive(event.data);});
map.on('click',function(event){pick(selected,{latitude:event.latlng.lat,longitude:((event.latlng.lng+180)%360+360)%360-180});});
window.addEventListener('resize',frameMap);
send({type:'ready'});
})();
</script></body></html>`;
