import achieve from "achieve";
import { WebSocketServer } from "ws";
import rooms from "achieve_rooms";
import { examplesPath,mainPort } from "./example-config.mjs";

achieve.setAppPath(examplesPath);
achieve.setMode("production");

const server = achieve.listen(mainPort);
const webSockets = new WebSocketServer({server});

webSockets.on("connection",function (ws,request) {
  rooms.joinRoom(ws,request.url);

  ws.on("message",function (data,isBinary) {
    rooms.broadcast(ws,data,isBinary);
  });

  ws.on("close",function () {
    rooms.remove(ws);
  });
});
