import { writeFile } from 'node:fs/promises';
import { collectCredits, renderCredits } from './credits.mjs';

await writeFile('public/credits.html', renderCredits(await collectCredits()));
