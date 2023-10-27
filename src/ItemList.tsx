import React from 'react';
import { Box } from '@mui/material';
import ItemView from './ItemView';
import { Item } from './contracts/ordinalMarketplaceApp';
import { Addr } from 'scrypt-ts';

interface ItemListProps {
  items: Item[];
  myAddr: Addr;
  onBuy: (idx: number) => void;
  onConfirm: (idx: number) => void;
  onCancel: (idx: number) => void;
}

const ItemList: React.FC<ItemListProps> = ({ items, myAddr, onBuy, onConfirm, onCancel }) => (
  <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
    {items.map((item, idx) => (
      !item.isEmptySlot && <ItemView key={idx} myAddr={myAddr} item={item} idx={idx} 
      onBuy={onBuy} onConfirm={onConfirm} onCancel={onCancel} />
    ))}
  </Box>
);

export default ItemList;