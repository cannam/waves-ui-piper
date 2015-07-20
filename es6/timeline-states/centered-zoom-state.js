import BaseState from './base-state';

// broken
export default class CenteredZoomState extends BaseState {
  constructor(timeline) {
    super(timeline);

    this.currentLayer = null;
  }

  handleEvent(e) {
    switch(e.type) {
      case 'mousedown':
        this.onMouseDown(e);
        break;
      case 'mousemove':
        this.onMouseMove(e);
        break;
      case 'mouseup':
        this.onMouseUp(e);
        break;
    }
  }

  onMouseDown(e) {
    this.mouseDown = true;
  }

  onMouseMove(e) {
    if (!this.mouseDown) { return; }

    const timeline = this.timeline;

    // @NOTE: kind of weirdo, but sure how this will beahve if view's timeContext
    // are not consistents
    this.views.forEach(function(view) {
      const timeContext = view.timeContext;
      const lastCenterTime = timeContext.xScale.invert(e.x);

      timeContext.stretchRatio += e.dy / 100;
      timeContext.stretchRatio = Math.max(timeContext.stretchRatio, 0.01);

      const newCenterTime = timeContext.xScale.invert(e.x);
      const delta = newCenterTime - lastCenterTime;
      const offset = timeContext.offset;
      // apply new offset to keep it centered to the mouse
      timeContext.offset += (delta + timeContext.xScale.invert(e.dx));

      // clamp other values here if needed (example: offset <= 0, stretchRatio >= 1, etc...)

      // example keep in container when zoomed out
      // if (timeContext.stretchRatio < 1) {
      //   const minOffset = timeContext.xScale.invert(0);
      //   const maxOffset = timeContext.xScale.invert(view.width - timeContext.xScale(timeContext.duration));

      //   timeContext.offset = Math.max(timeContext.offset, minOffset);
      //   timeContext.offset = Math.min(timeContext.offset, maxOffset);
      // }
    });

    timeline.views.update();
  }

  onMouseUp(e) {
    this.mouseDown = false;
  }
}
