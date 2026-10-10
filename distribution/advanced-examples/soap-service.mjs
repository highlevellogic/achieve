import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import soap from "soap";
import { applicationPath,secondaryPort } from "./example-config.mjs";

const service = {
  InventoryService: {
    InventoryPort: {
      GetPrice() {
        return {price:"44.95"};
      }
    }
  }
};

const wsdlPath = path.join(applicationPath,"advanced/soap/wsdl/service.wsdl");
const wsdl = fs.readFileSync(wsdlPath,"utf8").replaceAll(
  "http://localhost:8990/soap",
  `http://localhost:${secondaryPort}/soap`
);
const server = http.createServer(function (request,response) {
  response.writeHead(404,{"Content-Type":"text/plain"});
  response.end("404: Not Found: " + request.url);
});

server.listen(secondaryPort,function () {
  console.log(`SOAP service listening on http://localhost:${secondaryPort}/soap`);
});

soap.listen(server,"/soap",service,wsdl);
