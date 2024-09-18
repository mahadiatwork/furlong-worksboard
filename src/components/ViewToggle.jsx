import React, { useState } from 'react';
import { Button, ButtonGroup } from '@mui/material';

function ViewToggle({view, setView}) {

  return (
    <ButtonGroup variant="outlined" aria-label="outlined button group">
      <Button
        onClick={() => setView('month')}
        style={{
          backgroundColor: view === 'month' ? '#0b1a51' : '#fff',
          color: view === 'month' ? '#fff' : '#0b1a51',
          borderColor: '#0b1a51',
          textTransform: 'none',
        }}
      >
        Month view
      </Button>
      <Button
        onClick={() => setView('week')}
        style={{
          backgroundColor: view === 'week' ? '#0b1a51' : '#fff',
          color: view === 'week' ? '#fff' : '#0b1a51',
          borderColor: '#0b1a51',
          textTransform: 'none',
        }}
      >
        Week view
      </Button>
    </ButtonGroup>
  );
}

export default ViewToggle;
