'use strict';

const analyticsUrl = 'https://www.googletagmanager.com/gtag/js?id=G-27SVZGYHZ3';
const initSource = `
window.__vibecarNow = 0;
window.__vibecarRealNow = performance.now.bind(performance);
performance.now = () => window.__vibecarNow;
window.requestAnimationFrame = () => 0;
let gameSeed = 1026, gameRandomCalls = 0;
Math.random = () => { gameRandomCalls++; return ((gameSeed = (gameSeed * 1664525 + 1013904223) >>> 0) / 4294967296); };
window.__vibecarRandom = () => ({seed: gameSeed, calls: gameRandomCalls});
`;

// Evaluated once at the module's initialization line in an owned test browser.
// Production module functions and their lexical bindings are left unchanged.
const exposeSource = `
window.__vibecarQA = (() => {
    const vector = v => [v.x, v.y, v.z];
    const quat = q => [q.x, q.y, q.z, q.w];
    const body = b => ({position:vector(b.position),quaternion:quat(b.quaternion),velocity:vector(b.velocity),angularVelocity:vector(b.angularVelocity),force:vector(b.force),torque:vector(b.torque),mass:b.mass,linearDamping:b.linearDamping,angularDamping:b.angularDamping,sleepState:b.sleepState});
    const pose = o => ({position:vector(o.position),quaternion:quat(o.quaternion),scale:vector(o.scale)});
    const originalRender = renderer.render.bind(renderer);
    let renderCalls = 0, dynamicContacts = 0;
    world.addEventListener('postStep', () => { for(const c of world.contacts) if((c.bi===carBody&&c.bj.mass>0)||(c.bj===carBody&&c.bi.mass>0)) dynamicContacts++; });
    return {
        controls, reset:resetCar, flip:triggerManualFlip,
        frame(ms) { window.__vibecarNow = ms; animate(ms); },
        sampleRendering() { renderer.render = () => { renderCalls++; scene.updateMatrixWorld(); camera.updateMatrixWorld(); }; },
        baselineDelta(dt) { if(typeof clock!=='undefined') clock.getDelta=()=>dt; },
        render() { originalRender(scene,camera); },
        hide(hidden) { Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden}); if(typeof resetFrameClock==='function') resetFrameClock(); },
        setCar(values) { if(values.position)carBody.position.set(...values.position);if(values.velocity)carBody.velocity.set(...values.velocity);if(values.quaternion)carBody.quaternion.set(...values.quaternion);if(values.angularVelocity)carBody.angularVelocity.set(...values.angularVelocity);carBody.wakeUp(); },
        collisionFixture() { resetCar();carBody.position.set(-13.2,1,4);carBody.velocity.set(0,0,8);carBody.quaternion.set(0,0,0,1);carBody.wakeUp(); },
        tune(values) { Object.assign(tuningParams,values); },
        snapshot() { return {bodies:world.bodies.map(body),worldTime:world.time,stepnumber:world.stepnumber,steer:currentSteer,stuckTimer,isStuckOnSideOrRoof,controls:{...controls},tuning:{...tuningParams},wheels:wheelInfos.map(i=>({steer:i.steeringAngle,length:i.lastSuspensionLength,slip:i.slipVelocity,contact:i.isInContact,hit:vector(i.hitPoint),world:vector(i.worldPos),connection:vector(i.chassisConnectionPointLocal),visual:pose(i.visualWheel)})),car:pose(carMesh),camera:pose(camera),target:vector(orbitControls.target),clouds:clouds.map(c=>c.rotation.y),random:window.__vibecarRandom(),speed:speedElement.textContent}; },
        diagnostics() { return {renderCalls,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,contacts:world.contacts.length,dynamicContacts}; }
    };
})();
`;

function initializationLine(html) {
    const marker = '        initializeTuningParams();';
    if (html.split(marker).length !== 2) throw Error('Module initialization anchor changed');
    return html.slice(0, html.indexOf(marker)).split('\n').length - 1;
}

function scenario(hz=60, legacy=false) {
    const q=window.__vibecarQA,check=(condition,message)=>{if(!condition)throw Error(message);};
    check(document.readyState==='complete','page initialization incomplete');
    const initial=q.snapshot(), checkpoints=[],checks=[];
    q.sampleRendering();q.baselineDelta(1/hz);
    const segments=[
        ['settle',2,{}],['throttle',2,{forward:1}],['left',1,{forward:1,left:1}],
        ['right',1,{forward:1,right:1}],['brake/reverse',2,{backward:1}],
        ['handbrake',1,{handbrake:true}],['coast',1,{}],['reset',1,{},()=>q.reset()],
        ['tuned-drive',1,{forward:1,left:1},()=>q.tune({engineForce:2500,maxSteerAngle:.3})],
        ['reset-defaults',1,{forward:1},()=>q.reset()],
        ['manual-flip',1,{},()=>{q.setCar({position:[-30,1,0],quaternion:[0,0,1,0],velocity:[0,0,0],angularVelocity:[0,0,0]});q.flip();}],
        ['dynamic-collision',2,{forward:1},()=>q.collisionFixture()]
    ];
    let elapsed=0;
    for(const [name,seconds,controls,action] of segments) {
        Object.assign(q.controls,{forward:0,backward:0,left:0,right:0,handbrake:false},controls);
        if(action)action();
        for(let i=1;i<=seconds*hz;i++)q.frame((elapsed+i/hz)*1000);
        elapsed+=seconds;q.render();const state=q.snapshot();
        check(state.bodies.every(b=>[...b.position,...b.velocity,...b.quaternion].every(Number.isFinite)),name+' finite bodies');
        checkpoints.push({name,state});checks.push(name);
    }
    check(q.diagnostics().dynamicContacts>0,'no movable-object collision observed');checks.push('real-dynamic-collision');
    if(!legacy) {
        let now=elapsed*1000,before=q.snapshot().stepnumber;
        q.frame(now+=200);check(q.snapshot().stepnumber===before+6,'moderate gap exceeded six ticks');checks.push('bounded-spike');
        const state=JSON.stringify(q.snapshot());q.frame(now+=10000);check(JSON.stringify(q.snapshot())===state,'stall caught up');checks.push('long-stall');
        q.hide(true);q.frame(now+=50000);check(JSON.stringify(q.snapshot())===state,'hidden simulation advanced');checks.push('hidden');
        q.hide(false);q.frame(now+=50000);check(JSON.stringify(q.snapshot())===state,'resume caught up');checks.push('resume');
        before=q.snapshot().stepnumber;q.frame(now+=1000/60);check(q.snapshot().stepnumber===before+1,'resume tick missing');checks.push('resumed-tick');
        const stable=JSON.stringify(q.snapshot());for(let i=0;i<20;i++)q.render();check(JSON.stringify(q.snapshot())===stable,'render changed world/camera/RNG');checks.push('render-purity');
        before=q.snapshot().stepnumber;q.frame(now+=5);q.reset();check(q.snapshot().stepnumber===before,'reset stepped physics');
        q.frame(now+=1000/60-5);check(q.snapshot().stepnumber===before+1,'partial-debt reset altered cadence');checks.push('reset-partial-debt');
    }
    q.render();return {hz,initial,checkpoints,checks,diagnostics:q.diagnostics(),final:q.snapshot()};
}

module.exports = {analyticsUrl,initSource,exposeSource,initializationLine,scenario};
