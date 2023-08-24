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
import { bcs } from './newBridge';
import { init } from '@sentry/node';
import config from '../config';
import { BridgeConfig } from 'lib/types';
import { delay } from 'bluebird';
import { send } from 'process';
import { MoveBuilder } from '@initia/builder.js';
import { dir } from 'console';
import { sendTx } from './newBridge';

export interface TxResponse {
    coin_type: string;
    sequence: number;
    sender: string;
    receiver: string;
    amount: number;
    outputIndex: number;
    merkleRoot: string;
    merkleProof: string[];
  }
  
  export interface OutputResponse {
    outputIndex: number;
    outputRoot: string;
    stateRoot: string;
    storageRoot: string;
    lastBlockHash: string;
    checkpointBlockHeight: number;
  }
  

async function makeFinalizeMsg(
    sender: Wallet,
    txRes: TxResponse,
    outputRes: OutputResponse
  ): Promise<Msg> {
    const msg = new MsgExecute(
      sender.key.accAddress,
      '0x1',
      'op_bridge',
      'finalize_token_bridge',
      [config.L2ID, '0x1::native_uinit::Coin'],
      [
        bcs.serialize('u64', outputRes.outputIndex), // output index
        bcs.serialize(
          'vector<vector<u8>>',
          txRes.merkleProof.map((proof: string) => Buffer.from(proof, 'hex'))
        ), // withdrawal proofs  (tx table)
  
        // withdraw tx data  (tx table)
        bcs.serialize('u64', txRes.sequence), // l2_sequence (txEntity sequence)
        bcs.serialize('address', txRes.sender), // sender
        bcs.serialize('address', txRes.receiver), // receiver
        bcs.serialize('u64', txRes.amount), // amount
        
  
        // output root proof (output table)
        bcs.serialize('vector<u8>', Buffer.from(outputRes.outputIndex.toString(), 'utf8')), //version (==output index)
        bcs.serialize('vector<u8>', Buffer.from(outputRes.stateRoot, 'base64')), // state_root
        bcs.serialize('vector<u8>', Buffer.from(outputRes.storageRoot, 'hex')), // storage root
        bcs.serialize(
          'vector<u8>',
          Buffer.from(outputRes.lastBlockHash, 'base64')
        ) // latests block hash
      ]
    );
    return msg;
  }
  

async function getTx(coin: string, sequence: number): Promise<TxResponse> {
    const url = `${config.EXECUTOR_URI}/tx/${coin}/${sequence}`;

    const res = await axios.get(url);
    return res.data;
}

async function getOutput(outputIndex: number): Promise<OutputResponse> {
    const url = `${config.EXECUTOR_URI}/output/${outputIndex}`;
    const res = await axios.get(url);
    return res.data;
}

async function claim(sender: Wallet, coinType: string, txSequence: number, outputIndex: number){
    const txRes = await getTx(coinType,txSequence);
    const outputRes: any = await getOutput(outputIndex);
    console.log(txRes)
    console.log(outputRes)
    const finalizeMsg = await makeFinalizeMsg(sender, txRes, outputRes.output);
    await sendTx(config.l1lcd, sender, [finalizeMsg]);
}

async function main() {
    const sender = new Wallet(
        config.l1lcd,
        new MnemonicKey({
          mnemonic:
            // user2
            'file body gasp outside good urban river custom employ supreme ask shoe volcano stamp powder wonder sell balance slab coin mushroom debate funny license'
        })
    );
    await claim(sender, '0x1::native_uinit::Coin', 1,0);
}

if (require.main === module) {
    main().catch(console.error);
}  
