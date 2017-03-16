import BaseShape from './base-shape';


/**
 * A shape to display a line. Its main use is as common shape to create a
 * breakpoint visualization. (entity shape)
 *
 * [example usage](./examples/layer-breakpoint.html)
 */
export default class Line extends BaseShape {
  getClassName() { return 'line'; }

  _getAccessorList() {
    return { cx: 0, cy: 0 };
  }

  _getDefaults() {
    return { color: '#000000' };
  }

  render(renderingContext) {
    if (this.$el) { return this.$el; }

    this.$el = document.createElementNS(this.ns, 'path');
    // this.el.setAttributeNS(null, 'shape-rendering', 'crispEdges');
    return this.$el;
  }

  update(renderingContext, data) {
    
    const before = performance.now();

    data = data.slice(0);
    data.sort((a, b) => this.cx(a) < this.cx(b) ? -1 : 1);

    const minX = Math.floor(renderingContext.minX);
    const maxX = Math.floor(renderingContext.maxX);

    let instructions = [];
    const n = data.length;

    if (n > 0) {

      // We want to start with the last element to the left of the
      // visible region, and end with the first element beyond the
      // right of it
      
      let nextX = renderingContext.timeToPixel(this.cx(data[0]));
    
      for (let i = 0; i < n; ++i) {

        const x = nextX;

        if (i + 1 < n) {
          nextX = renderingContext.timeToPixel(this.cx(data[i+1]));
        }
        if (nextX < minX) {
          continue;
        }

        const y = renderingContext.valueToPixel(this.cy(data[i])) - 0.5;

        instructions.push(`${x},${y}`);
        
        if (x > maxX) {
          break;
        }
      }
    }          

    console.log("line instructions have " + instructions.length + " elements");
    
    this.$el.setAttributeNS(null, 'd', 'M' + instructions.join('L'));

    this.$el.style.stroke = this.params.color;
    this.$el.style.strokeWidth = 2;
    this.$el.style.fill = 'none';

    const after = performance.now();
    console.log("line update time = " + Math.round(after - before));
    
    data = null;
  }

  // builds the `path.d` attribute
  // @TODO create some ShapeHelper ?
  _buildLine(renderingContext, data) {
    if (!data.length) { return ''; }
    // sort data
    let instructions = data.map((datum, index) => {
      const x = renderingContext.timeToPixel(this.cx(datum));
      const y = renderingContext.valueToPixel(this.cy(datum)) - 0.5;
      return `${x},${y}`;
    });

    return 'M' + instructions.join('L');
  }
}
