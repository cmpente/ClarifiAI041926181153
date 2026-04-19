import fs from 'fs';
let code = fs.readFileSync('src/components/DebugStyleBaseline.tsx', 'utf8');

code = code.replace(
  'Object.entries(status).map(([topic, info]) => (', 
  'Object.entries(status).map(([topic, info]: [string, any]) => ('
);

fs.writeFileSync('src/components/DebugStyleBaseline.tsx', code);
