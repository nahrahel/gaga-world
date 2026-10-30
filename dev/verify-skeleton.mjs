import { BONES } from '../src/skeleton.js';
function rot(v, k, a){const c=Math.cos(a),s=Math.sin(a);const kx=[k[1]*v[2]-k[2]*v[1],k[2]*v[0]-k[0]*v[2],k[0]*v[1]-k[1]*v[0]];const kd=k[0]*v[0]+k[1]*v[1]+k[2]*v[2];return v.map((x,i)=>x*c+kx[i]*s+k[i]*kd*(1-c));}
const f=v=>v.map(x=>(x>=0?'+':'')+x.toFixed(2)).join(',');
console.log('bones', BONES.length);
for (const n of ['pelvis','spine03','head','clavicle_L','upperarm_L','upperarm_R','forearm_L','forearm_R','hand_L','index01_L','pinky01_L','thumb01_L','thigh_L','thigh_R','shin_L','foot_L','toes_L']) {
  const b = BONES.find(x=>x.name===n); const d=b.dir;
  const mv = ax => { const r=rot(d,b.axes[ax],0.5); return f(r.map((x,i)=>x-d[i])); };
  // twist: track a reference perpendicular (front +Z or palm)
  console.log(n.padEnd(11),'dir',f(d),'| +flex tip moves',mv('flex'),'| +abd',mv('abd'),'| twistAxis',f(b.axes.twist));
}
const idx = BONES.find(b=>b.name==='index03_L'), pk = BONES.find(b=>b.name==='pinky03_L'), th=BONES.find(b=>b.name==='thumb03_L');
console.log('fingertips L index',f(idx.tail),'pinky',f(pk.tail),'thumb',f(th.tail));
