import IconButton from '@mui/material/IconButton';
import ReactDOM from 'react-dom/client';
import Tooltip from '@mui/material/Tooltip';
import MenuIcon from '@mui/icons-material/Menu';

function HamburgerIcon({ onClickHandler }) {
  return (
    <Tooltip title='Toggle Drawer'>
      <IconButton className='menu-open-icon' onClick={onClickHandler}>
        <MenuIcon className='map-control-icon' />
      </IconButton>
    </Tooltip>
  );
}

export class HamburgerControl {
  constructor(onHamburgerClick) {
    this._onClick = onHamburgerClick;
    this.root = null;
    this.isMounted = true;
  }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
    const root = ReactDOM.createRoot(this._container);
    root.render(<HamburgerIcon onClickHandler={this._onClick} />);
    this.root = root;
    return this._container;
  }

  onRemove() {
    setTimeout(() => {
      try {
        this.isMounted = false;
        this.root.unmount();
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
      } catch (err) {
        console.error('Error adding control:', err);
      }
    }, 0);
  }
}
