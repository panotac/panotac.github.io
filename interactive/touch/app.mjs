import {sliceMagnet,sectionProfile} from './section.mjs';
import {SPEC,magnets,sensors,cells,TouchModel,clamp,magnetVertices} from './physics.mjs';
const $=id=>document.getElementById(id),surface=$('surface'),ctx=surface.getContext('2d'),section=$('section'),sc=section.getContext('2d');
const model=new TouchModel();let pointerId=null,hover=null,last=performance.now(),current=null;
const palette=['#414487','#3a548c','#32648e','#2a788e','#238a8d','#1e9b8a','#22a884','#42b576','#64c363','#8bd646','#b8de29','#fde725'];
// A larger divisor shortens every magnetic vector proportionally, without clipping.
const ARROW_LENGTH_DIVISOR=3,MAGNET_OPACITY=.55,SENSOR_OPACITY=.40;
const W=960,H=480,px=x=>(x+30)/60*W,py=y=>(15-y)/30*H;
function reset(){model.reset();hover=null;pointerId=null;}
function getPosition(e){const r=surface.getBoundingClientRect();return [clamp((e.clientX-r.left)/r.width*60-30,-29.5,29.5),clamp(15-(e.clientY-r.top)/r.height*30,-14.5,14.5)];}
surface.addEventListener('pointerdown',e=>{if(e.button!==0||pointerId!==null)return;e.preventDefault();pointerId=e.pointerId;surface.setPointerCapture(e.pointerId);model.press(...getPosition(e));});
surface.addEventListener('pointermove',e=>{hover=getPosition(e);if(e.pointerId===pointerId)model.move(...hover);});
function release(e){if(pointerId===e.pointerId){model.release();pointerId=null;}}
surface.addEventListener('pointerup',release);surface.addEventListener('pointercancel',release);surface.addEventListener('lostpointercapture',release);surface.addEventListener('pointerleave',()=>{hover=null;});
window.addEventListener('blur',()=>{model.release();pointerId=null;});document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden){model.release();pointerId=null;}});
$('depth').oninput=()=>{$('depthValue').textContent=(+$('depth').value).toFixed(1)+' mm';};$('radius').oninput=()=>{$('radiusValue').textContent=$('radius').value+' mm';};
$('reset').onclick=reset;
function line(c,x1,y1,x2,y2,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
function arrow(c,x,y,dx,dy,color,width){const len=Math.hypot(dx,dy);if(len<.1)return;const ux=dx/len,uy=dy/len,head=Math.min(len*.5,Math.max(4,width*2.8)),half=head*.36;
 c.strokeStyle=color;c.fillStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();c.moveTo(x,y);c.lineTo(x+dx-ux*head*.65,y+dy-uy*head*.65);c.stroke();c.beginPath();c.moveTo(x+dx,y+dy);c.lineTo(x+dx-ux*head-uy*half,y+dy-uy*head+ux*half);c.lineTo(x+dx-ux*head+uy*half,y+dy-uy*head-ux*half);c.closePath();c.fill();}
function ring(c,x,y,r,color,dash=[]){c.strokeStyle=color;c.lineWidth=1.2;c.setLineDash(dash);c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();c.setLineDash([]);}
function polygon(c,points){c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();}
function drawMagneticLayout(s){
 // Fixed chips sit below the translucent rigid packs; arrows are drawn last.
 ctx.save();ctx.globalAlpha=SENSOR_OPACITY;
 sensors.forEach((p,i)=>{const x=px(p[0]),y=py(p[1]),size=3*W/60,h=size/2;
   ctx.fillStyle='#395d4c80';ctx.fillRect(x-h-5,y-h-5,size+10,size+10);
   ctx.fillStyle='#d1bb7bb0';for(const offset of [-.6,-.2,.2,.6]){const t=offset*h;ctx.fillRect(x+t-2,y-h-4,4,5);ctx.fillRect(x+t-2,y+h-1,4,5);ctx.fillRect(x-h-4,y+t-2,5,4);ctx.fillRect(x+h-1,y+t-2,5,4);}
   const chip=ctx.createLinearGradient(x-h,y-h,x+h,y+h);chip.addColorStop(0,'#51616ce0');chip.addColorStop(.35,'#202b32dc');chip.addColorStop(1,'#101b23d0');ctx.fillStyle=chip;ctx.fillRect(x-h,y-h,size,size);ctx.strokeStyle='#c0cdd29c';ctx.lineWidth=.8;ctx.strokeRect(x-h,y-h,size,size);
   ctx.fillStyle='#d4d6c8b0';ctx.beginPath();ctx.arc(x-h+6,y-h+6,1.5,0,Math.PI*2);ctx.fill();ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText('M'+(i+1),x,y+3);ctx.textAlign='start';
 });
 ctx.restore();
 ctx.save();ctx.globalAlpha=MAGNET_OPACITY;
 magnets.forEach((m,i)=>{const v=magnetVertices(s.poses.magnets[i]).map(p=>[px(p[0]),py(p[1])]);
   for(const face of [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]){polygon(ctx,face.map(j=>v[j]));ctx.fillStyle='#a4b7ca18';ctx.fill();ctx.strokeStyle='#c9dce650';ctx.lineWidth=.8;ctx.stroke();}
   const top=v.slice(4),cx=(v[4][0]+v[6][0])/2,cy=(v[4][1]+v[6][1])/2;
   const metal=ctx.createLinearGradient(cx-65,cy-45,cx+65,cy+45);
   [[0,'#e7f1fa24'],[.28,'#61798a18'],[.48,'#f6faff54'],[.55,'#c6d6e52e'],[1,'#69849618']].forEach(([n,c])=>metal.addColorStop(n,c));
   polygon(ctx,top);ctx.fillStyle=metal;ctx.fill();ctx.strokeStyle='#dce9f28c';ctx.lineWidth=1.1;ctx.stroke();
   // Map a circular pole badge onto the actual tilted top face.
   ctx.save();ctx.transform((v[5][0]-v[4][0])/2,(v[5][1]-v[4][1])/2,(v[7][0]-v[4][0])/2,(v[7][1]-v[4][1])/2,cx,cy);
   const badge=ctx.createLinearGradient(-.6,-.6,.6,.6);
   badge.addColorStop(0,m.pole>0?'#ff9a9a80':'#91c5ff80');badge.addColorStop(.4,m.pole>0?'#e8435355':'#427fe355');badge.addColorStop(1,m.pole>0?'#8f243a38':'#224a9138');
   ctx.beginPath();ctx.arc(0,0,.64,0,Math.PI*2);ctx.fillStyle=badge;ctx.fill();ctx.strokeStyle=m.pole>0?'#ffb4b496':'#b5d9ff96';ctx.lineWidth=.018;ctx.stroke();ctx.restore();
   ctx.font='600 14px monospace';ctx.textAlign='center';ctx.fillStyle='#f2f5f1c0';ctx.fillText(m.pole>0?'N':'S',cx,cy+5);ctx.textAlign='start';
 });
 ctx.restore();
}
function drawSurface(s){ctx.clearRect(0,0,W,H);ctx.fillStyle='#101a20';ctx.fillRect(0,0,W,H);
 const gradient=ctx.createRadialGradient(W*.45,H*.4,0,W*.5,H*.5,W*.65);gradient.addColorStop(0,'#17262b');gradient.addColorStop(1,'#10171d');ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
 // Subtle reference dots keep the idle surface legible.
 for(const p of cells){ctx.fillStyle='#56787944';ctx.beginPath();ctx.arc(px(p.x),py(p.y),1,0,Math.PI*2);ctx.fill();}
 if(s.depth>.01){let [x,y]=model.contact;const g=ctx.createRadialGradient(px(x),py(y),0,px(x),py(y),+$('radius').value*W/60*2.6);g.addColorStop(0,`rgba(85,140,113,${Math.min(.14,s.depth*.05)})`);g.addColorStop(1,'rgba(70,110,100,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
 drawMagneticLayout(s);
 for(const p of s.dense){const xy=Math.hypot(p.b[0],p.b[1]),value=p.fused/.70;const az=clamp(value,0,1)**1.5,col=palette[Math.min(11,Math.floor(az*12))];const len=xy*72/ARROW_LENGTH_DIVISOR,width=.8+az*3.2;
   const activity=p.fused;if(activity<.007&&xy<.012)continue;ctx.globalAlpha=.28+.72*Math.max(az,Math.min(1,xy/.2));
   if(len<3/ARROW_LENGTH_DIVISOR){if(activity>.008){ctx.fillStyle=col;ctx.beginPath();ctx.arc(px(p.x),py(p.y),1.3+az*3.5,0,2*Math.PI);ctx.fill();}}
   else arrow(ctx,px(p.x),py(p.y),p.b[0]/xy*len,-p.b[1]/xy*len,col,width);ctx.globalAlpha=1;}
 if(model.active){const [x,y]=model.cursor,[ax,ay]=model.anchor,rad=+$('radius').value*W/60;ring(ctx,px(x),py(y),rad,'#d4e6ca44',[3,5]);ring(ctx,px(ax),py(ay),4,'#e5efd3b0');
   if(Math.hypot(x-ax,y-ay)>.15)arrow(ctx,px(ax),py(ay),px(x)-px(ax),py(y)-py(ay),'#f0f4dc',2);
   ring(ctx,px(x),py(y),8,'#f1f3df');line(ctx,px(x)-3,py(y),px(x)+3,py(y),'#f1f3df');line(ctx,px(x),py(y)-3,px(x),py(y)+3,'#f1f3df');
 }else if(hover){ring(ctx,px(hover[0]),py(hover[1]),+$('radius').value*W/60,'#b5ceb444',[3,5]);}
 ctx.font='10px monospace';ctx.fillStyle='#66858c';ctx.fillText('+x →',W-48,H-13);ctx.fillText('+y ↑',12,22);
 $('hint').style.opacity=model.active||s.depth>.08?'0':'1';}
function drawSection(s){sc.clearRect(0,0,section.width,section.height);const axis=0;
 const scale=800/60,Y=z=>280-z*scale;
 const radius=+$('radius').value;
 const views=[{left:80,width:800,min:-30,max:30,cut:0}];
 for(const view of views){const X=u=>view.left+(u-view.min)/(view.max-view.min)*view.width;
   const profile=u=>sectionProfile(s,u,0,model.anchor,radius);
   const samples=Array.from({length:121},(_,i)=>{const u=view.min+(view.max-view.min)*i/120;return {u,...profile(u)};});
   // One continuous material silhouette keeps the interaction easy to read.
   const outline=[...samples.map(p=>[X(p.u),Y(p.top)]),[X(view.max),Y(0)],[X(view.min),Y(0)]];
   polygon(sc,outline);sc.fillStyle='#a99bb64d';sc.fill();
   sc.beginPath();samples.forEach((p,i)=>i?sc.lineTo(X(p.u),Y(p.top)):sc.moveTo(X(p.u),Y(p.top)));sc.strokeStyle='#82728f99';sc.lineWidth=1;sc.stroke();
   line(sc,X(view.min),Y(0),X(view.max),Y(0),'#82728f99',1.5);
   sc.save();sc.globalAlpha=SENSOR_OPACITY;
   sensors.forEach(p=>{if(Math.abs(p[1-axis]-view.cut)>1.5)return;const width=3*scale;sc.fillStyle='#26353f';sc.fillRect(X(p[axis])-width/2,Y(.45),width,.9*scale);sc.strokeStyle='#b0b9a7';sc.lineWidth=.7;sc.strokeRect(X(p[axis])-width/2,Y(.45),width,.9*scale);});
   sc.restore();sc.save();sc.globalAlpha=MAGNET_OPACITY;
   magnets.forEach((m,i)=>{const slice=sliceMagnet(s.poses.magnets[i],axis,view.cut);if(!slice.length)return;
     const points=slice.map(p=>[X(p[0]),Y(p[1])]),ys=points.map(p=>p[1]),top=Math.min(...ys),bottom=Math.max(...ys);
     const silver=sc.createLinearGradient(0,top,0,bottom);silver.addColorStop(0,'#dce4e9');silver.addColorStop(.12,'#8c9ba7');silver.addColorStop(.48,'#a9b7c0');silver.addColorStop(.54,'#7e8f9b');silver.addColorStop(1,'#394c5b');
     polygon(sc,points);sc.fillStyle=silver;sc.fill();sc.strokeStyle='#d7e2e9bc';sc.lineWidth=.9;sc.stroke();
   });
   sc.restore();
   if(model.active){const u=model.contact[axis],x=X(u),y=Y(profile(u).top);arrow(sc,x,y-22,0,16,'#592380',1.6);}
 }
 sc.font='10px monospace';sc.fillStyle='#696270';sc.fillText('18 mm',3,Y(18)+4);sc.fillText('0',23,Y(0)+3);

}
function animate(now){let dt=Math.min((now-last)/1000,.05);last=now;
 current=model.step(dt,+$('depth').value,+$('radius').value,true);drawSurface(current);drawSection(current);
 $('status').textContent=model.active?(current.slipping?'SLIDING':Math.hypot(...current.shear)>.15?'SHEAR HELD':'PRESSING'):current.depth>.02?'RECOVERING':'READY';
 requestAnimationFrame(animate);}
// Read-only diagnostics for reproducible validation; no force calibration implied.
window.touchLab={snapshot:()=>({active:model.active,depth:current?.depth,shear:current?.shear,delta:current?.delta,poses:current?.poses,slipping:current?.slipping,mode:'fused',view:'xz',allowSliding:true}),spec:SPEC};
requestAnimationFrame(animate);
