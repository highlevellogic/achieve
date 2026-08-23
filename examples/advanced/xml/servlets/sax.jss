'use strict';
/*
IMPORTANT:
request "Content-type" is "application/xml;charset=utf-8"

This example uses @nodable/sax. It must be installed.
npm install @nodable/sax
This is a modified example available @ https://www.npmjs.com/package/@nodable/sax
Modifications are made to run in servlet.
See stream handling below the sax code.

This servlet runs async. (session.allowAsync = true;)
Servlet must handle response and end and must be adequately protected with try-catch.
*/

const { SaxParser } = require('@nodable/sax');

exports.servlet = function (session) {

// stream handling requires async
session.allowAsync = true;

let depth = 0;

const parser = new SaxParser({
  fxpOptions: {
    skip: { attributes: false },
  },

  onXmlDeclaration(attrs) {
    console.log('xml decl:', attrs);
  },

  onStartElement(name, attrs, tagDetail) {
    // `this.matcher` is the read-only path matcher for the current position —
    // handlers run with `this` bound to the builder, so use a regular
    // function (not an arrow function) if you need it.
    console.log('  '.repeat(depth) + `<${name}>`, attrs, `@${tagDetail.index} path=${this.matcher?.toString()}`);
    depth++;
  },

  onText(text) {
    const trimmed = text.trim();
    if (trimmed) console.log('  '.repeat(depth) + `text: "${trimmed}"`);
  },

  onComment(text) {
    console.log('  '.repeat(depth) + `comment: "${text.trim()}"`);
  },

  onCData(text) {
    console.log('  '.repeat(depth) + `cdata: "${text.trim()}"`);
  },

  onEndElement(name, closeMeta) {
    depth--;
    // closeMeta.index/closeEnd are only present for a real closing tag —
    // omitted for self-closing tags, autoClose-synthesized closes, etc.
    const pos = closeMeta?.index !== undefined ? ` @${closeMeta.index}-${closeMeta.closeEnd}` : '';
    console.log('  '.repeat(depth) + `</${name}>${pos}`);
  },

  onError(err) {
    console.error('parse error:', err.message, err.code);

    if (!session.response.writableEnded) {
      session.response.statusCode=400;
      session.response.end("XML parse error: " + err.message + (err.code ? " (" + err.code + ")" : ""));
    }
  },

  onEnd() {
    console.log('--- document complete ---');
    // Also readable after the fact as a property (saxes-style parity) —
    // equivalent to what onXmlDeclaration already printed above.
    console.log('parser.xmlDecl:', parser.xmlDecl);

    if (!session.response.writableEnded) {
      session.response.statusCode=200;
      session.response.end("completed processing of XML");
    }
  },
});


// Start running the data to the parser after the parser has been initialized
session.request.on("data",function(chunk) {
  try {
    parser.write(chunk);
  } catch (err) {
    if (!session.response.writableEnded) {
      session.response.statusCode=500;
      session.response.end("XML processing error: " + err.message);
    }
  }
});

session.request.on("end",function() {
  try {
    parser.end();
  } catch (err) {
    if (!session.response.writableEnded) {
      session.response.statusCode=500;
      session.response.end("XML processing error: " + err.message);
    }
  }
});

}