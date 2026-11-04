import { storageContract } from '../../test/storage-contract.ts';
import { createMemoryStorage } from './index.ts';

storageContract('memory', async () => createMemoryStorage());
