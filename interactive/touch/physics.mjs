// PanoTac geometry: mm; magnetic polarization: T; output: mT.
// Finite cuboids via Gauss-Legendre integration of top/bottom magnetic poles.
export const SPEC = Object.freeze({width:60,height:30,stack:18,magnetWidth:6.35,
  magnetThickness:3.175,magnetBottom:11.3,packSpacing:30.17,Br:1.48,
  layerModuli:[0.001,0.0015,0.002],cellSizeReference:8,relaxation:0.11,
  friction:0.8,poisson:0.45,packNormalGain:0.6,packShearGain:0.45,
  pressTiltGain:2.2});
const a=4.532554626464844;
export const packs=[-15.085,15.085].map(x=>({x,y:0,z:12.8875}));
export const magnets=[-15.085,15.085].flatMap((x,k)=>[[0,-a],[a,0],[-a,0],[0,a]].map(([dx,dy],j)=>({x:x+dx,y:dy,z:12.8875,pole:[1,-1,-1,1][j]*(k?-1:1),pack:k})));
export const sensors=[-15.085,15.085].flatMap(x=>[[0,0],[7,0],[-7,0],[0,7],[0,-7]].map(([dx,dy])=>[x+dx,dy,0]));
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const IDENTITY=[1,0,0,0,1,0,0,0,1];
export const rotate=(r,v)=>[0,1,2].map(i=>r[i*3]*v[0]+r[i*3+1]*v[1]+r[i*3+2]*v[2]);
// Minimal rotation carrying +z to the normal of z = gx*x + gy*y.
export function slopeRotation(gx,gy){const len=Math.hypot(gx,gy,1),nx=-gx/len,ny=-gy/len,nz=1/len,k=1/(1+nz);
  return [1-nx*nx*k,-nx*ny*k,nx,-nx*ny*k,1-ny*ny*k,ny,-nx,-ny,nz];}
export const restPoses=magnets.map(m=>({position:[m.x,m.y,m.z],rotation:IDENTITY}));
export function magnetVertices(pose){const h=SPEC.magnetWidth/2,c=SPEC.magnetThickness/2,rt=Math.SQRT1_2;
  return [-c,c].flatMap(z=>[[-h,-h],[h,-h],[h,h],[-h,h]].map(([x,y])=>{
    const v=rotate(pose.rotation,[(x-y)*rt,(x+y)*rt,z]);return v.map((t,i)=>t+pose.position[i]);}));}
// Equal-thickness homogenized layers scaled to PanoTac's 18 mm stack.
// E_f cancels in a displacement-controlled serial-compliance model.
export function transferAt(z){let total=0,part=0;const h=SPEC.stack/3;
  SPEC.layerModuli.forEach((e,k)=>{total+=h/e;part+=clamp(z-k*h,0,h)/e;});return part/total;}
function gauss(n){let result=[];for(let i=0;i<n;i++){let z=Math.cos(Math.PI*(i+.75)/(n+.5)),dp;
  for(let it=0;it<20;it++){let p=1,q=0;for(let j=1;j<=n;j++){let t=q;q=p;p=((2*j-1)*z*q-(j-1)*t)/j;}dp=n*(z*p-q)/(z*z-1);let dz=p/dp;z-=dz;if(Math.abs(dz)<1e-14)break;}
  result.push([z,2/((1-z*z)*dp*dp)]);}return result;}
export function createField(order=6,observers=sensors){const poles=[];const h=SPEC.magnetWidth/2,c=SPEC.magnetThickness/2,rt=Math.SQRT1_2;
  for(const [u,wu] of gauss(order))for(const [v,wv] of gauss(order))for(const s of [-1,1])
    poles.push([(u-v)*h*rt,(u+v)*h*rt,s*c,s*wu*wv*h*h*SPEC.Br/(4*Math.PI)*1000]);
  return function field(poses=restPoses){
    // Rotate both pole surfaces with the body: this rotates its magnetization,
    // not merely the center. Area and signed pole charge stay fixed.
    const worldPoles=poses.flatMap((pose,i)=>poles.map(p=>{const v=rotate(pose.rotation,p);
      return [v[0]+pose.position[0],v[1]+pose.position[1],v[2]+pose.position[2],p[3]*magnets[i].pole];}));
    return observers.map(sensor=>{let bx=0,by=0,bz=0;
      for(const p of worldPoles){const x=sensor[0]-p[0],y=sensor[1]-p[1],z=sensor[2]-p[2];
        const r2=x*x+y*y+z*z,f=p[3]/(r2*Math.sqrt(r2));bx+=x*f;by+=y*f;bz+=z*f;}return [bx,by,bz];});};}
