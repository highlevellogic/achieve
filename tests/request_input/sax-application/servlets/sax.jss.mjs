import { SaxParser } from "@nodable/sax";

export function servlet(session) {
    session.allowAsync=true;

    const parser=new SaxParser({
        onError(error) {
            if (session.response.writableEnded) return;
            session.response.statusCode=400;
            session.response.end("XML parse error: "+error.message);
        },
        onEnd() {
            if (session.response.writableEnded) return;
            session.response.statusCode=200;
            session.response.end("completed processing of XML");
        }
    });

    session.request.on("data",function (chunk) {
        if (!session.response.writableEnded) parser.write(chunk);
    });
    session.request.on("end",function () {
        if (!session.response.writableEnded) parser.end();
    });
}
