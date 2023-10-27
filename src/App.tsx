import React, { useEffect, useRef, useState } from 'react';
import ItemList from './ItemList';
import NewItem from './NewItem';
import { ScryptProvider, SensiletSigner, Scrypt, ContractCalledEvent, toByteString, MethodCallOptions, hash160, reverseByteString, int2ByteString, Addr, bsv, Utils, pubKey2Addr, slice, byteString2Int, UTXO, PubKey, findSig, SignatureResponse, StatefulNext } from 'scrypt-ts';
import { Item, OrdinalMarketplace } from './contracts/ordinalMarketplaceApp';

// `npm run deploycontract` to get deployment transaction id
const contract_id = {
  /** The deployment transaction id */
  txId: "b5fa4d938a537c115f87cec51ae6789df50082b47c1f216d1ec7a1048166ff92",
  /** The output index */
  outputIndex: 0,
};

const App: React.FC = () => {
  const signerRef = useRef<SensiletSigner>();

  const [contractInstance, setContract] = useState<OrdinalMarketplace>();
  const [myAddr, setMyAddr] = useState<Addr>();

  useEffect(() => {
    const provider = new ScryptProvider();
    const signer = new SensiletSigner(provider);

    signerRef.current = signer;

    fetchWalletInfo(signer)
    fetchContract()

    const subscription = Scrypt.contractApi.subscribe(
      {
        clazz: OrdinalMarketplace,
        id: contract_id,
      },
      (event: ContractCalledEvent<OrdinalMarketplace>) => {
        setContract(event.nexts[0]);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);


  async function fetchWalletInfo(signer: SensiletSigner) {
    const publicKey = await signer.getDefaultPubKey()
    setMyAddr(hash160(publicKey.toByteString()))
  }

  async function fetchContract() {
    try {
      const instance = await Scrypt.contractApi.getLatestInstance(
        OrdinalMarketplace,
        contract_id
      );
      setContract(instance)
    } catch (error: any) {
      console.error("fetchContract error: ", error);
    }
  }

  const handleAdd = async (newItem: { txid: string; vout: number, price: number }) => {
    const signer = signerRef.current as SensiletSigner;

    if (contractInstance && signer) {
      const { isAuthenticated, error } = await signer.requestAuth();
      if (!isAuthenticated) {
        throw new Error(error);
      }

      await contractInstance.connect(signer);

      // Create the next instance from the current.
      const nextInstance = contractInstance.next();

      // Construct new item object.
      const sellerAddr = myAddr!
      const outpoint = reverseByteString(toByteString(newItem.txid), 32n) +
        int2ByteString(BigInt(newItem.vout), 4n)

      const toAdd: Item = {
        outpoint: outpoint,
        price: BigInt(newItem.price * 100 * 10 ** 6),
        sellerAddr,
        isEmptySlot: false,
        hasRequestingBuyer: false,
        requestingBuyer: Addr(toByteString('0000000000000000000000000000000000000000'))
      }

      // Find first empty slot and insert new item.
      let itemIdx = undefined
      for (let i = 0; i < OrdinalMarketplace.ITEM_SLOTS; i++) {
        const item = contractInstance.items[i]
        if (item.isEmptySlot) {
          itemIdx = BigInt(i)
          nextInstance.items[i] = toAdd
          break
        }
      }

      if (itemIdx === undefined) {
        console.error('All item slots are filled.')
        return
      }

      // Call the method of current instance to apply the updates on chain.
      contractInstance.methods
        .listItem(
          toAdd,
          itemIdx,
          {
            next: {
              instance: nextInstance,
              balance: contractInstance.balance,
            },
          }
        )
        .then((result) => {
          console.log(`Add item call tx: ${result.tx.id}`);
        })
        .catch((e) => {
          console.error("Add item call error: ", e);
        });
    }
  };

  const handleBuyRequest = async (idx: number) => {
    const signer = signerRef.current as SensiletSigner;

    if (contractInstance && signer) {
      const { isAuthenticated, error } = await signer.requestAuth();
      if (!isAuthenticated) {
        throw new Error(error);
      }

      await contractInstance.connect(signer);

      const itemPrice = Number(contractInstance.items[idx].price)

      // Create the next instance from the current.
      const nextInstance = contractInstance.next()
      nextInstance.items[idx].hasRequestingBuyer = true
      nextInstance.items[idx].requestingBuyer = myAddr!

      // Call the method of current instance to apply the updates on chain.
      contractInstance.methods
        .requestBuy(
          BigInt(idx),
          myAddr,
          {
            next: {
              instance: nextInstance,
              balance: contractInstance.balance + itemPrice,
            },
          }
        )
        .then((result) => {
          console.log(`Buy request call tx: ${result.tx.id}`);
        })
        .catch((e) => {
          console.error("Buy request call error: ", e);
        });
    }
  };


  const handleOnConfirm = async (idx: number) => {
    const signer = signerRef.current as SensiletSigner;

    if (contractInstance && signer) {
      const { isAuthenticated, error } = await signer.requestAuth();
      if (!isAuthenticated) {
        throw new Error(error);
      }

      await contractInstance.connect(signer);

      // Fetch ordinal TX and extract UTXO.
      const outpoint = contractInstance.items[idx].outpoint
      const ordinalTxid = reverseByteString(slice(outpoint, 0n, 32n), 32n)
      const ordinalVout = Number(byteString2Int(slice(outpoint, 32n, 36n)))

      const tx = await signer.provider!.getTransaction(ordinalTxid)
      const out = tx.outputs[ordinalVout]

      const ordinalUTXO: UTXO = {
        address: contractInstance.items[idx].sellerAddr,
        txId: ordinalTxid,
        outputIndex: ordinalVout,
        script: out.script.toHex(),
        satoshis: out.satoshis,
      }

      console.log(ordinalUTXO)


      //const ordinalInstance = await OrdiNFTP2PKH.getLatestInstance(ordinalTxid.toString() + ordinalVout.toString());
      //console.log(ordinalInstance.utxo)
      //
      //const ordinalUTXO = ordinalInstance.utxo

      // Create the next instance from the current.
      const nextInstance = contractInstance.next();

      // Bind custom call tx builder
      contractInstance.bindTxBuilder(
        'confirmBuy',
        async (
          current: OrdinalMarketplace,
          options: MethodCallOptions<OrdinalMarketplace>
        ) => {
          const unsignedTx: bsv.Transaction = new bsv.Transaction()

          // Add input that unlocks ordinal UTXO.
          unsignedTx
            .addInput(
              new bsv.Transaction.Input({
                prevTxId: ordinalUTXO.txId,
                outputIndex: ordinalUTXO.outputIndex,
                script: bsv.Script.fromHex('00'.repeat(34)), // Dummy script
              }),
              bsv.Script.fromHex(ordinalUTXO.script),
              ordinalUTXO.satoshis
            )
            .addInput(current.buildContractInput())

          // Build ordinal destination output.
          unsignedTx
            .addOutput(
              new bsv.Transaction.Output({
                script: bsv.Script.fromHex(
                  Utils.buildPublicKeyHashScript(
                    current.items[idx].requestingBuyer
                  )
                )
                ,
                satoshis: 1,
              })
            )
            // Build seller payment output.
            .addOutput(
              new bsv.Transaction.Output({
                script: bsv.Script.fromHex(
                  Utils.buildPublicKeyHashScript(
                    current.items[idx].sellerAddr
                  )
                ),
                satoshis: current.utxo.satoshis,
              })
            )

          if (options.changeAddress) {
            unsignedTx.change(options.changeAddress)
          }

          return Promise.resolve({
            tx: unsignedTx,
            atInputIndex: 1,
            nexts: [],
          })
        }
      )

      let contractTx = await contractInstance.methods.confirmBuy(
        BigInt(idx),
        {
          partiallySigned: true,
          exec: false, // Do not execute the contract yet, only get the created calling transaction.
        } as MethodCallOptions<OrdinalMarketplace>
      )

      // If we would like to broadcast, here we need to sign ordinal UTXO input.


      // TODO

    }
  };


  const handleCancel = async (idx: number) => {
    const signer = signerRef.current as SensiletSigner;

    if (contractInstance && signer) {
      const { isAuthenticated, error } = await signer.requestAuth();
      if (!isAuthenticated) {
        throw new Error(error);
      }

      await contractInstance.connect(signer);

      const itemPrice = Number(contractInstance.items[idx].price)

      // Create the next instance from the current.
      const nextInstance = contractInstance.next()
      nextInstance.items[idx].hasRequestingBuyer = false
      nextInstance.items[idx].requestingBuyer = Addr(toByteString('0000000000000000000000000000000000000000'))


      // Bind custom call tx builder.
      contractInstance.bindTxBuilder(
        'cancelBuy',
        async (
          current: OrdinalMarketplace,
          options: MethodCallOptions<OrdinalMarketplace>
        ) => {
          const unsignedTx: bsv.Transaction = new bsv.Transaction()
          
          const next = options.next as StatefulNext<OrdinalMarketplace>

          unsignedTx
            .addInput(current.buildContractInput())
            .addOutput(
              new bsv.Transaction.Output({
                script: next.instance.lockingScript,
                satoshis: current.utxo.satoshis - itemPrice,
              })
            )
            // Build buyer refund output.
            .addOutput(
              new bsv.Transaction.Output({
                script: bsv.Script.fromHex(
                  Utils.buildPublicKeyHashScript(
                    current.items[idx].requestingBuyer
                  )
                ),
                satoshis: itemPrice,
              })
            )

          if (options.changeAddress) {
            unsignedTx.change(options.changeAddress)
          }
          
          return Promise.resolve({
            tx: unsignedTx,
            atInputIndex: 0,
            nexts: [],
          })
        }
      )

      // Call the method of current instance to apply the updates on chain.
      const myPublicKey = await signer.getDefaultPubKey()
      contractInstance.methods
        .cancelBuy(
          BigInt(idx),
          PubKey(myPublicKey.toByteString()),
          (sigResps: SignatureResponse[]) => findSig(sigResps, myPublicKey),
          {
            pubKeyOrAddrToSign: myPublicKey,
            changeAddress: myPublicKey.toAddress(),
            next: {
              instance: nextInstance,
              balance: contractInstance.balance - itemPrice,
            },
          } as MethodCallOptions<OrdinalMarketplace>
        )
        .then((result) => {
          console.log(`Buy request call tx: ${result.tx.id}`);
        })
        .catch((e) => {
          console.error("Buy request call error: ", e);
        });
    }
  }

  return (
    myAddr ? (
      <div>
        <NewItem onAdd={handleAdd} />
        <ItemList items={contractInstance ? contractInstance.items as Item[] : []} myAddr={myAddr}
          onBuy={handleBuyRequest} onConfirm={handleOnConfirm} onCancel={handleCancel} />
      </div>
    ) : null
  );
};

export default App;