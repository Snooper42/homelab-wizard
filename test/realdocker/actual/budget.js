// The real-Docker run's budget in Actual Budget, through Actual's own API
// package (@actual-app/api, installed by the run into a folder of its own).
//   node budget.js make  <server> <password>: a budget with an account and
//     a transaction, uploaded to the server as the app does
//   node budget.js check <server> <password>: a fresh client finds the
//     budget on the server, downloads it, and reads the transaction back
const api = require('@actual-app/api');
const fs = require('fs');
const os = require('os');
const path = require('path');

const [mode, serverURL, password] = process.argv.slice(2);
const budget = 'Nightly', account = 'Nightly checking', amount = -1234, notes = 'the nightly run';

(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'actual-'));
  await api.init({ dataDir, serverURL, password });
  if (mode === 'make') {
    await api.runImport(budget, async () => {
      const id = await api.createAccount({ name: account, offbudget: false }, 0);
      await api.addTransactions(id, [{ date: '2026-10-01', amount, payee_name: 'Nightly coffee', notes }]);
    });
  } else if (mode === 'check') {
    const b = (await api.getBudgets()).find((b) => b.name === budget && b.groupId);
    if (!b) throw new Error(`no ${budget} budget on the server`);
    await api.downloadBudget(b.groupId);
    const acct = (await api.getAccounts()).find((a) => a.name === account);
    if (!acct) throw new Error(`no ${account} account in the budget`);
    const tx = await api.getTransactions(acct.id, '2026-01-01', '2026-12-31');
    if (!tx.some((t) => t.amount === amount && t.notes === notes)) throw new Error(`the transaction is not there: ${JSON.stringify(tx)}`);
    console.log(`found the transaction in ${budget} (${b.groupId})`);
  } else {
    throw new Error('usage: node budget.js make|check <server> <password>');
  }
  await api.shutdown();
  fs.rmSync(dataDir, { recursive: true, force: true });
})().catch((e) => {
  console.error((e && e.stack) || e);
  process.exit(1);
});
