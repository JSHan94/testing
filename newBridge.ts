import {
  AccAddress,
  Coin,
  MsgExecute,
  MsgPublish,
  MsgSend,
  MsgDeposit
} from '@initia/initia.js';
import {
  Wallet,
  MnemonicKey,
  BCS,
  LCDClient,
  TxInfo,
  Msg
} from '@initia/initia.js';
import axios from 'axios';

import { init } from '@sentry/node';
import config from '../config';
import { BridgeConfig } from 'lib/types';
import { delay } from 'bluebird';
import { send } from 'process';
import { MoveBuilder } from '@initia/builder.js';
import { dir } from 'console';

export const bcs = BCS.getInstance();

export async function sendTx(client: LCDClient, sender: Wallet, msg: Msg[]) {
  try {
    const signedTx = await sender.createAndSignTx({ msgs: msg });
    const broadcastResult = await client.tx.broadcast(signedTx);
    console.log(broadcastResult);
    await checkTx(client, broadcastResult.txhash);
    return broadcastResult.txhash;
  } catch (error) {
    console.log(error?.response?.data);
    throw new Error(`Error in sendTx: ${error}`);
  }
}

export async function checkTx(
  lcd: LCDClient,
  txHash: string,
  timeout = 60000
): Promise<TxInfo | undefined> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    try {
      const txInfo = await lcd.tx.txInfo(txHash);
      if (txInfo) return txInfo;
      await delay(1000);
    } catch (err) {
      throw new Error(`Failed to check transaction status: ${err.message}`);
    }
  }

  throw new Error('Transaction checking timed out');
}

/// outputSubmitter -> op_output/initialize
/// executor -> op_bridge/initialize
export async function build(dirname: string, moduleName: string) {
  const builder = new MoveBuilder(__dirname + `/${dirname}`, {});
  await builder.build();
  const contract = await builder.get(moduleName);
  return contract.toString('base64');
}

// user1
export const from = new Wallet(
  config.l1lcd,
  new MnemonicKey({
    mnemonic:
      'stumble much civil surface carry warm suspect print title toe else awake what increase extend island acoustic educate speak viable month brown valve profit'
  })
);

// user2
export const to = new Wallet(
  config.l1lcd,
  new MnemonicKey({
    mnemonic:
      'file body gasp outside good urban river custom employ supreme ask shoe volcano stamp powder wonder sell balance slab coin mushroom debate funny license'
  })
);

export const executor = new Wallet(
  config.l1lcd,
  new MnemonicKey({ mnemonic: config.EXECUTOR_MNEMONIC })
);
export const challenger = new Wallet(
  config.l1lcd,
  new MnemonicKey({ mnemonic: config.CHALLENGER_MNEMONIC })
);
export const outputSubmitter = new Wallet(
  config.l1lcd,
  new MnemonicKey({ mnemonic: config.OUTPUT_SUBMITTER_MNEMONIC })
);

async function publishL2ID(dirname: string, moduleName: string) {
  const sender = executor;
  const module = await build(dirname, moduleName);
  const executeMsg = [new MsgPublish(sender.key.accAddress, [module], 0)];
  await sendTx(config.l1lcd, sender, executeMsg);
}

async function bridgeInitialize() {
  const sender = executor;
  const executeMsg = [
    new MsgExecute(
      sender.key.accAddress,
      '0x1',
      'op_bridge',
      'initialize',
      [config.L2ID],
      []
    )
  ];
  await sendTx(config.l1lcd, sender, executeMsg);
}

async function outputInitialize(
  submissionInterval: number,
  finalizedTime: number,
  l2BlockHeight: number
) {
  const sender = executor;
  const executeMsg = [
    new MsgExecute(
      sender.key.accAddress,
      '0x1',
      'op_output',
      'initialize',
      [config.L2ID],
      [
        bcs.serialize('u64', submissionInterval),
        bcs.serialize('address', outputSubmitter.key.accAddress),
        bcs.serialize('address', challenger.key.accAddress),
        bcs.serialize('u64', finalizedTime),
        bcs.serialize('u64', l2BlockHeight)
      ]
    )
  ];
  await sendTx(config.l1lcd, sender, executeMsg);
}

async function bridgeRegisterToken(coinType: string) {
  const sender = executor;
  const executeMsg = [
    new MsgExecute(
      sender.key.accAddress,
      '0x1',
      'op_bridge',
      'register_token',
      [config.L2ID, coinType],
      []
    )
  ];
  await sendTx(config.l1lcd, sender, executeMsg);
}

async function tx() {
  const tag = (config.L2ID).split("::")[1]
  
  await publishL2ID('L1Contracts', tag);
  await delay(7000);
  console.log("publish L2ID done")

  await bridgeInitialize();
  await delay(7000);
  console.log("initialize bridge done")
  
  await outputInitialize(1000, 600, 4000);
  await delay(7000);
  console.log("setup bridge and output done")

  await bridgeRegisterToken(
    `0x1::native_uinit::Coin`
    // `${AccAddress.toHex(executor.key.accAddress)}::basic_coin::Coin`
  );
  console.log('register token done');
}

async function main() {
  await tx();
}

if (require.main === module) {
  main().catch(console.error);
}