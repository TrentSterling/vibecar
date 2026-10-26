'use strict';

const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {analyticsUrl,initSource,exposeSource,initializationLine,scenario}=require('./browser-support.cjs');
const {wheelExpose,wheelScenario}=require('./wheel-support.cjs');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

(async()=>{
    const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
    const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html);});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    let browser,reference;const runs=[];
    try {
        browser=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
        for(const hz of [60,30,90,120,144]) {
            const context=await browser.newContext({viewport:{width:1280,height:800}});
            try {
                await context.route(analyticsUrl,route=>route.abort());
                const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
                await page.addInitScript(initSource);
                const url=process.env.VIBECAR_LIVE_URL||`http://127.0.0.1:${server.address().port}/`;
                const cdp=await context.newCDPSession(page);let exposureError;
                cdp.on('Debugger.paused',async event=>{
                    try {
                        const r=await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:event.callFrames[0].callFrameId,expression:exposeSource+wheelExpose,returnByValue:true});
                        if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
                    } catch(e) {exposureError=String(e);}
                    finally {await cdp.send('Debugger.resume');}
                });
                await cdp.send('Debugger.enable');
                await cdp.send('Debugger.setBreakpointByUrl',{url,lineNumber:initializationLine(html)});
                await page.goto(url);assert.equal(exposureError,undefined);
                await page.waitForFunction(()=>document.readyState==='complete'&&!!window.__vibecarQA);
                const result=await page.evaluate(scenario,hz);
                const wheel=await page.evaluate(wheelScenario);assert.deepEqual(errors,[]);
                result.wheel=wheel;
                if(reference) {
                    assert.deepEqual(result.initial,reference.initial,'equal initial world/RNG');
                    assert.deepEqual(result.checkpoints,reference.checkpoints,'driving/collision/camera/RNG parity at '+hz+' Hz');
                    assert.deepEqual(result.final,reference.final,'recovery and reset parity at '+hz+' Hz');
                } else reference=result;
                runs.push({hz,wheel:result.wheel,checks:result.checks,initialHash:hash(result.initial),checkpoints:result.checkpoints.map(c=>({name:c.name,hash:hash(c.state),speed:c.state.speed})),finalHash:hash(result.final),diagnostics:result.diagnostics});
            } finally {await context.close();}
        }
    } finally {
        if(browser)await browser.close();server.close();
        fs.mkdirSync('.gameplay-evidence',{recursive:true});fs.writeFileSync('.gameplay-evidence/results.json',JSON.stringify({runs},null,2));
    }
    console.log(JSON.stringify({cadences:runs.length,checks:runs.reduce((n,r)=>n+r.checks.length,0),passed:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
