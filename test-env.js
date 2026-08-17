const fs = require('fs');
let parsedEnv = {};
const envFile = fs.readFileSync('.env.local', 'utf-8');
envFile.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        let key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.replace(/^"|"$/g, '');
        if (value.startsWith("'") && value.endsWith("'")) value = value.replace(/^'|'$/g, '');
        parsedEnv[key] = value;
    }
});
console.log(parsedEnv);
