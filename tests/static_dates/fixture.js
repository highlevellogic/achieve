const fs=require('node:fs');
const path=require('node:path');
const app=process.env.ACHIEVE_DATES_APP;
let now=Date.UTC(2030,0,1);
Date.now=()=>now;
const descriptors=new Set();
const createReadStream=fs.createReadStream;
fs.createReadStream=function(file,options) {
    const name=path.basename(String(file));
    if(name==='setup-error.txt') throw new Error('Injected setup failure');
    if(name==='replace.txt') {
        fs.renameSync(file,file+'.old');
        fs.renameSync(path.join(app,'replacement.txt'),file);
    }
    const stream=createReadStream.apply(this,arguments);
    if(name==='read-error.txt') process.nextTick(()=>stream.destroy(new Error('Injected read failure')));
    return stream;
};
const open=fs.openSync,closeSync=fs.closeSync,close=fs.close;
fs.openSync=function(file,...args) {
    const fd=open.call(this,file,...args);
    if(String(file).startsWith(app+path.sep)) descriptors.add(fd);
    return fd;
};
fs.closeSync=function(fd) {const result=closeSync.call(this,fd);descriptors.delete(fd);return result;};
fs.close=function(fd,callback) {
    return close.call(this,fd,err=>{if(!err)descriptors.delete(fd);callback(err);});
};
const achieve=require('../../achieve');
achieve.setLogging(false);
achieve.setAppPath(app);
achieve.setCaching(true);
achieve.setCompress(true);
const port=Number(process.env.ACHIEVE_DATES_PORT),protocol=process.env.ACHIEVE_DATES_PROTOCOL;
const credentials={key:fs.readFileSync(path.join(__dirname,'../logging/test-key.pem')),
    cert:fs.readFileSync(path.join(__dirname,'../logging/test-cert.pem'))};
const server=protocol==='http' ? achieve.listen(port) : protocol==='https' ? achieve.slisten({...credentials,httpsPort:port})
    : protocol==='h2c' ? achieve.listen2(port) : achieve.listen2({...credentials,http2Port:port});
server.once('listening',()=>process.send({ready:true}));
process.on('message',m=>{
    if(m.stop) return server.close(()=>process.exit());
    if(m.now!==undefined) now=m.now;
    if(m.caching!==undefined) achieve.setCaching(m.caching);
    process.send({id:m.id,descriptors:descriptors.size});
});
