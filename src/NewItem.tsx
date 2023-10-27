import React, { useState } from 'react';
import { TextField, Button, Box } from '@mui/material';

interface NewItemProps {
  onAdd: (item: { txid: string; vout: number; price: number }) => void;
}

const NewItem: React.FC<NewItemProps> = ({ onAdd }) => {
  const [txid, setTxid] = useState('');
  const [vout, setVout] = useState('');
  const [price, setPrice] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onAdd({ txid, vout: Number(vout), price: Number(price) });
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ m: 2}}>
      <TextField
        id="txid"
        label="TXID"
        value={txid}
        onChange={e => setTxid(e.target.value)}
        fullWidth
        margin="normal"
        required
      />
      <TextField
        id="vout"
        label="Output index"
        value={vout}
        onChange={e => setVout(e.target.value)}
        fullWidth
        margin="normal"
        required
      />
      <TextField
        id="price"
        label="Price (BSV)"
        value={price}
        onChange={e => setPrice(e.target.value)}
        fullWidth
        margin="normal"
        type="number"
        required
      />
      <Button type="submit" variant="contained" sx={{ mt: 2 }}>Add New Item</Button>
    </Box>
  );
};

export default NewItem;