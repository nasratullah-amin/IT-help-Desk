import { createApp } from './src/app.js';

const app = createApp();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`IT Help Desk listening on http://${HOST}:${PORT}`);
});
