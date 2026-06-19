import 'dotenv/config';
import { refreshAll } from '../src/catalog.js';

try {
  const catalog = await refreshAll(true);
  console.log(`Refreshed catalog and vector index. Items: ${catalog.items.length}`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
