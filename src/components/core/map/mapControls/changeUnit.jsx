import React from 'react';
import IconButton from '@mui/material/IconButton';
import ReactDOM from 'react-dom/client';
import Tooltip from '@mui/material/Tooltip';

function ChangeUnitButton({ onClick, unit }) {
  return (
    <Tooltip title='Change Measurement Unit'>
      <IconButton
        className='change-unit map-control-icon'
        onClick={onClick}
        style={{
          backgroundColor: '#fff',
          padding: '6px',
        }}
      >
        {unit}
      </IconButton>
    </Tooltip>
  );
}
export class ChangeUnitControl {
  constructor(mapScaleUnit, setMapScaleUnit) {
    this.map = null;
    this.container = null;
    this.root = null;
    this.unit = mapScaleUnit;
    this._mounted = false;
    this._setMapScaleUnit = setMapScaleUnit;
  }

  onClick = () => {
    if (!this._mounted || !this.map) return;
    this.unit = this.unit === 'km' ? 'mi' : 'km';
    this.updateUI();
    this._setMapScaleUnit(this.unit);
  };

  updateUI() {
    if (this._mounted && this.root) {
      try {
        this.root.render(
          <ChangeUnitButton unit={this.unit} onClick={this.onClick} />
        );
      } catch (error) {
        console.warn('Failed to update UI:', error);
      }
    }
  }

  onAdd(map) {
    try {
      this.map = map;
      this.container = document.createElement('div');
      this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

      // Create root and mark as mounted
      this.root = ReactDOM.createRoot(this.container);
      this._mounted = true;

      // Initial render
      this.updateUI();

      return this.container;
    } catch (error) {
      console.error('Error adding control:', error);
      return document.createElement('div'); // Return empty div in case of error
    }
  }

  onRemove() {
    // Schedule unmount for next tick to avoid race conditions
    setTimeout(() => {
      try {
        this._mounted = false;
        if (this.root) {
          this.root.unmount();
          this.root = null;
        }
        if (this.container && this.container.parentNode) {
          this.container.parentNode.removeChild(this.container);
        }
        this.map = null;
        this.container = null;
      } catch (error) {
        console.warn('Error during cleanup:', error);
      }
    }, 0);
  }
}
