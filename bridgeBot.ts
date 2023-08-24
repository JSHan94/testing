import {
  Wallet,
  MnemonicKey,
  BCS,
  LCDClient,
  TxInfo,
  Msg,
  AccAddress,
  MsgSend,
  Coin
} from '@initia/minitia.js';

import { MsgExecute } from '@initia/minitia.js';
import axios from 'axios';
import config from '../config';
import { delay } from 'bluebird';
import { bcs, executor, to } from './newBridge';

class Bot {
  // l1coin = `${AccAddress.toHex(executor.key.accAddress)}::basic_coin::Coin`;
  l1coin = '0x1::native_uinit::Coin';
  l1sender = executor;
  async sendTx(client, sender, msg) {
    try {
      const signedTx = await sender.createAndSignTx({ msgs: msg });
      const broadcastResult = await client.tx.broadcast(signedTx);
      await this.checkTx(client, broadcastResult.txhash);
      console.log(msg)
      console.log(broadcastResult.txhash);
      return broadcastResult.txhash;
    } catch (error) {
      console.log(error);
      throw new Error(`Error in sendTx: ${error}`);
    }
  }

  async checkTx(lcd, txHash: string, timeout = 60000): Promise<any> {
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

  public async start() {
    console.log('Bot started');
  }

  public async stop() {
    console.log('Bot stopped');
  }

  // L1 task
  async deposit() {
    const msg = new MsgExecute(
      this.l1sender.key.accAddress,
      '0x1',
      'op_bridge',
      'deposit_token',
      [config.L2ID, this.l1coin],
      [
        bcs.serialize('address', to.key.accAddress),
        bcs.serialize('u64', 1_000)
      ]
    );

    await this.sendTx(config.l1lcd, this.l1sender, [msg]);
  }

  // L2 task
  async withdrawal() {
    const l2to = new Wallet(
      config.l2lcd,
      new MnemonicKey({
        mnemonic:
          // executor
          // 'recycle sight world spoon leopard shine dizzy before public use jungle either arctic detail hawk output option august hedgehog menu keen night work become'
          // // user2
          'file body gasp outside good urban river custom employ supreme ask shoe volcano stamp powder wonder sell balance slab coin mushroom debate funny license'
      })
    );

    const res = await axios.get(`${config.EXECUTOR_URI}/coin/${this.l1coin}`);
    const l2coin = res.data.coin.l2StructTag;
    
    const msg = new MsgExecute(
      l2to.key.accAddress,
      '0x1',
      'op_bridge',
      'withdraw_token',
      [l2coin],
      [
        bcs.serialize('address', l2to.key.accAddress), 
        bcs.serialize('u64', 500)
      ]
    );
    await this.sendTx(config.l2lcd, l2to, [msg]);
  }

  // L2 task
  async sendCoin() {
    const l2from = new Wallet(
      config.l2lcd,
      new MnemonicKey({
        mnemonic:
          // executor
          'recycle sight world spoon leopard shine dizzy before public use jungle either arctic detail hawk output option august hedgehog menu keen night work become'
      })
    );
    const l2to = new Wallet(
      config.l2lcd,
      new MnemonicKey({
        mnemonic:
          // executor
          // 'recycle sight world spoon leopard shine dizzy before public use jungle either arctic detail hawk output option august hedgehog menu keen night work become'
          // user2
          'file body gasp outside good urban river custom employ supreme ask shoe volcano stamp powder wonder sell balance slab coin mushroom debate funny license'
      })
    );

    const res = await axios.get(`${config.EXECUTOR_URI}/coin/${this.l1coin}`);
    const l2Denom = res.data.coin.l2Denom;

    const msg = new MsgSend(
      l2from.key.accAddress,
      l2to.key.accAddress,
      [new Coin(l2Denom, 500)]
    )

    await this.sendTx(config.l2lcd, l2from, [msg]);
  }
}



async function main() {
  const bot = new Bot();
  await bot.start();
  let i = 0;
  for (; i < 100; ) {
    console.log('Loop: ', ++i);

    await bot.deposit();
    await delay(5000);
    await bot.withdrawal();

    await delay(5000);
  }
  // await bot.stop();
}

if (require.main === module) {
  main().catch(console.log);
}
