import React from 'react';
import { Button, Card, CardContent, Typography } from '@mui/material';
import { Item } from './contracts/ordinalMarketplaceApp';
import { Addr, bsv, reverseByteString, slice } from 'scrypt-ts';

interface ItemProps {
  item: Item
  idx: number
  myAddr: Addr
  onBuy: (idx: number) => void;
  onConfirm: (idx: number) => void;
  onCancel: (idx: number) => void;
}

const ItemView: React.FC<ItemProps> = ({ item, idx, myAddr, onBuy, onConfirm, onCancel }) => {
  let button: any = undefined

  if (item.hasRequestingBuyer) {
    if (item.sellerAddr == myAddr) {
      button = <Button variant="contained" onClick={() => onConfirm(idx)}>Confirm Request</Button>
    } else if (item.requestingBuyer == myAddr) {
      button = <Button variant="contained" onClick={() => onCancel(idx)}>Cancel Request</Button>
    }
  } else {
    if (item.sellerAddr == myAddr) {
      // TODO: Implement delete item listing
    } else {
      button = <Button variant="contained" onClick={() => onBuy(idx)}>Request Buy</Button>
    }
  }

  return <Card sx={{ minWidth: 275, m: 2}}>
    <CardContent>
      <Typography variant="h5" component="div">
        {reverseByteString(slice(item.outpoint, 0n, 32n), 32n)}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Price: {Number(item.price) / (100 * 10**6)} BSV
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Seller: {bsv.Address.fromHex('6f' + item.sellerAddr).toString()}
      </Typography>
      {button}
    </CardContent>
  </Card>
};

export default ItemView;