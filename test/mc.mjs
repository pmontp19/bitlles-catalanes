import { Sim, standardLayout, makeThrow, GAP } from '../public/js/physics.js';
function run(aim, env={}) {
  const s = new Sim(standardLayout(), {});
  s.launch(makeThrow(aim, env));
  let t=0; while(t<6 && !(s.settled() && !s.b.active)) { s.step(1/240); t+=1/240; }
  return { n: s.fallenCount(), t, standing: s.standingIds() };
}
function seq(aims){ // tirada of up to 3
  let pins=null; let n=0;
  for (const aim of aims){
    const s = pins? Sim.fromState(pins,{}) : new Sim(standardLayout(),{});
    s.launch(makeThrow(aim,{}));
    let t=0; while(t<6 && !(s.settled() && !s.b.active)) { s.step(1/240); t+=1/240; }
    n=s.fallenCount(); pins=s.snapshot(); if(n>=5) break;
  }
  return n;
}
const cases = [
 ['centre de punta p.5', {tx:0, angle:0, power:0.5, spin:0}],
 ['esquerra de punta', {tx:-GAP, angle:0, power:0.5, spin:0}],
 ['centre gir 1', {tx:0, angle:0, power:0.5, spin:1}],
 ['centre gir 2.5', {tx:0, angle:0, power:0.6, spin:2.5}],
 ['entre 1-2 gir1', {tx:-GAP/2, angle:0, power:0.5, spin:1}],
 ['feble', {tx:0, angle:0, power:0.05, spin:0}],
 ['diag', {tx:-GAP, angle:0.25, power:0.5, spin:0}],
 ['fort', {tx:0, angle:0, power:1, spin:0}],
];
for (const [name, aim] of cases) {
  const h = new Array(7).fill(0); let tt=0;
  for (let i=0;i<300;i++){ const r=run(aim); h[r.n]++; tt+=r.t; }
  console.log(name.padEnd(22), h.map(x=>String(x).padStart(4)).join(''), ' t=', (tt/300).toFixed(2));
}
// random tirada strategy
const h=new Array(7).fill(0);
for(let i=0;i<500;i++){ h[seq([{tx:0,angle:0,power:0.5,spin:1.2},{tx:-GAP,angle:0,power:0.5,spin:0},{tx:GAP,angle:0,power:0.5,spin:0}])]++; }
console.log('tirada', h);
