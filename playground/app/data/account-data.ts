import { Account } from 'src/app/types';

import { accountsData, sessionAccountId } from './accounts-data';


export const accountData: Account = accountsData
  .find((account) => account.id === sessionAccountId);
