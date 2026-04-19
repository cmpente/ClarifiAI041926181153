import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add import
const importStatement = "import { DebugStyleBaseline } from './components/DebugStyleBaseline';\n";
code = code.replace("import { ClarifiLogo } from './components/ClarifiLogo';\n", importStatement + "import { ClarifiLogo } from './components/ClarifiLogo';\n");

// Add component exactly before the last closing </div>
const insertion = "\n      {import.meta.env.DEV && <DebugStyleBaseline />}\n    </div>";
code = code.replace(/<\/div>\s*< \/div>|<\/div>\s*\);\s*}\s*$/m, insertion + "\n  );\n}\n");

fs.writeFileSync('src/App.tsx', code);
