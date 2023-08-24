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
import config from '../config';
import { sendTx } from './newBridge';
import { bcs } from './newBridge';
import { build } from './newBridge';

async function tx() {
  const executor = new Wallet(
    config.l1lcd,
    new MnemonicKey({ mnemonic: config.EXECUTOR_MNEMONIC })
  );

  const sender = executor;
  const moduleName = 'basic_coin';
  const tokenStructTag = `${AccAddress.toHex(
    sender.key.accAddress
  )}::${moduleName}::Coin`;
  console.log(tokenStructTag);
  const executeMsg = [
    // 1. publish coin
    new MsgPublish(
      sender.key.accAddress,
      [
        await build('L1Contracts', moduleName)
      ],
      0
    ),

    // 2. init coin
    // new MsgExecute(
    //     sender.key.accAddress,
    //     sender.key.accAddress,
    //     moduleName,
    //     'init_module',
    //     [],
    //     []
    // )

    // 3. mint coin
    // new MsgExecute(
    //     sender.key.accAddress,
    //     sender.key.accAddress,
    //     moduleName,
    //     'mint',
    //     [],
    //     [
    //         bcs.serialize(BCS.U64, 1000000000),
    //         bcs.serialize(BCS.ADDRESS, sender.key.accAddress),
    //     ]),

    // 4. register coin
    // new MsgExecute(
    //   sender.key.accAddress,
    //   '0x1',
    //   'coin',
    //   'register',
    //   [tokenStructTag],
    //   []
    // )

    // 5. register on bridge
    //   new MsgExecute(
    //     sender.key.accAddress,
    //     '0x1',
    //     'op_bridge',
    //     'register_token',
    //     [config.L2ID, tokenStructTag],
    //     []),
  ];

  await sendTx(config.l1lcd, sender, executeMsg);
}

async function main() {
  await tx();
}

if (require.main === module) {
  main().catch(console.error);
}
