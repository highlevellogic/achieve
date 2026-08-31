const fs=require('node:fs');
const path=require('node:path');
const createReadStream=fs.createReadStream;
const app=process.env.ACHIEVE_LENGTH_APP;
fs.createReadStream=function (file,options) {
    const name=path.basename(String(file));
    if (options && options.fd !== undefined) {
        if (name === 'setup-error.txt') throw new Error('Injected stream setup failure');
        if (name === 'replace.txt') {
            fs.renameSync(file,file+'.old');
            fs.renameSync(path.join(app,'replacement.txt'),file);
        }
        if (name === 'grow.txt') fs.appendFileSync(file,'EXTRA-BYTES');
        if (process.send) process.send({event:'stream',name,start:options.start,end:options.end});
    }
    const stream=createReadStream.apply(this,arguments);
    if (name === 'read-error.txt' && options && options.fd !== undefined) {
        process.nextTick(() => stream.destroy(new Error('Injected pre-header read failure')));
    }
    return stream;
};
const achieve=require('../../achieve');
achieve.setLogging(false);
achieve.setAppPath(app);
achieve.setCaching(true);
achieve.setCompress(true);
const port=Number(process.env.ACHIEVE_LENGTH_PORT);
const protocol=process.env.ACHIEVE_LENGTH_PROTOCOL;
const credentials={
    key:fs.readFileSync(path.join(__dirname,'../logging/test-key.pem')),
    cert:fs.readFileSync(path.join(__dirname,'../logging/test-cert.pem'))
};
const server=protocol === 'http' ? achieve.listen(port)
    : protocol === 'https' ? achieve.slisten({...credentials,httpsPort:port})
    : protocol === 'h2c' ? achieve.listen2(port)
    : achieve.listen2({...credentials,http2Port:port});
server.once('listening',() => process.send({event:'ready'}));
process.on('message',message => {
    if (message === 'stop') server.close(() => process.exit());
});
