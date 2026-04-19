import fs from 'fs';
let t = fs.readFileSync('server.ts', 'utf8');

t = t.replace('debugPrompt: getMasterStyleWrapper(prompt, environmentProfile)', 'debugPrompt: ""');

fs.writeFileSync('server.ts', t);
