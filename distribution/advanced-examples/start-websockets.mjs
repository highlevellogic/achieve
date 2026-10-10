import achieve from "achieve";
import { WebSocketServer } from "ws";
import rooms from "achieve_rooms";
import { applicationPath,mainPort } from "./example-config.mjs";

achieve.setAppPath(applicationPath);
achieve.setMode("development");

const server = achieve.listen(mainPort);
const webSockets = new WebSocketServer({server});

webSockets.on("connection",function (socket,request) {
  rooms.joinRoom(socket,request.url);

  socket.on("message",function (data,isBinary) {
    rooms.broadcast(socket,data,isBinary);
  });

  socket.on("close",function () {
    rooms.remove(socket);
  });
});
