import { Sim, standardLayout, makeThrow } from '../public/js/physics.js';
function tirada(policy){
  const s=new Sim(standardLayout(),{}); let n=0;
  for(let k=0;k<3;k++){ s.launch(makeThrow(policy(s,k),{})); let t=0; while(t<8&&!(s.settled()&&!s.b.active)){s.step(1/240);t+=1/240;} n=s.fallenCount(); if(n>=5)break; }
  return n;
}
const R=()=>Math.random();
const pols={
 random:(s,k)=>({tx:(R()-0.5)*0.5,angle:0,power:0.3+R()*0.5,spin:R()*2}),
 smart:(s,k)=>{const st=s.pins.filter(p=>p.a<0.7); const p=st[Math.floor(R()*st.length)]||{x:0}; return {tx:p.x+(R()-0.5)*0.03,angle:0,power:0.45,spin:0};},
};
for(const [k,f] of Object.entries(pols)){const h=Array(7).fill(0); for(let i=0;i<400;i++)h[tirada(f)]++; const pts=[0,1,2,3,4,10,6]; console.log(k,h.join(' '),'avg',(h.reduce((a,c,i)=>a+c*pts[i],0)/400).toFixed(2));}
{const h=Array(7).fill(0); for(let i=0;i<300;i++){const s=new Sim(standardLayout(),{}); s.launch(makeThrow({tx:(R()-0.5)*0.4,angle:0,power:0.5,spin:0},{})); let t=0; while(t<8&&!(s.settled()&&!s.b.active)){s.step(1/240);t+=1/240;} h[s.fallenCount()]++;} console.log('single',h.join(' '));}
