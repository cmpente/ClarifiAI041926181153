import fs from 'fs';

let code = fs.readFileSync('src/components/DebugStyleBaseline.tsx', 'utf8');

code = code.replace(
  "if (eventName === 'topic-skipped') {",
  "if (eventName === 'topic-skipped' || data.event === 'topic-skipped') {"
).replace(
  "else if (eventName === 'topic-complete') {",
  "} else if (eventName === 'topic-complete' || data.event === 'topic-complete') {"
).replace(
  "else if (eventName === 'topic-error') {",
  "} else if (eventName === 'topic-error' || data.event === 'topic-error') {"
).replace(
  "else if (eventName === 'run-error') {",
  "} else if (eventName === 'run-error' || data.event === 'run-error') {"
).replace(
  "else if (eventName === 'run-complete') {",
  "} else if (eventName === 'run-complete' || data.event === 'run-complete') {"
)

fs.writeFileSync('src/components/DebugStyleBaseline.tsx', code);
