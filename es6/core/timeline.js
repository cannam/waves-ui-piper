import events from 'events';

import Keyboard from '../interactions/keyboard';
import Surface from '../interactions/surface';
import TimelineTimeContext from './timeline-time-context';
import Track from './track';
import TrackCollection from './track-collection';


/**
 * The `timeline` is the main entry point of a temporal visualization, it:
 * - contains factories to manage its `tracks` and `layers`,
 * - get or set the view window overs its `tracks` through `offset`, `zoom`,  * `pixelsPerSecond`, `visibleWidth`,
 * - is the central hub for all user interaction events (keyboard, mouse),
 * - holds the current interaction `state` which defines how the different timeline elements (tracks, layers, shapes) respond to user interactions.
 */
export default class Timeline extends events.EventEmitter {
  /**
   * Creates a new `Timeline` instance
   */
  constructor(pixelsPerSecond = 100, visibleWidth = 1000) {
    super();

    this._tracks = new TrackCollection(this);
    this._state = null;
    this._createInteraction(Keyboard, 'body');
    // stores
    this._trackById = {};
    this._groupedLayers = {};

    this.timeContext = new TimelineTimeContext(pixelsPerSecond, visibleWidth);
  }

  /**
   *  TimeContext accessors
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
   * Factory method to add interaction modules the timeline should listen to.
   * By default, the timeline listen to Keyboard, and instanciate a `Surface` on each container.
   * @param {EventSource} ctor - the contructor of the interaction module to instanciate
   * @param el {DOMElement} the DOM element to bind to the EventSource module
   * @param options {Object} options to be applied to the ctor (defaults to `{}`)
   */
  _createInteraction(ctor, el, options = {}) {
    const interaction = new ctor(el, options);
    interaction.on('event', (e) => this._handleEvent(e));
  }

  /**
   * The callback that is used to listen to interactions modules
   * @params {Event} e - a custom event generated by interaction modules
   */
  _handleEvent(e) {
    // emit event as a middleware
    this.emit('event', e);
    // propagate to the state
    if (!this._state) { return; }
    this._state.handleEvent(e);
  }


  /**
   * Changes the state of the timeline
   * @param {BaseState} state - the state in which the timeline must be setted
   */
  set state(state) {
    if (this._state) { this._state.exit(); }
    this._state = state;
    this._state.enter();
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
    this._createInteraction(Surface, track.$el);
  }

  remove(track) {
    // @TODO
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
    return track;
  }

  /**
   *  Adds a layer to a track, allow to group track arbitrarily inside groups. Basically a wrapper for `track.add(layer)`
   *  @param {Layer} layer - the layer to add
   *  @param {Track} track - the track to the insert the layer in
   *  @param {String} [groupId='default'] - the group in which associate the layer
   */
  addLayer(layer, trackOrTrackId, groupId = 'default') {
    let track = trackOrTrackId;

    if (typeof trackOrTrackId === 'string') {
      track = this.getTrackById(trackOrTrackId);
    }
    // we should have a Track instance at this point
    track.add(layer);

    if (!this._groupedLayers[groupId]) {
      console.log(groupId);
      this._groupedLayers[groupId] = [];
    }

    this._groupedLayers[groupId].push(layer);
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
