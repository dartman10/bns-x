import type { NextApiRequest, NextApiResponse } from 'next';
import { contracts } from '../../common/clarigen';
import { contractFactory } from '@clarigen/core';
import { StacksMocknet } from 'micro-stacks/network';
import { asciiToBytes } from 'micro-stacks/common';
import {
  AnchorMode,
  broadcastTransaction,
  makeContractCall,
  PostConditionMode,
} from 'micro-stacks/transactions';
import { fetchAccountNonces } from 'micro-stacks/api';

const testUtils = contractFactory(
  contracts.testUtils,
  'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.test-utils'
);

const network = new StacksMocknet();

export async function faucetApi(req: NextApiRequest, res: NextApiResponse) {
  const { name, recipient } = req.query;

  if (typeof name !== 'string' || typeof recipient !== 'string') {
    return res.status(400).send({ error: 'Missing name, recipient' });
  }

  const privateKey = process.env.FAUCET_KEY!;

  const zonefile = asciiToBytes(
    `$ORIGIN ${name}.btc.\n$TTL 3600\n_http._tcp\tIN\tURI\t10\t1\t"https://gaia.blockstack.org/hub/13WcjxWGz3JkZYhoPeCHw2ukcK1f1zH6M1/profile.json"\n\n`
  );

  const nonces = await fetchAccountNonces({
    url: network.getCoreApiUrl(),
    principal: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  });

  const tx = await makeContractCall({
    ...testUtils.v1RegisterTransfer({
      namespace: asciiToBytes('testable'),
      name: asciiToBytes(name),
      recipient,
    }),
    network,
    nonce: nonces.last_executed_tx_nonce + 1,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    senderKey: privateKey,
    fee: 1000005,
  });

  const result = await broadcastTransaction(tx, network, zonefile);
  if ('error' in result) {
    return res.status(500).send({ error: result });
  }

  return res.status(200).send(result);
}
export default faucetApi;
