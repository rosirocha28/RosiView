/**
 * RosiView — Touch & Gesture Controller (Mobile & Tablet)
 * Gerenciador de gestos multitouch: Pinch-to-Zoom e Pan com 2 dedos
 * nos painéis Frontal e de Diagrama de Blocos.
 */

export class TouchGestureHandler {
  /**
   * Ativa suporte a Pinch-to-Zoom e Pan em um container
   * @param {HTMLElement} containerEl - O elemento com overflow/scroll que recebe os toques
   * @param {HTMLElement} targetZoomEl - O elemento interno que recebe o scale/transform
   * @param {Object} options - Configurações opcionais (minScale, maxScale, onZoom)
   */
  static attachPinchZoom(containerEl, targetZoomEl, options = {}) {
    if (!containerEl || !targetZoomEl) return null;

    const minScale = options.minScale || 0.4;
    const maxScale = options.maxScale || 2.8;
    let currentScale = options.initialScale || 1.0;

    let initialDist = 0;
    let lastDist = 0;
    let lastCenter = { x: 0, y: 0 };
    let isPinching = false;

    // Garante que o targetZoomEl tenha transform-origin adequado
    targetZoomEl.style.transformOrigin = '0 0';
    targetZoomEl.style.transition = 'none';

    function getTouchDistance(t1, t2) {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.hypot(dx, dy);
    }

    function getTouchCenter(t1, t2) {
      return {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2
      };
    }

    function applyScale(newScale, focalX, focalY) {
      const prevScale = currentScale;
      currentScale = Math.min(Math.max(newScale, minScale), maxScale);

      // Ajusta scroll para que o zoom ocorra focado nos dedos
      if (focalX !== undefined && focalY !== undefined && prevScale !== currentScale) {
        const rect = containerEl.getBoundingClientRect();
        const offsetX = focalX - rect.left;
        const offsetY = focalY - rect.top;

        const ratio = currentScale / prevScale;
        containerEl.scrollLeft = (containerEl.scrollLeft + offsetX) * ratio - offsetX;
        containerEl.scrollTop = (containerEl.scrollTop + offsetY) * ratio - offsetY;
      }

      targetZoomEl.style.transform = `scale(${currentScale})`;

      if (typeof options.onZoom === 'function') {
        options.onZoom(currentScale);
      }
    }

    containerEl.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        isPinching = true;
        initialDist = getTouchDistance(e.touches[0], e.touches[1]);
        lastDist = initialDist;
        lastCenter = getTouchCenter(e.touches[0], e.touches[1]);
        e.preventDefault();
      }
    }, { passive: false });

    containerEl.addEventListener('touchmove', (e) => {
      if (isPinching && e.touches.length === 2) {
        const dist = getTouchDistance(e.touches[0], e.touches[1]);
        const center = getTouchCenter(e.touches[0], e.touches[1]);

        if (lastDist > 0 && Math.abs(dist - lastDist) > 1) {
          const factor = dist / lastDist;
          applyScale(currentScale * factor, center.x, center.y);
        }

        // Pan com 2 dedos
        const deltaX = center.x - lastCenter.x;
        const deltaY = center.y - lastCenter.y;
        containerEl.scrollLeft -= deltaX;
        containerEl.scrollTop -= deltaY;

        lastDist = dist;
        lastCenter = center;
        e.preventDefault();
      }
    }, { passive: false });

    const endPinch = (e) => {
      if (e.touches.length < 2) {
        isPinching = false;
        initialDist = 0;
        lastDist = 0;
      }
    };

    containerEl.addEventListener('touchend', endPinch);
    containerEl.addEventListener('touchcancel', endPinch);

    // Retorna API para controle externo ou reset
    return {
      getScale: () => currentScale,
      setScale: (s) => applyScale(s),
      reset: () => applyScale(1.0)
    };
  }
}
