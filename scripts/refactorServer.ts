import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

// Fix compiling issues
content = content.replace('handleGeminiError(error, res);', 'handleProxyError(res, error, "Random Topic");');
content = content.replace('import express from "express";', 'import express, { Request, Response } from "express";');

// Extract generate text
const textRouteStart = content.indexOf('app.post("/api/gemini/generate-text"');
const textTryStart = content.indexOf('try {', textRouteStart);
// Find the end of handleProxyError
const textRouteEnd = content.indexOf('});', content.indexOf('handleProxyError(res, error, "Text");', textRouteStart)) + 3;

// Extract generate image
const imgRouteStart = content.indexOf('app.post("/api/gemini/generate-image"');
const imgTryStart = content.indexOf('try {', imgRouteStart);
const imgRouteEnd = content.indexOf('});', content.indexOf('req.query.debug === \'1\'', imgRouteStart)) + 3;

fs.writeFileSync('server_extracted.ts', content);
