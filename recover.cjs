const fs = require('fs');
const path = 'C:/Users/agnal/.gemini/antigravity-ide/brain/945f8792-80e2-4df6-9495-d2a3e9d46312/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(path, 'utf8').split('\n');

for (let line of lines) {
    if (line.includes('"step_index":757')) {
        const obj = JSON.parse(line);
        if (obj.content && obj.content.includes('docker-compose.yml')) {
            const parts = obj.content.split('The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.\n');
            if (parts.length > 1) {
                const fileContent = parts[1].split('\nThe above content')[0];
                const cleanContent = fileContent.split('\n').map(l => l.replace(/^[0-9]+: /, '')).join('\n');
                fs.writeFileSync('docker-compose.yml', cleanContent);
                console.log('Recovered from step 757!');
                break;
            }
        }
    }
}
