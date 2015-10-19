import events from 'events';

import Keyboard from '../interactions/keyboard';
import LayerTimeContext from './layer-time-context';
import Surface from '../interactions/surface';
import TimelineTimeContext from './timeline-time-context';
import Track from './track';
import TrackCollection from './track-collection';


/**
 * The `timeline` is the main entry point of a temporal visualization, it:
 *
 * - contains factories to manage its `tracks` and `layers`,
 * - get or set the view window overs its `tracks` through `offset`, `zoom`, `pixelsPerSecond`, `visibleWidth`,
 * - is the central hub for all user interaction events (keyboard, mouse),
 * - holds the current interaction `state` which defines how the different timeline elements (tracks, layers, shapes) respond to user interactions.
 *
 * ```js
 * const with = 500; // default with for all created `Track`
 * const duration = 10; // the timeline should dislay 10 second of data
 * const pixelsPerSeconds = width / duration;
 * const timeline = new ui.core.Timeline(pixelsPerSecond, width);
 * ```
 */
export default class Timeline extends events.EventEmitter {
  /**
   * Creates a new `Timeline` instance
   * @param {Number} [pixelsPerSecond=100] - the number of pixels per seconds the timeline should display
   * @param {Number} [visibleWidth=1000] - the default visible width for all the tracks
   */
  constructor(pixelsPerSecond = 100, visibleWidth = 1000, {
    registerKeyboard = true
  } = {}) {

    super();

    this._tracks = new TrackCollection(this);
    this._state = null;

    // default interactions
    this._surfaceCtor = Surface;

    if (registerKeyboard) {
      this.createInteraction(Keyboard, document);
    }

    // stores
    this._trackById = {};
    this._groupedLayers = {};

    /**
     * @this Timeline
     * @attribute {TimelineTimeContext} - master time context of the graph
     */
    this.timeContext = new TimelineTimeContext(pixelsPerSecond, visibleWidth);
  }

  /**
   * updates `TimeContext`'s offset
   * @attribute {Number} [offset=0]
   */
  get offset() {
    return this.timeContext.offset;
  }

  set offset(value) {
    this.timeContext.offset = value;
  }

  get zoom() {
    return this.timeContext.zoom;
  }

  set zoom(value) {
    this.timeContext.zoom = value;
  }

  get pixelsPerSecond() {
    return this.timeContext.pixelsPerSecond;
  }

  set pixelsPerSecond(value) {
    this.timeContext.pixelsPerSecond = value;
  }

  get visibleWidth() {
    return this.timeContext.visibleWidth;
  }

  set visibleWidth(value) {
    this.timeContext.visibleWidth = value;
  }

  get timeToPixel() {
    return this.timeContext.timeToPixel;
  }

  /**
   *  @readonly
   */
  get visibleDuration() {
    return this.timeContext.visibleDuration;
  }

  // @NOTE maybe expose as public instead of get/set for nothing...
  set maintainVisibleDuration(bool) {
    this.timeContext.maintainVisibleDuration = bool;
  }

  get maintainVisibleDuration() {
    return this.timeContext.maintainVisibleDuration;
  }

  // @readonly - used in track collection
  get groupedLayers() {
    return this._groupedLayers;
  }

  /**
   *  Override the default Surface that is instanciated on each
   *  @param {EventSource} ctor - the constructor to use to build surfaces
   */
  configureSurface(ctor) {
    this._surfaceCtor = ctor;
  }

  /**
   * Factory method to add interaction modules the timeline should listen to.
   * By default, the timeline listen to Keyboard, and instanciate a `Surface` on each container.
   * Can be used to install any interaction implementing the `EventSource` interface
   * @param {EventSource} ctor - the contructor of the interaction module to instanciate
   * @param el {DOMElement} the DOM element to bind to the EventSource module
   * @param options {Object} options to be applied to the ctor (defaults to `{}`)
   */
  createInteraction(ctor, el, options = {}) {
    const interaction = new ctor(el, options);
    interaction.on('event', (e) => this._handleEvent(e));
  }

  /**
   * returns an array of the layers which positions
   * and sizes matches a pointer Event
   * @param {WavesEvent} e - the event from the Surface
   * @return {Array} - matched layers
   */
  getHitLayers(e) {
    const clientX = e.originalEvent.clientX;
    const clientY = e.originalEvent.clientY;
    let layers = [];

    this.layers.forEach((layer) => {
      if (!layer.params.hittable) { return; }
      const br = layer.$el.getBoundingClientRect();

      if (
        clientX > br.left && clientX < br.right &&
        clientY > br.top && clientY < br.bottom
      ) {
        layers.push(layer);
      }
    });

    return layers;
  }

