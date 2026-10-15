import {SPEC,packs,rotate,magnetVertices,clamp,transferAt} from './physics.mjs?v=shear-045';
// A magnet-top reference for surface clearance, not a material boundary.
// The physical TPU interface is at the magnet bottom; it is not displayed.
export const MAGNET_TOP=SPEC.magnetBottom+SPEC.magnetThickness;
const edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
export function sliceMagnet(pose,axis,cut){
 const v=magnetVertices(pose),crossAxis=1-axis,points=[];
 const add=p=>{if(!points.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-7))points.push(p);};
 for(const [a,b] of edges){const da=v[a][crossAxis]-cut,db=v[b][crossAxis]-cut;
   if(Math.abs(da)<1e-8)add([v[a][axis],v[a][2]]);
   if(da*db<0){const t=da/(da-db);add([v[a][axis]+t*(v[b][axis]-v[a][axis]),v[a][2]+t*(v[b][2]-v[a][2])]);}
 }
 if(points.length<3)return [];
 const c=points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length],[0,0]);
 return points.sort((a,b)=>Math.atan2(a[1]-c[1],a[0]-c[0])-Math.atan2(b[1]-c[1],b[0]-c[0]));
}
// Schematic continuous envelope around the independently simulated rigid packs.
// TPU compresses continuously, including between packs. Local pocket constraints
// blend into that soft displacement field, not into the undeformed rest height.
export function sectionProfile(s,x,y,anchor,radius){
 const influence=Math.exp(-((x-anchor[0])**2+(y-anchor[1])**2)/(2*(radius*radius+64)));
 const softRoof=MAGNET_TOP-s.depth*influence*transferAt(MAGNET_TOP);
 let offset=0,weight=0;
 for(let i=0;i<packs.length;i++){
   const p=packs[i],pose=s.poses.packs[i],n=rotate(pose.rotation,[0,0,1]);
   const top=rotate(pose.rotation,[0,0,MAGNET_TOP-p.z]);
   const cx=p.x+pose.translation[0]+top[0],cy=p.y+pose.translation[1]+top[1],cz=p.z+pose.translation[2]+top[2];
   const distance=Math.hypot(x-(p.x+pose.translation[0]),y-(p.y+pose.translation[1]));
   const t=clamp((distance-10)/4,0,1),w=1-t*t*(3-2*t);
   offset+=w*(cz-(n[0]*(x-cx)+n[1]*(y-cy))/n[2]-softRoof);weight+=w;
 }
 const roof=softRoof+offset/Math.max(1,weight);
 // Preserve a visible retaining skin when a tilted edge rises locally.
 const top=Math.max(SPEC.stack-s.depth*influence,roof+0.6);
 return {roof,top};
}
