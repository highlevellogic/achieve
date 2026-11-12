exports.servlet=function (session) {
    const value=Number(session.params.value);
    let result=0;
    for(let number=1;number<=value;number++) result=(result+number*number)%1000000007;
    session.response.setHeader("Content-Type","application/json;charset=utf-8");
    session.response.end(JSON.stringify({
        id:session.params.id,
        value,
        result,
        pid:process.pid,
        workerId:require("node:cluster").worker.id,
        slot:Number(process.env.ACHIEVE_CLUSTER_SLOT),
        generation:Number(process.env.ACHIEVE_CLUSTER_GENERATION)
    }));
};
