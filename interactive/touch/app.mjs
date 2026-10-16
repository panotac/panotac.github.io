import {flexLayers} from './flexitac/flexitac-geometry.mjs';
import {tpuMeshes,boards} from './blender-geometry.mjs?v=unwarped-v1';
import {sectionProfile} from './section.mjs';
import {SPEC,magnets,sensors,cells,TouchModel,clamp,magnetVertices} from './physics.mjs?v=shear-045';
const $=id=>document.getElementById(id),surface=$('surface'),ctx=surface.getContext('2d'),section=$('section'),sc=section.getContext('2d');
const model=new TouchModel();let pointerId=null,hover=null,last=performance.now(),current=null;
const palette=['#414487','#3a548c','#32648e','#2a788e','#238a8d','#1e9b8a','#22a884','#42b576','#64c363','#8bd646','#b8de29','#fde725'];
// A larger divisor shortens every magnetic vector proportionally, without clipping.
const ARROW_LENGTH_DIVISOR=3/1.3,MAGNET_OPACITY=.55,SENSOR_OPACITY=.40;
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
 for(const p of s.dense){const xy=Math.hypot(p.b[0],p.b[1]),value=p.fused/.70;const az=clamp(value,0,1)**1.5,col=palette[Math.min(11,Math.floor(az*12))];const len=xy*72/ARROW_LENGTH_DIVISOR,width=.6+az*4.6;
   const activity=p.fused;if(activity<.007&&xy<.012)continue;ctx.globalAlpha=.28+.72*Math.max(az,Math.min(1,xy/.2));
   if(len<3/ARROW_LENGTH_DIVISOR){if(activity>.008){ctx.fillStyle=col;ctx.beginPath();ctx.arc(px(p.x),py(p.y),1.3+az*3.5,0,2*Math.PI);ctx.fill();}}
   else arrow(ctx,px(p.x),py(p.y),p.b[0]/xy*len,-p.b[1]/xy*len,col,width);ctx.globalAlpha=1;}
 if(model.active){const [x,y]=model.cursor,[ax,ay]=model.anchor,rad=+$('radius').value*W/60;ring(ctx,px(x),py(y),rad,'#d4e6ca44',[3,5]);ring(ctx,px(ax),py(ay),4,'#e5efd3b0');
   if(Math.hypot(x-ax,y-ay)>.15)arrow(ctx,px(ax),py(ay),px(x)-px(ax),py(y)-py(ay),'#f0f4dc',2);
   ring(ctx,px(x),py(y),8,'#f1f3df');line(ctx,px(x)-3,py(y),px(x)+3,py(y),'#f1f3df');line(ctx,px(x),py(y)-3,px(x),py(y)+3,'#f1f3df');
 }else if(hover){ring(ctx,px(hover[0]),py(hover[1]),+$('radius').value*W/60,'#b5ceb444',[3,5]);}
 ctx.font='10px monospace';ctx.fillStyle='#66858c';ctx.fillText('+x →',W-48,H-13);ctx.fillText('+y ↑',12,22);
 $('hint').style.opacity=model.active||s.depth>.08?'0':'1';}
const latticeLayer=document.createElement('canvas');latticeLayer.width=960;latticeLayer.height=600;const latticeCtx=latticeLayer.getContext('2d');
// Preserve Blender UVs while subdividing the flat faces for smooth deformation.
function subdivideFlex(triangle,n=16){
 const at=(i,j)=>{const w=[1-(i+j)/n,i/n,j/n];return {p:[0,1,2].map(k=>w.reduce((a,t,l)=>a+t*triangle[l].p[k],0)),uv:[0,1].map(k=>w.reduce((a,t,l)=>a+t*triangle[l].uv[k],0))};};
 const result=[];for(let i=0;i<n;i++)for(let j=0;j<n-i;j++){
  result.push([at(i,j),at(i+1,j),at(i,j+1)]);
  if(i+j<n-1)result.push([at(i+1,j),at(i+1,j+1),at(i,j+1)]);
 }return result;
}
const flexMeshes=flexLayers.map(layer=>{const image=new Image();image.src=new URL('./flexitac/'+layer.texture,import.meta.url).href;
 return {...layer,image,triangles:layer.triangles.flatMap(t=>subdivideFlex(t))};});
