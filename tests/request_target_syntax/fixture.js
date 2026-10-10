const fs=require('node:fs');
const path=require('node:path');
const achieve=require('../../achieve');
const app=process.env.ACHIEVE_TARGET_APP;
achieve.setLogging(false);
achieve.setAppPath(app);
achieve.registerMethod('DELETE','handler.jss');
achieve.setRouteMap({'/mapped':'/echo.jss'});
const credentials={key:fs.readFileSync(path.join(__dirname,'../logging/test-key.pem')),
    cert:fs.readFileSync(path.join(__dirname,'../logging/test-cert.pem'))};
let lookups=0;
for(const name of ['statSync','existsSync','openSync']) {
    const original=fs[name];
    fs[name]=function(file,...args) {
        if(typeof file==='string' && file.startsWith(app))lookups++;
        return original.call(this,file,...args);
    };
}
const protocol=process.env.ACHIEVE_TARGET_PROTOCOL,port=Number(process.env.ACHIEVE_TARGET_PORT);
const server=protocol==='http'?achieve.listen(port):protocol==='https'?achieve.slisten({...credentials,httpsPort:port})
    :protocol==='h2c'?achieve.listen2(port):achieve.listen2({...credentials,http2Port:port});
server.once('listening',()=>process.send({ready:true}));
process.on('message',m=>{
    if(m.stop)return server.close(()=>process.exit());
    process.send({id:m.id,lookups});
});
