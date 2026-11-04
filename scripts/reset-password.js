import { resetPassword } from '../server/auth.js';
import { readConfig } from '../server/config.js';
import { openDatabase } from '../server/db.js';

const db = openDatabase(readConfig().dataDir);
const password = resetPassword(db);
db.close();

console.log('ახალი პაროლი (ჩანს მხოლოდ ერთხელ, შეინახე):');
console.log(`  ${password}`);
