import { createSite } from './app.js';
import { readConfig } from './config.js';

const config = readConfig();
const site = await createSite({ dataDir: config.dataDir, cookieSecure: config.cookieSecure, trustProxy: config.trustProxy });

if (site.initialPassword) {
  console.log('');
  console.log('ადმინპანელის საწყისი პაროლი (ჩანს მხოლოდ ერთხელ, შეინახე):');
  console.log(`  ${site.initialPassword}`);
  console.log('');
}

const server = site.app.listen(config.port, config.host, (error) => {
  if (error) {
    const reason = error.code === 'EADDRINUSE'
      ? `პორტი ${config.port} დაკავებულია. საიტი შესაძლოა უკვე გაშვებულია სხვა ფანჯარაში.`
      : `სერვერი ვერ ჩაირთო: ${error.message}`;
    console.error(reason);
    site.close();
    process.exit(1);
  }
  const host = config.host === '127.0.0.1' ? 'localhost' : config.host;
  console.log(`საიტი:        http://${host}:${config.port}`);
  console.log(`ადმინპანელი:  http://${host}:${config.port}/admin`);
});

function stop() {
  server.close(() => {
    site.close();
    process.exit(0);
  });
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
