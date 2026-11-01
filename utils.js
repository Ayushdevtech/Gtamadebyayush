/* Open City - shared helpers and global state. Made by Ayushdev */
(function (G) {
  'use strict';

  G.TAU = Math.PI * 2;
  G.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  G.lerp = function (a, b, t) { return a + (b - a) * t; };
  G.rand = function (a, b) { return a + Math.random() * (b - a); };
  G.randInt = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  G.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  G.dist = function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); };

  G.angDiff = function (a, b) {
    var d = (b - a) % G.TAU;
    if (d > Math.PI) d -= G.TAU; else if (d < -Math.PI) d += G.TAU;
    return d;
  };

  G.seeded = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  G.hash2 = function (x, y) {
    var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  function parseHex(hex) {
    if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  var shadeCache = {}, rgbaCache = {};
  G.shade = function (hex, f) {
    var key = hex + '|' + f;
    var c = shadeCache[key];
    if (c) return c;
    var rgb = parseHex(hex), t = f < 0 ? 0 : 255, p = Math.abs(f);
    c = 'rgb(' + Math.round(rgb[0] + (t - rgb[0]) * p) + ',' + Math.round(rgb[1] + (t - rgb[1]) * p) + ',' + Math.round(rgb[2] + (t - rgb[2]) * p) + ')';
    shadeCache[key] = c;
    return c;
  };
  G.rgba = function (hex, a) {
    var key = hex + '|' + a;
    var c = rgbaCache[key];
    if (c) return c;
    var rgb = parseHex(hex);
    c = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
    rgbaCache[key] = c;
    return c;
  };

  /* Global game state */
  G.S = {
    peds: [], cars: [], bullets: [], parts: [], pickups: [], decals: [], respawnQ: [],
    player: null,
    time: 10 * 60, clock: 0,
    heat: 0, wanted: 0, crimeT: 0,
    money: 500, kills: 0, totalKills: 0, level: 1, target: 12,
    over: false, paused: true, started: false,
    shake: 0, hurt: 0
  };

  /* Input state (filled by main.js) */
  G.input = {
    up: false, down: false, left: false, right: false, run: false, fire: false,
    jx: 0, jy: 0, aimX: 0, aimY: 0, mouse: false, touch: false,
    act: false, next: false, slot: -1, horn: false, sx: 0, sy: 0, taim: null
  };

  G.toast = function () {};
})(window.G = window.G || {});
