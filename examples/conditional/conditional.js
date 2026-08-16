const results = document.getElementById("results");

function addResult(name, response, expectedStatus, extraPass) {
    const passed = response.status === expectedStatus && (extraPass === undefined || extraPass);
    const row = document.createElement("tr");
    const values = [name, response.status, response.headers.get("etag") || "", response.headers.get("content-encoding") || "identity/hidden", response.headers.get("vary") || "", passed ? "PASS" : "FAIL (expected " + expectedStatus + ")"];
    values.forEach(function (value, index) {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (index === 5) cell.className = passed ? "pass" : "fail";
        row.appendChild(cell);
    });
    results.appendChild(row);
}

function request(url, options) {
    return fetch(url, Object.assign({cache: "no-store"}, options || {}));
}

async function runStaticTests() {
    const initial = await request("static/resource.txt");
    const tag = initial.headers.get("etag");
    addResult("Initial static GET", initial, 200, Boolean(tag) && initial.headers.get("vary") === "Accept-Encoding");
    addResult("Matching If-None-Match", await request("static/resource.txt", {headers: {"If-None-Match": tag}}), 304);
    addResult("Stale If-None-Match", await request("static/resource.txt", {headers: {"If-None-Match": '"stale"'}}), 200);
    addResult("Matching If-Match", await request("static/resource.txt", {headers: {"If-Match": tag}}), 200);
    addResult("Stale If-Match", await request("static/resource.txt", {headers: {"If-Match": '"stale"'}}), 412);
    addResult("Weak If-Match", await request("static/resource.txt", {headers: {"If-Match": "W/" + tag}}), 412);
    addResult("If-Match precedence", await request("static/resource.txt", {headers: {"If-Match": '"stale"', "If-None-Match": tag}}), 412);
}

async function runServletTests() {
    const before = await request("servlets/counter.jss");
    const beforeCount = await before.text();
    addResult("Counter before failed POST", before, 200, beforeCount === "0");
    addResult("Servlet GET If-None-Match: *", await request("servlets/counter.jss", {headers: {"If-None-Match": "*"}}), 304);
    addResult("Servlet POST If-None-Match: *", await request("servlets/counter.jss", {method: "POST", headers: {"If-None-Match": "*", "Content-Type": "application/x-www-form-urlencoded"}, body: "value=1"}), 412);
    const after = await request("servlets/counter.jss");
    const afterCount = await after.text();
    addResult("Failed POST did not execute servlet", after, 200, afterCount === beforeCount);
}

document.getElementById("run-static").addEventListener("click", function () { runStaticTests().catch(console.error); });
document.getElementById("run-servlet").addEventListener("click", function () { runServletTests().catch(console.error); });
document.getElementById("clear").addEventListener("click", function () { results.textContent = ""; });