const field=createField();
export const baseline=field();
export function posesFor(contact,depth,shear,radius){const spread2=radius*radius+64;
  const packPoses=packs.map(p=>{const dx=p.x-contact[0],dy=p.y-contact[1];
    const w=Math.exp(-(dx*dx+dy*dy)/(2*spread2))*transferAt(p.z);
    // Independent reduced-model gains: local TPU deformation absorbs more translation.
    const translation=[shear[0]*w*SPEC.packShearGain,shear[1]*w*SPEC.packShearGain,-depth*w*SPEC.packNormalGain];
    // Off-center pressure tilts toward contact. Shear contributes translation only;
    // at a fixed contact anchor it does not change the pack orientation.
    const gx=SPEC.pressTiltGain*depth*w*dx/spread2;
    const gy=SPEC.pressTiltGain*depth*w*dy/spread2;
    return {translation,rotation:slopeRotation(gx,gy),tilt:Math.atan(Math.hypot(gx,gy))};});
  const magnetPoses=magnets.map(m=>{const pack=packs[m.pack],pose=packPoses[m.pack];
    const v=rotate(pose.rotation,[m.x-pack.x,m.y-pack.y,m.z-pack.z]);
    return {position:v.map((t,i)=>t+[pack.x,pack.y,pack.z][i]+pose.translation[i]),rotation:pose.rotation};});
  return {packs:packPoses,magnets:magnetPoses};}
export function magneticResponse(poses){return field(poses).map((b,i)=>b.map((v,j)=>v-baseline[i][j]));}
export const cells=Array.from({length:384},(_,k)=>{const r=Math.floor(k/32),c=k%32;return {x:-30+(c+.5)*60/32,y:15-(r+.5)*30/12};});
// Geometry-based IDW. Original left/right PCB-to-taxel projection not supplied.
const weights=cells.map(p=>{let w=sensors.map(s=>1/((p.x-s[0])**2+(p.y-s[1])**2+1e-6));let sum=w.reduce((a,b)=>a+b,0);return w.map(v=>v/sum);});
function blur(input){const kernel=[0.1065069789,0.7869860422,0.1065069789];let tmp=new Float64Array(384),out=new Float64Array(384);
  for(let r=0;r<12;r++)for(let c=0;c<32;c++)for(let j=-1;j<=1;j++)tmp[r*32+c]+=input[r*32+clamp(c+j,0,31)]*kernel[j+1];
  for(let r=0;r<12;r++)for(let c=0;c<32;c++)for(let j=-1;j<=1;j++)out[r*32+c]+=tmp[clamp(r+j,0,11)*32+c]*kernel[j+1];return out;}
export function denseResponse(delta,contact,depth,radius){let A=blur(cells.map(p=>depth>1e-5?Math.exp(-((p.x-contact[0])**2+(p.y-contact[1])**2)/(2*radius*radius)):0));
  let peak=Math.max(...A),zMean=delta.reduce((s,b)=>s+Math.abs(b[2]),0)/10;
  return cells.map((p,i)=>{const b=[0,0,0];weights[i].forEach((w,j)=>delta[j].forEach((v,k)=>b[k]+=w*v));
    return {...p,b,contact:peak?A[i]/peak:0,fused:peak?zMean*A[i]/peak:0};});}
export class TouchModel{
  constructor(){this.reset();}
  reset(){this.active=false;this.anchor=[0,0];this.cursor=[0,0];this.depth=0;this.shear=[0,0];this.slipping=false;this.contact=[0,0];}
  press(x,y){this.active=true;this.anchor=[x,y];this.cursor=[x,y];this.contact=[x,y];this.shear=[0,0];this.slipping=false;}
  move(x,y){this.cursor=[x,y];}
  release(){this.active=false;this.slipping=false;}
  step(dt,depth,radius,allowSlip=true){const gain=1-Math.exp(-clamp(dt,0,.1)/SPEC.relaxation);let target=[0,0];
    if(this.active){target=this.cursor.map((v,i)=>v-this.anchor[i]);const len=Math.hypot(...target);
      // Illustrative Coulomb limit: kt/kn = G/E; not a measured friction law.
      const limit=Math.max(.15,SPEC.friction*depth*2*(1+SPEC.poisson));this.slipping=allowSlip&&len>limit;
      const cap=allowSlip?limit:6;if(len>cap){target=target.map(v=>v*cap/len);this.anchor=this.cursor.map((v,i)=>v-target[i]);}
      this.contact=[...this.cursor];}
    this.depth+=((this.active?depth:0)-this.depth)*gain;this.shear=this.shear.map((v,i)=>v+(target[i]-v)*gain);
    if(!this.active&&this.depth<1e-5){this.depth=0;this.shear=[0,0];}
    // Influence is attached to the material contact anchor; sliding updates it.
    const poses=posesFor(this.anchor,this.depth,this.shear,radius),delta=magneticResponse(poses.magnets);
    return {poses,delta,dense:denseResponse(delta,this.contact,this.depth,radius),depth:this.depth,shear:[...this.shear],slipping:this.slipping};}
}