  /**
   * The callback that is used to listen to interactions modules
   * @params {Event} e - a custom event generated by interaction modules
   */
  _handleEvent(e) {
    const hitLayers = (e.source === 'surface') ?
      this.getHitLayers(e) : null;
    // emit event as a middleware
    this.emit('event', e, hitLayers);
    // propagate to the state
    if (!this._state) { return; }
    this._state.handleEvent(e, hitLayers);
  }

  /**
   * Changes the state of the timeline
   * @param {BaseState} - the state in which the timeline must be setted
   */
  set state(state) {
    if (this._state) { this._state.exit(); }
    this._state = state;
    if (this._state) { this._state.enter(); }
  }

  get state() {
    return this._state;
  }

  /**
   *  Shortcut to access the Track collection
   *  @return {TrackCollection}
   */
  get tracks() {
    return this._tracks;
  }

  /**
   * Shortcut to access the Layer list
   * @return {Array}
   */
  get layers() {
    return this._tracks.layers;
  }

  /**
   * Adds a track to the timeline
   * Tracks display a view window on the timeline in theirs own SVG element.
   * @param {Track} track
   */
  add(track) {
    if (this.tracks.indexOf(track) !== -1) {
      throw new Error('track already added to the timeline');
    }

    track.configure(this.timeContext);

    this.tracks.push(track);
    this.createInteraction(this._surfaceCtor, track.$el);
  }

  /**
   *  Removes a track from the timeline
   *  @TODO
   */
  remove(track) {
    // should destroy interaction too, avoid ghost eventListeners
  }

  /**
   *  Creates a new track from the configuration define in `configureTracks`
   *  @param {DOMElement} $el - the element to insert the track inside
   *  @param {Object} options - override the defaults options if necessary
   *  @param {String} [trackId=null] - optionnal id to give to the track, only exists in timeline's context
   *  @return {Track}
   */
  createTrack($el, trackHeight = 100, trackId = null) {
    const track = new Track($el, trackHeight);

    if (trackId !== null) {
      if (this._trackById[trackId] !== undefined) {
        throw new Error(`trackId: "${trackId}" is already used`);
      }

      this._trackById[trackId] = track;
    }

    // Add track to the timeline
    this.add(track);
    track.render();
    track.update();

    return track;
  }

  /**
   *  Adds a layer to a track, allow to group track arbitrarily inside groups. Basically a wrapper for `track.add(layer)`
   *  @param {Layer} layer - the layer to add
   *  @param {Track} track - the track to the insert the layer in
   *  @param {String} [groupId='default'] - the group in which associate the layer
   */
  addLayer(layer, trackOrTrackId, groupId = 'default', isAxis = false) {
    let track = trackOrTrackId;

    if (typeof trackOrTrackId === 'string') {
      track = this.getTrackById(trackOrTrackId);
    }

    // creates the `LayerTimeContext` if not present
    if (!layer.timeContext) {
      const timeContext = isAxis ?
        this.timeContext : new LayerTimeContext(this.timeContext);

      layer.setTimeContext(timeContext);
    }

    // we should have a Track instance at this point
    track.add(layer);

    if (!this._groupedLayers[groupId]) {
      this._groupedLayers[groupId] = [];
    }

    this._groupedLayers[groupId].push(layer);

    layer.render();
    layer.update();
  }

  /**
   *  Removes a layer from its track (the layer is detatched from the DOM but can still be reused)
   *  @param {Layer} layer - the layer to remove
   */
  removeLayer(layer) {
    this.tracks.forEach(function(track) {
      const index = track.layers.indexOf(layer);
      if (index !== -1) { track.remove(layer); }
    });

    // clean references in helpers
    for (let groupId in this._groupedLayers) {
      const group = this._groupedLayers[groupId];
      const index = group.indexOf(layer);

      if (index !== -1) { group.splice(layer, 1); }

      if (!group.length) {
        delete this._groupedLayers[groupId];
      }
    }
  }

  /**
   *  Returns a track from it's id
   *  @param {String} trackId
   *  @return {Track}
   */
  getTrackById(trackId) {
    return this._trackById[trackId];
  }

  /**
   *  Returns the track containing a given DOM Element, if no match found return null
   *  @param {DOMElement} $el
   *  @return {Track}
   */
  getTrackFromDOMElement($el) {
    let $svg = null;
    let track = null;
    // find the closest `.track` element
    do {
      if ($el.classList.contains('track')) {
        $svg = $el;
      }
      $el = $el.parentNode;
    } while ($svg === null);
    // find the related `Track`
    this.tracks.forEach(function(_track) {
      if (_track.$svg === $svg) { track = _track; }
    });

    return track;
  }

  /**
   * Returns an array of layers from their group Id
   * @param {String} groupId
   * @return {Array}
   */
  getLayersByGroup(groupId) {
    return this._groupedLayers[groupId];
  }

  *[Symbol.iterator]() {
    yield* this.tracks[Symbol.iterator]();
  }
}