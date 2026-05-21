'use strict';

import { resizeCanvases, renderWaveformPreviewSimulated, renderLoop } from './canvas.js';
import './controls.js';

function init() {
  resizeCanvases();
  renderLoop();

  setTimeout(() => {
    renderWaveformPreviewSimulated('A');
    renderWaveformPreviewSimulated('B');
  }, 300);
}

window.addEventListener('load', init);
