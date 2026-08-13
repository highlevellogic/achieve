function fetchData (url,parms,method) {
  console.log(url,parms,method);
  if (method === undefined) method = "get";
  if (parms === undefined) parms = "";
  if (url === undefined) {
    console.error("XHR Error: url not set in fetchData().");
    return;
  }
  var xhr = new XMLHttpRequest();  /************* NECESSARY ****************/
  xhr.open(method, url, true);     /************* NECESSARY ****************/
  xhr.responseType = 'text';
  xhr.onload = callback;           /************* NECESSARY ****************/
  xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded;charset=utf-8");
  xhr.setRequestHeader ("encoding", "utf-8");
//  xhr.setRequestHeader("Sec-Fetch-Mode", "cors");

  // Once things are set up, this is where the request is sent out into the Internet
  if (parms.length > 0) {          /************* NECESSARY ****************/
    xhr.send(parms);
  } else {
    xhr.send();
  }
}
function callback() {
  if (this.status < 400) {
    output(this.responseText);
  } else {
    console.error(this.responseText);
  }
}
