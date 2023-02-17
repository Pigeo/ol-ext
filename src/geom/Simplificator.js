import ol_Object from 'ol/Object.js'
import { ol_coordinate_equal } from './GeomUtils.js'
import ol_Feature from 'ol/Feature.js'
import ol_source_Vector from 'ol/source/Vector.js'
import ol_geom_LineString from './visvalingam.js'

/** An object to simplify geometry
 * @extends {ol_Object}
 * @param {Object=} options 
 * @api
 */
var ol_geom_Simplificator = class olgeomSimplificator extends ol_Object {
  constructor(options) {
    super(options);
    this._edges = new ol_source_Vector();
  }

  /** Get source edge
   */
  getEdgeSource() {
    return this._edges;
  }

  /** Set the features to process
   * @param {Array<ol_Feature>} features
   */
  setFeatures(features) {
    console.time('arcs')
    var edges = this._calcEdges(features)
    console.timeLog('arcs')
  
    console.time('chain')
    this._edges.clear(true);
    this._edges.addFeatures(this._chainEdges(edges));
    console.timeLog('chain')
  }

  /** Get simplified features
   * @returns {}
   */
  getFeatures() {
    return [];
  }

  /** Simplify edges
   * @param {Object} options
   */
  simplify(options) {
    var features = this._edges.getFeatures();
    features.forEach(function(f) {
      // f.setGeometry(f.getGeometry().simplify(100))
      f.setGeometry(f.get('geom').simplifyVisvalingam(options))
    })
  }

  /** Calculate edges
   * @param {Array<ol_Features>} features 
   * @returns {Array<Object>}
   * @private
   */
  _calcEdges(features) {
    var edges = {};
    var prev, prevEdge;
    
    function createEdge(f, a) {
      var id = a.seg[0].join() + '-' + a.seg[1].join();
      // Existing edge
      var e = edges[id];
      // Test revert
      if (!e) {
        id = a.seg[1].join() + '-' + a.seg[0].join();
        e = edges[id];
      }
      // Add or create a new one
      if (e) {
        e.edge.push({ feature: f, contour: a.contour })
      } else {
        var edge = {
          geometry: a.seg,
          edge: [{ feature: f, contour: a.contour }],
          prev: prev === a.contour ? prevEdge : false
        };
        prev = a.contour;
        // For back chain
        prevEdge = edge;
        edges[id] = edge
      }
    }
  
    // Get all edges
    features.forEach(function(f) {
      var arcs = this._getArcs(f.getGeometry().getCoordinates(), [], '0');
      // Create edges for arcs
      prev = '';
      arcs.forEach(function (a) { createEdge(f, a) });
    }.bind(this))
  
    // Convert to Array
    var tedges = [];
    for (var i in edges) tedges.push(edges[i])
  
    return tedges;
  }

  /** Retrieve edges of arcs
   * @param {*} coords 
   * @param {*} arcs 
   * @param {*} contour 
   * @returns 
   * @private
   */
  _getArcs(coords, arcs, contour) {
    // New contour
    if (coords[0][0][0].length) {
      coords.forEach(function(c, i) {
        this._getArcs(c, arcs, contour + '-' + i)
      }.bind(this))
    } else {
      coords.forEach(function(c, k) {
        var p1, p0 = c[0];
        var ct = contour + '-' + k;
        for (var i=1; i<c.length; i++) {
          p1 = c[i];
          if (!ol_coordinate_equal(p0, p1)) {
            arcs.push({ seg: [p0, p1], contour: ct });
          }
          p0 = p1;
        }
      });
    }
    return arcs
  }

  /** Chain edges backward
   * @param {*} edges 
   * @returns {Array<ol_Feature>}
   */
  _chainEdges(edges) {
    // 2 edges are connected
    function isConnected(edge1, edge2) {
      if (edge1.length === edge2.length) {
        var connected, e1, e2;
        for (var i=0; i < edge1.length; i++) {
          e1 = edge1[i]
          connected = false;
          for (var j=0; j < edge2.length; j++) {
            e2 = edge2[j];
            if (e1.feature === e2.feature && e1.contour === e2.contour) {
              connected = true;
              break;
            }
          }
          if (!connected) return false;
        }
        return true
      }
      return false;
    }
    // Chain features back
    function chainBack(f) {
      if (f.del) return;
      // Previous edge
      var prev = f.prev;
      if (!prev) return;
      // Merge edges
      if (isConnected(f.edge, prev.edge)) {
        // Remove prev...
        prev.del = true;
        // ...and  merge with current
        var g = prev.geometry;
        var g1 = f.geometry;
        g1.shift();
        f.geometry = g.concat(g1);
        f.prev = prev.prev;
        // Chain
        chainBack(f);
      }
    }
  
    // Chain features back
    edges.forEach(chainBack)
  
    // New arcs features
    var result = [];
    edges.forEach(function(f) { 
      if (!f.del) {
        result.push(new ol_Feature({
          geometry: new ol_geom_LineString(f.geometry),
          geom: new ol_geom_LineString(f.geometry),
          edge: f.edge,
          prev: f.prev
        }));
      }
    })
    return result;
  }
}

export default ol_geom_Simplificator
