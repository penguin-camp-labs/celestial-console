// Receive a short-lived Sites credential through stdin. Never write it to disk.
import { spawnSync } from 'node:child_process';
// Disable terminal echo when receiving credentials interactively.
if (process.stdin.isTTY) process.stdin.setRawMode(true);
let input = '';
console.log('READY_FOR_SOURCE_CREDENTIAL');
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
  if (!input.includes('\n')) return;
  process.stdin.pause();
  try {
    const cred = JSON.parse(input.slice(0, input.indexOf('\n')));
    input = '';
    const url = new URL(cred.remote_url);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'git.chatgpt-team.site' ||
      !url.pathname.includes('appgprj_6aa2953ddd248191bad7c4ec0729e0a0') ||
      cred.branch !== 'main' ||
      cred.auth_mode !== 'http_extra_header'
    )
      throw Error('Unexpected repository credential metadata');
    const result = spawnSync(
      'git',
      ['push', cred.remote_url, 'HEAD:' + cred.branch],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          GIT_CONFIG_COUNT: '2',
          GIT_CONFIG_KEY_1: 'safe.directory',
          GIT_CONFIG_VALUE_1: process.cwd().replaceAll('\\', '/'),
          GIT_CONFIG_KEY_0: 'http.' + cred.remote_url + '.extraHeader',
          GIT_CONFIG_VALUE_0: 'Authorization: Bearer ' + cred.token,
          GIT_TERMINAL_PROMPT: '0',
        },
      },
    );
    if (result.stdout)
      process.stdout.write(result.stdout.replaceAll(cred.token, '[REDACTED]'));
    if (result.stderr)
      process.stderr.write(result.stderr.replaceAll(cred.token, '[REDACTED]'));
    process.exit(result.status ?? 1);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
});
