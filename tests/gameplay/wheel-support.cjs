'use strict';

// Added only in the debugger's local QA scope. The game remains unchanged.
const wheelExpose = `
window.__wheelQA = {
    phases: () => wheelInfos.map(i=>i.rollingPhase),
    step: stepSimulation,
    sample() { return wheelInfos.map(info=>{
        const base = new THREE.Quaternion().copy(carBody.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),info.steeringAngle));
        const forward = new THREE.Vector3(0,0,1).applyQuaternion(base);
        const velocity = new CANNON.Vec3();
        carBody.getVelocityAtWorldPoint(info.isInContact?info.hitPoint:info.worldPos,velocity);
        const relative = base.clone().invert().multiply(info.visualWheel.quaternion);
        return {phase:info.rollingPhase,angle:2*Math.atan2(relative.x,relative.w),offAxis:Math.hypot(relative.y,relative.z),speed:velocity.x*forward.x+velocity.y*forward.y+velocity.z*forward.z,radius:tuningParams.wheelRadius,position:info.visualWheel.position.toArray(),contact:info.isInContact};
    }); },
    stationary() { carBody.position.set(-30,4,0);carBody.quaternion.set(0,0,0,1);carBody.velocity.set(0,0,0);carBody.angularVelocity.set(0,0,0);carBody.force.set(0,0,0);carBody.torque.set(0,0,0);carBody.sleep(); },
    travel(speed) { carBody.position.set(-30,4,0);carBody.quaternion.set(0,0,0,1);carBody.velocity.set(0,0,speed);carBody.angularVelocity.set(0,0,0);carBody.force.set(0,0,0);carBody.torque.set(0,0,0);carBody.wakeUp(); },
    geometry() { return wheelInfos.map(i=>{const g=i.visualWheel.geometry;return {vertices:g.attributes.position.count,triangles:g.index.count/3,attributes:Object.fromEntries(Object.entries(g.attributes).map(([k,v])=>[k,v.count])),children:i.visualWheel.children.length};}); }
};
`;

function wheelScenario() {
    const q=window.__vibecarQA,w=window.__wheelQA,checks=[];
    const check=(condition,message)=>{if(!condition)throw Error(message);};
    const angleError=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
    q.sampleRendering();q.reset();
    check(w.phases().every(p=>p===0),'reset phase');checks.push('reset-phase');
    let positive=0,negative=0,wraps=0,maxError=0,maxAxisError=0;
    const phases=[];
    for(const [name,count,controls] of [['settle',120,{}],['forward',180,{forward:1}],['brake-reverse',360,{backward:1}],['steer-left',90,{backward:1,left:1}],['steer-right',90,{forward:1,right:1}],['handbrake',90,{handbrake:true}]]) {
        Object.assign(q.controls,{forward:0,backward:0,left:0,right:0,handbrake:false},controls);
        for(let i=0;i<count;i++) {
            const before=w.phases();w.step(1/60);
            w.sample().forEach((s,j)=>{
                const delta=s.speed/60/s.radius,expected=before[j]+delta;
                maxError=Math.max(maxError,angleError(s.angle,expected));maxAxisError=Math.max(maxAxisError,s.offAxis);
                check(Math.abs(s.phase)<2*Math.PI,'unbounded phase');
                check(angleError(s.phase,expected)<1e-10,'travel/radius integration');
                check(angleError(s.angle,expected)<1e-10&&s.offAxis<1e-10,'body/steer/roll composition');
                if(delta>0.01)positive++;if(delta<-.01)negative++;
                if(Math.abs(s.phase-before[j])>Math.PI)wraps++;
            });
        }
        phases.push({name,samples:w.sample()});checks.push(name+'-integration');
    }
    check(positive>100&&negative>100,'both travel directions required');checks.push('forward-and-reverse');
    check(wraps>5,'phase wrapping unexercised');checks.push('continuous-wrap');
    Object.assign(q.controls,{forward:0,backward:0,left:0,right:0,handbrake:false});
    const before=w.phases();for(let i=0;i<120;i++){w.stationary();w.step(1/60);}
    check(w.phases().every((p,j)=>p===before[j]),'stopped wheel drift');checks.push('stopped-phase-stable');
    for(const radius of [.1,.7,1.2]) {
        const before=w.phases();q.tune({wheelRadius:radius});w.travel(12);w.step(1/60);
        w.sample().forEach((s,j)=>check(angleError(s.phase,before[j]+s.speed/60/radius)<1e-10,'radius integration'));
    }
    checks.push('radius-change-continuity');
    q.reset();check(w.phases().every(p=>p===0),'repeat reset');checks.push('repeat-reset');
    w.step(0);check(w.phases().every(p=>p===0),'zero delta adds roll');checks.push('zero-delta');
    const geo=w.geometry();for(const g of geo)check(Object.values(g.attributes).every(count=>count===g.vertices)&&g.children===0,'geometry attribute/mesh contract');checks.push('geometry-attributes');
    q.render();return{checks,positive,negative,wraps,maxError,maxAxisError,phases,geometry:geo,diagnostics:q.diagnostics()};
}
module.exports={wheelExpose,wheelScenario};