const flexCanvas=document.createElement('canvas');flexCanvas.width=960;flexCanvas.height=600;const fc=flexCanvas.getContext('2d');
function textureTriangle(c,image,vertices,points){
 const uv=vertices.map(v=>[v.uv[0]*image.width,(1-v.uv[1])*image.height]);
 const [u0,v0]=uv[0],du1=uv[1][0]-u0,dv1=uv[1][1]-v0,du2=uv[2][0]-u0,dv2=uv[2][1]-v0;
 const det=du1*dv2-du2*dv1;if(Math.abs(det)<1e-8)return;
 const [x0,y0]=points[0],dx1=points[1][0]-x0,dy1=points[1][1]-y0,dx2=points[2][0]-x0,dy2=points[2][1]-y0;
 const a=(dx1*dv2-dx2*dv1)/det,b=(dy1*dv2-dy2*dv1)/det,cc=(dx2*du1-dx1*du2)/det,d=(dy2*du1-dy1*du2)/det;
 c.save();polygon(c,points);c.clip();c.transform(a,b,cc,d,x0-a*u0-cc*v0,y0-b*u0-d*v0);c.drawImage(image,0,0);c.restore();
}
function drawSection(s){
 sc.clearRect(0,0,section.width,section.height);
 // Fixed three-quarter camera inspired by the Blender assembly reference.
 // Geometry and poses use the same millimeter coordinates as the field model.
 const ca=.84,sa=.542586,ce=.819152,se=.573576,scale=10.5;
 const project=([x,y,z])=>[480+(x*ca+y*sa)*scale,365+((x*sa-y*ca)*se-z*ce)*scale];
 const depth=([x,y,z])=>(-x*sa+y*ca)*ce-z*se;
 const camera=[sa*ce,-ca*ce,se],radius=+$('radius').value;
 const profile=(x,y)=>sectionProfile(s,x,y,model.anchor,radius).top;
 const deform=(x,y,z)=>{const w=Math.exp(-((x-model.anchor[0])**2+(y-model.anchor[1])**2)/(2*(radius*radius+64)));
  return [x+s.shear[0]*w*SPEC.packShearGain*z/SPEC.stack,y+s.shear[1]*w*SPEC.packShearGain*z/SPEC.stack,z];};
 const roof=(x,y)=>{const p=deform(x,y,SPEC.stack);p[2]=profile(x,y);return p;};
 let renderCtx=sc;
 const face=(pts,fill,stroke=null,width=1)=>{polygon(renderCtx,pts.map(project));renderCtx.fillStyle=fill;renderCtx.fill();if(stroke){renderCtx.strokeStyle=stroke;renderCtx.lineWidth=width;renderCtx.stroke();}};
 const faces=[];
 function cuboid(v,colors,layer=2){
  for(const [j,ids] of [[0,[0,1,5,4]],[1,[1,2,6,5]],[2,[2,3,7,6]],[3,[3,0,4,7]],[4,[4,5,6,7]]]){
   const pts=ids.map(i=>v[i]),u=pts[1].map((n,i)=>n-pts[0][i]),w=pts[2].map((n,i)=>n-pts[0][i]);
   const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
   if(n.reduce((a,v,i)=>a+v*camera[i],0)<=0)continue;
   faces.push({pts,d:pts.reduce((a,p)=>a+depth(p),0)/4,color:colors[j],top:j===4,layer});
  }
 }
 const box=(x,y,z,w,h,t)=>[[-w/2,-h/2,0],[w/2,-h/2,0],[w/2,h/2,0],[-w/2,h/2,0],[-w/2,-h/2,t],[w/2,-h/2,t],[w/2,h/2,t],[-w/2,h/2,t]].map(p=>[p[0]+x,p[1]+y,p[2]+z]);
 // A soft ground shadow anchors the assembly without a wireframe cage.
 sc.save();sc.translate(480,375);sc.scale(1,.38);const shadow=sc.createRadialGradient(0,0,10,0,0,410);shadow.addColorStop(0,'#28233020');shadow.addColorStop(1,'#28233000');sc.fillStyle=shadow;sc.fillRect(-440,-440,880,880);sc.restore();
 for(const board of boards){const [x,y]=board.center,[w,h,t]=board.size;
  const pcb=board.name.endsWith('_PCB');
  cuboid(box(x,y,pcb?-2.5:-.9,w,h,t),pcb?['#b4a47d','#c7b991','#b4a47d','#c7b991','#275744']:['#222b31','#3d454c','#222b31','#3d454c','#424a52'],pcb?0:1);
 }
 // Blender lattice, assembled into the simulation envelope and deformed continuously.
 // Draw the real strut surfaces rather than triangle wireframes.
 for(const mesh of tpuMeshes){
  const verts=mesh.vertices.map(([x,y,z])=>{const p=deform(x,y,z);p[2]=z*profile(x,y)/SPEC.stack;return p;});
  for(const ids of mesh.triangles){const pts=ids.map(i=>verts[i]);
   const u=pts[1].map((v,i)=>v-pts[0][i]),w=pts[2].map((v,i)=>v-pts[0][i]);
   const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],len=Math.hypot(...n);
   if(!len||n.reduce((a,v,i)=>a+v*camera[i],0)<=0)continue;
   const light=Math.max(0,(n[0]*-.25+n[1]*-.45+n[2]*.86)/len),g=Math.round(95+80*light);
   faces.push({pts,d:pts.reduce((a,p)=>a+depth(p),0)/3,color:`rgba(${g},${g},${g+4},1)`,lattice:true});
  }
 }
 s.poses.magnets.forEach(p=>cuboid(magnetVertices(p),['#7c8792','#a0aab4','#74818d','#96a1ad','#e0e5e9']));
 faces.sort((a,b)=>b.d-a.d);
 faces.filter(f=>!f.lattice).sort((a,b)=>a.layer-b.layer||b.d-a.d).forEach(f=>face(f.pts,f.color,'#39434d55',.8));
 latticeCtx.clearRect(0,0,960,600);renderCtx=latticeCtx;
 faces.filter(f=>f.lattice).forEach(f=>face(f.pts,f.color));renderCtx=sc;
 sc.save();sc.globalAlpha=.32;sc.drawImage(latticeLayer,0,0);sc.restore();
 // Actual flat Blender faces and baked original materials; transparency reveals the TPU.
 for(const [i,layer] of flexMeshes.entries()){
  if(!layer.image.complete||!layer.image.naturalWidth)continue;
  fc.clearRect(0,0,960,600);
  for(const triangle of layer.triangles){
   const points=triangle.map(v=>{const p=roof(v.p[0],v.p[1]);p[2]+=v.p[2];return project(p);});
   textureTriangle(fc,layer.image,triangle,points);
  }
  sc.save();sc.globalAlpha=[.10,.04,.38][i];sc.drawImage(flexCanvas,0,0);sc.restore();
 }
 if(model.active){const p=project(roof(...model.contact));ring(sc,p[0],p[1],9,'#59238099');arrow(sc,p[0],p[1]-38,0,24,'#592380',2);}
}
let lastSectionDraw=-Infinity;
function animate(now){let dt=Math.min((now-last)/1000,.05);last=now;
 current=model.step(dt,+$('depth').value,+$('radius').value,true);drawSurface(current);if(now-lastSectionDraw>40){drawSection(current);lastSectionDraw=now;}
 $('status').textContent=model.active?(current.slipping?'SLIDING':Math.hypot(...current.shear)>.15?'SHEAR HELD':'PRESSING'):current.depth>.02?'RECOVERING':'READY';
 requestAnimationFrame(animate);}
// Read-only diagnostics for reproducible validation; no force calibration implied.
window.touchLab={snapshot:()=>({active:model.active,depth:current?.depth,shear:current?.shear,delta:current?.delta,poses:current?.poses,slipping:current?.slipping,mode:'fused',view:'oblique',allowSliding:true}),spec:SPEC};
requestAnimationFrame(animate);
