// Stand-only controls: no HA connection, no product setting or accepted baseline.
const params=new URLSearchParams(location.search);
window.__hp1495={enabled:params.get('compare')!=='before',edges:true,strength:1};
for(let i=0;i<120&&!window.__lab?.card;i++)await new Promise(r=>setTimeout(r,100));
const {card,mock}=window.__lab;
const original=(await (await fetch('/reference-fixture.json')).json()).config;
const host=document.createElement('aside');host.id='lab-1495';
host.innerHTML=`<style>
#lab-1495{position:fixed;left:14px;bottom:14px;z-index:1000;font:13px system-ui;color:#e5edf6;background:#202a35ee;border:1px solid #66758766;box-shadow:0 8px 28px #0003;border-radius:10px;max-width:calc(100vw - 100px);backdrop-filter:blur(12px)}
#lab-1495 summary{padding:10px 14px;cursor:pointer;font-weight:600}#lab-1495 .controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:0 14px 12px}
#lab-1495 button,#lab-1495 select{font:inherit;color:inherit;border:1px solid #8192a055;border-radius:6px;background:#34414f;padding:6px 10px;cursor:pointer}#lab-1495 option{background:#202a35}
#lab-1495 button:hover{background:#405366}#lab-1495 button[aria-pressed=true]{border-color:#7ebce6;background:#34536c}#lab-1495 label{display:flex;align-items:center;gap:6px}#lab-1495 input{accent-color:#7ebce6}#lab-1495 small{color:#abbacb}
</style><details open><summary>UI Lab · #1495 · мягкое освещение граней <small>v1.86.0-beta.2</small></summary><div class="controls">
<button id="arch-before">До</button><button id="arch-after">После</button>
<select aria-label="Палитра проверки" id="arch-palette"><option value="white">Белая сцена</option><option value="black">Почти чёрная</option><option value="color">Цветная</option><option value="contrast">Контрастная</option><option value="transparent">Осветление стен · 60%</option><option value="original">Исходные цвета</option></select>
<label><input type="checkbox" id="arch-edges" checked>Линии стыков</label>
<label>Сила <input id="arch-strength" type="range" min="0" max="150" value="100" step="10" style="width:90px"><output id="arch-level">100%</output></label>
</div></details>`;
document.body.append(host);
const $=id=>host.querySelector('#'+id);
function refresh(){
  card._cfgEpoch++;card._modeSceneRevision++;card._isoProjectionSnapshot=null;card.requestUpdate();
  $('arch-before').setAttribute('aria-pressed',String(!window.__hp1495.enabled));
  $('arch-after').setAttribute('aria-pressed',String(window.__hp1495.enabled));
  $('arch-level').textContent=Math.round(window.__hp1495.strength*100)+'%';
}
$('arch-before').onclick=()=>{window.__hp1495.enabled=false;refresh();};
$('arch-after').onclick=()=>{window.__hp1495.enabled=true;refresh();};
$('arch-edges').onchange=e=>{window.__hp1495.edges=e.target.checked;refresh();};
$('arch-strength').oninput=e=>{window.__hp1495.strength=Number(e.target.value)/100;refresh();};
const palettes={white:['#ffffff','#ffffff','#dfe5e9'],black:['#11141a','#11141a','#303b48'],color:['#9ab5b2','#9ab5b2','#dce4e7'],contrast:['#8397a1','#e8d8b9','#dce4e7'],transparent:['#667c91','#e0e4e7','#ccd6df']};
$('arch-palette').onchange=async e=>{
  const current=await mock.hass.callWS({type:'houseplan/config/get'});
  const config=structuredClone(current.config), preset=palettes[e.target.value];
  for(const space of config.spaces){
    const baseline=original.spaces.find(s=>s.id===space.id)?.settings??space.settings;
    if(!preset){space.settings={...space.settings,...structuredClone(baseline)};continue;}
    const [wall,floor,bg]=preset;
    Object.assign(space.settings,{fill_mode:'custom',custom_fill:{c:floor,a:1},wall_fill:{c:wall,a:e.target.value==='transparent'?.4:1},room_color:wall,room_opacity:1,bg_color:bg,name_color:{c:e.target.value==='black'?'#bdc9d5':'#556471',a:1}});
  }
  await mock.hass.callWS({type:'houseplan/config/set',config,expected_rev:current.rev});
  await card._reloadConfigOnly(true);
  refresh();
};
refresh();
