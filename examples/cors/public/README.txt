Modifying cors8989.js run as server granting access via CORS policy
Use cors8990.js with page http://localhost:8990/public/

Then 8990 will try to fetch resources with url: http://localhost:8989 ...

Set
allowOrigins("http://localhost:8990", "/public/"); to give localhost:8990 access to the /public/ directory.
This also gives access to subdirectory /public/frameworks/

Then reset to
allowOrigins("http://localhost:8990", "/public/frameworks/");
This only allows access to /public/frameworks/
