/* Open City - city generation: roads, blocks, buildings, trees. Made by Ayushdev */
(function (G) {
  'use strict';
  var W = G.world = {};
  var CELL = 540, ROAD = 140, N = 8, SW = 28, BS = 400;
  W.CELL = CELL; W.ROAD = ROAD; W.N = N; W.SW = SW; W.BS = BS;
  W.WIDTH = CELL * N; W.HEIGHT = CELL * N;
  W.SAND_Y = 7 * CELL + ROAD;
  W.SEA_Y = 4140;
  W.START = { x: 4 * CELL + ROAD / 2, y: 3 * CELL + ROAD / 2 };
  W.blocks = [];
  W.parked = [];

  var GS = 256;
  var GC = Math.ceil(W.WIDTH / GS) + 1, GR = Math.ceil(W.HEIGHT / GS) + 1;
  var grid = new Array(GC * GR);
  var rnd = G.seeded(20260101);
  function rr(a, b) { return a + rnd() * (b - a); }
  function pk(arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function ci(v, max) { return v < 0 ? 0 : (v > max ? max : v); }
  function cell(ix, iy) {
    var k = iy * GC + ix, c = grid[k];
    if (!c) { c = grid[k] = { r: [], c: [] }; }
    return c;
  }

  /* ---------- collision grid ---------- */
  W.addRect = function (x, y, w, h) {
    var rc = { x: x, y: y, w: w, h: h };
    var x0 = ci(Math.floor(x / GS), GC - 1), x1 = ci(Math.floor((x + w) / GS), GC - 1);
    var y0 = ci(Math.floor(y / GS), GR - 1), y1 = ci(Math.floor((y + h) / GS), GR - 1);
    for (var iy = y0; iy <= y1; iy++) for (var ix = x0; ix <= x1; ix++) cell(ix, iy).r.push(rc);
    return rc;
  };
  W.addCircle = function (x, y, r) {
    var c = { x: x, y: y, r: r };
    var x0 = ci(Math.floor((x - r) / GS), GC - 1), x1 = ci(Math.floor((x + r) / GS), GC - 1);
    var y0 = ci(Math.floor((y - r) / GS), GR - 1), y1 = ci(Math.floor((y + r) / GS), GR - 1);
    for (var iy = y0; iy <= y1; iy++) for (var ix = x0; ix <= x1; ix++) cell(ix, iy).c.push(c);
    return c;
  };

  /* push circle object {x,y} out of all solids. returns max penetration */
  W.resolve = function (o, r) {
    var maxPen = 0;
    var ix0 = ci(Math.floor((o.x - r) / GS), GC - 1), ix1 = ci(Math.floor((o.x + r) / GS), GC - 1);
    var iy0 = ci(Math.floor((o.y - r) / GS), GR - 1), iy1 = ci(Math.floor((o.y + r) / GS), GR - 1);
    for (var iy = iy0; iy <= iy1; iy++) {
      for (var ix = ix0; ix <= ix1; ix++) {
        var cl = grid[iy * GC + ix];
        if (!cl) continue;
        var rs = cl.r, k, pen;
        for (k = 0; k < rs.length; k++) {
          var rc = rs[k];
          var px = o.x < rc.x ? rc.x : (o.x > rc.x + rc.w ? rc.x + rc.w : o.x);
          var py = o.y < rc.y ? rc.y : (o.y > rc.y + rc.h ? rc.y + rc.h : o.y);
          var dx = o.x - px, dy = o.y - py, d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;
          if (d2 > 0.0001) {
            var d = Math.sqrt(d2); pen = r - d;
            o.x += dx / d * pen; o.y += dy / d * pen;
          } else {
            var l = o.x - rc.x, rt = rc.x + rc.w - o.x, t = o.y - rc.y, b = rc.y + rc.h - o.y;
            var m = Math.min(l, rt, t, b); pen = m + r;
            if (m === l) o.x = rc.x - r; else if (m === rt) o.x = rc.x + rc.w + r;
            else if (m === t) o.y = rc.y - r; else o.y = rc.y + rc.h + r;
          }
          if (pen > maxPen) maxPen = pen;
        }
        var cs = cl.c;
        for (k = 0; k < cs.length; k++) {
          var cc = cs[k], ex = o.x - cc.x, ey = o.y - cc.y, rad = r + cc.r;
          var e2 = ex * ex + ey * ey;
          if (e2 >= rad * rad) continue;
          var e = Math.sqrt(e2) || 0.01; pen = rad - e;
          o.x += ex / e * pen; o.y += ey / e * pen;
          if (pen > maxPen) maxPen = pen;
        }
      }
    }
    return maxPen;
  };

  W.blocked = function (x, y, r) {
    var ix0 = ci(Math.floor((x - r) / GS), GC - 1), ix1 = ci(Math.floor((x + r) / GS), GC - 1);
    var iy0 = ci(Math.floor((y - r) / GS), GR - 1), iy1 = ci(Math.floor((y + r) / GS), GR - 1);
    for (var iy = iy0; iy <= iy1; iy++) for (var ix = ix0; ix <= ix1; ix++) {
      var cl = grid[iy * GC + ix];
      if (!cl) continue;
      var k;
      for (k = 0; k < cl.r.length; k++) {
        var rc = cl.r[k];
        var px = x < rc.x ? rc.x : (x > rc.x + rc.w ? rc.x + rc.w : x);
        var py = y < rc.y ? rc.y : (y > rc.y + rc.h ? rc.y + rc.h : y);
        var dx = x - px, dy = y - py;
        if (dx * dx + dy * dy < r * r) return true;
      }
      for (k = 0; k < cl.c.length; k++) {
        var cc = cl.c[k], ex = x - cc.x, ey = y - cc.y, rad = r + cc.r;
        if (ex * ex + ey * ey < rad * rad) return true;
      }
    }
    return false;
  };

  W.pointSolid = function (x, y) {
    var ix = Math.floor(x / GS), iy = Math.floor(y / GS);
    if (ix < 0 || iy < 0 || ix >= GC || iy >= GR) return false;
    var cl = grid[iy * GC + ix];
    if (!cl) return false;
    for (var k = 0; k < cl.r.length; k++) {
      var rc = cl.r[k];
      if (x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h) return true;
    }
    return false;
  };

  W.clearLine = function (x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, d = Math.sqrt(dx * dx + dy * dy), n = Math.ceil(d / 18);
    for (var i = 1; i < n; i++) {
      var t = i / n;
      if (W.pointSolid(x1 + dx * t, y1 + dy * t)) return false;
    }
    return true;
  };

  W.randomWalkPoint = function () {
    for (var tries = 0; tries < 24; tries++) {
      var b = W.blocks[Math.floor(Math.random() * W.blocks.length)];
      var x, y;
      if (b.type === 'beach') {
        x = b.x0 + 12 + Math.random() * (BS - 24);
        y = b.y0 + 12 + Math.random() * (W.SEA_Y - b.y0 - 50);
      } else if (b.type === 'park' && Math.random() < 0.6) {
        x = b.x0 + 40 + Math.random() * (BS - 80); y = b.y0 + 40 + Math.random() * (BS - 80);
      } else {
        var side = Math.floor(Math.random() * 4), t = 10 + Math.random() * (BS - 20), m = SW * 0.5;
        if (side === 0) { x = b.x0 + t; y = b.y0 + m; }
        else if (side === 1) { x = b.x0 + t; y = b.y0 + BS - m; }
        else if (side === 2) { x = b.x0 + m; y = b.y0 + t; }
        else { x = b.x0 + BS - m; y = b.y0 + t; }
      }
      if (!W.blocked(x, y, 14)) return { x: x, y: y };
    }
    return { x: W.START.x, y: W.START.y };
  };

  /* ---------- palettes ---------- */
  var WALL = ['#e4572e', '#f3a712', '#29a0b1', '#a8c686', '#8a5cc2', '#ef476f', '#06b58a', '#118ab2', '#ffd166', '#c77dff', '#f4845f', '#4cc9f0', '#e5989b', '#90be6d', '#f9c74f', '#d4a373'];
  var GLASS = ['#3d7ea6', '#2a9d8f', '#577590', '#5e60ce', '#4361ee', '#2f6f8f', '#6d597a', '#0096c7', '#3a86ff', '#7b8fa1'];
  var ROOF = ['#8d3b2c', '#4a4e69', '#6b4226', '#2f4858', '#7b2d26', '#386641', '#5c4033', '#9a3b3b', '#355070', '#6d4c41'];
  var CARS = ['sedan', 'sedan', 'sedan', 'suv', 'sports', 'taxi', 'van'];

  function addBld(b, x, y, w, h, H, kind, wall, roof, extra) {
    var o = { x: x, y: y, w: w, h: h, H: H, z: H, kind: kind, wall: wall, roof: roof, sid: Math.floor(rnd() * 100000), win: kind !== 'hut', tier: false };
    if (extra) for (var k in extra) o[k] = extra[k];
    if (kind === 'tower' && H > 250 && w > 110 && h > 110) o.tier = true;
    b.bld.push(o);
    W.addRect(x, y, w, h);
    return o;
  }

  function addTree(b, x, y, kind, sc) {
    sc = sc || 1;
    var t = { x: x, y: y, kind: kind, r: rr(24, 36) * sc, h: rr(62, 92) * sc, trunk: rr(5, 7) * Math.sqrt(sc), seed: rr(0, 100), c1: '#2e9e4f', isTree: true };
    switch (kind) {
      case 'blossom': t.c1 = pk(['#f78fb3', '#ff7eb6', '#f9a8d4']); break;
      case 'autumn': t.c1 = pk(['#f39c12', '#e67e22', '#f1c40f', '#d9822b']); break;
      case 'purple': t.c1 = pk(['#9b59b6', '#a463f2', '#8e44ad']); break;
      case 'lime': t.c1 = pk(['#8ac926', '#a7d129', '#6abf4b', '#b5e61d']); break;
      case 'pine': t.c1 = pk(['#1f6f50', '#17613f', '#24805a']); t.h *= 1.1; t.r *= 0.9; break;
      case 'palm': t.c1 = pk(['#2fa84f', '#27ae60', '#3cb371']); t.r = rr(32, 42) * sc; t.h = rr(80, 108) * sc; t.trunk = 4.5; break;
      default: t.c1 = pk(['#2e9e4f', '#3cb043', '#1f8a4c', '#58b947', '#2f7d32', '#4caf50']);
    }
    t.c2 = G.shade(t.c1, 0.28); t.c3 = G.shade(t.c1, -0.3);
    t.z = t.h;
    b.trees.push(t);
    W.addCircle(x, y, t.trunk + 2);
    return t;
  }

  function streetTrees(b, dens) {
    var m = SW * 0.5;
    for (var s = 0; s < 4; s++) for (var t = 40; t <= BS - 40; t += 64) {
      if (rnd() > dens) continue;
      var x, y;
      if (s === 0) { x = b.x0 + t; y = b.y0 + m; } else if (s === 1) { x = b.x0 + t; y = b.y0 + BS - m; }
      else if (s === 2) { x = b.x0 + m; y = b.y0 + t; } else { x = b.x0 + BS - m; y = b.y0 + t; }
      if (W.blocked(x, y, 12)) continue;
      addTree(b, x, y, pk(['round', 'lime', 'blossom', 'round', 'autumn', 'palm']), 0.62);
    }
  }
  function streetLamps(b) {
    var m = 8;
    for (var t = 90; t < BS; t += 210) {
      b.lamps.push({ x: b.x0 + t, y: b.y0 + m }, { x: b.x0 + t, y: b.y0 + BS - m },
        { x: b.x0 + m, y: b.y0 + t }, { x: b.x0 + BS - m, y: b.y0 + t });
    }
  }

  function parkedCar(x, y, a, type) {
    W.parked.push({ x: x, y: y, a: a, type: type || pk(CARS), spawned: false, v: null, dead: false });
  }

  /* ---------- block types ---------- */
  function genDowntown(b) {
    var ux = b.x0 + SW + 4, uy = b.y0 + SW + 4, us = BS - 2 * SW - 8, g = 14, r = rnd(), rects = [], k;
    b.ground = '#b9b4a6';
    if (r < 0.28) rects.push([ux, uy, us, us]);
    else if (r < 0.64) {
      if (rnd() < 0.5) { var w1 = rr(us * 0.38, us * 0.62); rects.push([ux, uy, w1, us], [ux + w1 + g, uy, us - w1 - g, us]); }
      else { var h1 = rr(us * 0.38, us * 0.62); rects.push([ux, uy, us, h1], [ux, uy + h1 + g, us, us - h1 - g]); }
    } else {
      var hw = (us - g) / 2;
      for (var a = 0; a < 2; a++) for (var c = 0; c < 2; c++) rects.push([ux + a * (hw + g), uy + c * (hw + g), hw, hw]);
    }
    var dc = Math.sqrt((b.i - 3.5) * (b.i - 3.5) + (b.j - 3) * (b.j - 3));
    for (k = 0; k < rects.length; k++) {
      var q = rects[k], ins = rr(0, 8);
      var H = rr(190, 320) + Math.max(0, 1.8 - dc) * 80 + rr(0, 50);
      var wall = rnd() < 0.62 ? pk(GLASS) : pk(WALL);
      addBld(b, q[0] + ins, q[1] + ins, q[2] - ins * 2, q[3] - ins * 2, H, 'tower', wall, pk(['#4b5563', '#57606f', '#3d4451']));
    }
    streetTrees(b, 0.35); streetLamps(b);
  }

  function genMixed(b) {
    var ux = b.x0 + SW, uy = b.y0 + SW, us = BS - 2 * SW, g = 14, lot = (us - g) / 2;
    b.ground = '#a9a69c';
    for (var a = 0; a < 2; a++) for (var c = 0; c < 2; c++) {
      var lx = ux + a * (lot + g), ly = uy + c * (lot + g);
      if (rnd() < 0.24) {
        b.decor.push({ t: 'rect', x: lx, y: ly, w: lot, h: lot, c: '#4b5563' });
        b.decor.push({ t: 'lines', x: lx, y: ly, w: lot, h: lot });
        for (var row = 0; row < 3; row++) {
          if (rnd() < 0.75) parkedCar(lx + (rnd() < 0.5 ? 52 : lot - 52), ly + 28 + row * 54, rnd() < 0.5 ? 0 : Math.PI);
        }
      } else {
        var w = rr(lot * 0.72, lot - 6), h = rr(lot * 0.72, lot - 6);
        var bx = lx + rr(0, lot - w), by = ly + rr(0, lot - h);
        var shop = rnd() < 0.55;
        var wall = pk(WALL);
        addBld(b, bx, by, w, h, shop ? rr(55, 92) : rr(130, 235), shop ? 'shop' : 'apt', wall, shop ? G.shade(wall, -0.18) : pk(['#4b5563', '#6b7280', '#57606f']));
      }
    }
    streetTrees(b, 0.5); streetLamps(b);
  }

  function genSuburb(b) {
    var ux = b.x0 + SW, uy = b.y0 + SW, us = BS - 2 * SW, g = 12, lot = (us - g) / 2;
    var lawns = ['#7ccf68', '#74c562', '#82d46e', '#6bb85a'];
    b.ground = '#6fbf5e';
    for (var a = 0; a < 2; a++) for (var c = 0; c < 2; c++) {
      var lx = ux + a * (lot + g), ly = uy + c * (lot + g);
      b.decor.push({ t: 'rect', x: lx, y: ly, w: lot, h: lot, c: pk(lawns) });
      b.decor.push({ t: 'fence', x: lx + 1, y: ly + 1, w: lot - 2, h: lot - 2, c: '#f3efe4' });
      var hw = rr(76, 104), hh = rr(62, 80), padH = 58, pw = 112;
      var hy = c === 0 ? ly + lot - hh - 12 : ly + 12;
      var hx = lx + rr(10, lot - hw - 10);
      var padY = c === 0 ? ly + 4 : ly + lot - padH - 4;
      var wall = pk(WALL);
      addBld(b, hx, hy, hw, hh, rr(42, 60), 'house', wall, pk(ROOF));
      var pad = null;
      if (rnd() < 0.8) {
        var px0 = lx + rr(6, lot - pw - 6);
        pad = { x: px0, y: padY, w: pw, h: padH };
        b.decor.push({ t: 'rect', x: px0, y: padY, w: pw, h: padH, c: '#9ca3af' });
        parkedCar(px0 + pw / 2, padY + padH / 2, rnd() < 0.5 ? 0 : Math.PI);
      }
      var nt = 1 + Math.floor(rnd() * 3), tries = 0;
      while (nt > 0 && tries++ < 16) {
        var tx = lx + rr(16, lot - 16), ty = ly + rr(16, lot - 16);
        if (W.blocked(tx, ty, 20)) continue;
        if (pad && tx > pad.x - 14 && tx < pad.x + pad.w + 14 && ty > pad.y - 14 && ty < pad.y + pad.h + 14) continue;
        addTree(b, tx, ty, pk(['round', 'round', 'lime', 'blossom', 'autumn', 'purple', 'palm', 'pine']), 0.85);
        nt--;
      }
      if (rnd() < 0.25) {
        for (var tr = 0; tr < 10; tr++) {
          var qx = lx + rr(8, lot - 48), qy = ly + rr(8, lot - 34);
          if (W.blocked(qx + 20, qy + 13, 30)) continue;
          if (pad && qx + 40 > pad.x && qx < pad.x + pad.w && qy + 26 > pad.y && qy < pad.y + pad.h) continue;
          b.decor.push({ t: 'pool', x: qx, y: qy, w: 40, h: 26 });
          break;
        }
      }
      for (var f = 0; f < 6; f++) {
        var fx = hx + rr(-8, hw + 8), fy = c === 0 ? hy - rr(2, 10) : hy + hh + rr(2, 10);
        b.decor.push({ t: 'flower', x: fx, y: fy, c: pk(['#ff5d8f', '#ffd166', '#ffffff', '#c77dff', '#ff9f1c']) });
      }
    }
    streetTrees(b, 0.55); streetLamps(b);
  }

  function genPark(b) {
    var cx = b.x0 + BS / 2, cy = b.y0 + BS / 2, i, tries = 0;
    b.ground = '#79d06a';
    b.decor.push({ t: 'rect', x: b.x0 + SW, y: cy - 13, w: BS - 2 * SW, h: 26, c: '#e6d8b5' });
    b.decor.push({ t: 'rect', x: cx - 13, y: b.y0 + SW, w: 26, h: BS - 2 * SW, c: '#e6d8b5' });
    if (rnd() < 0.5) {
      b.decor.push({ t: 'fountain', x: cx, y: cy, r: 38 });
      W.addCircle(cx, cy, 33);
    } else {
      b.decor.push({ t: 'pond', x: cx, y: cy, rx: 76, ry: 50 });
      W.addCircle(cx - 38, cy, 38); W.addCircle(cx, cy, 40); W.addCircle(cx + 38, cy, 38);
    }
    for (i = 0; i < 4; i++) {
      var s = i % 2 ? 1 : -1;
      b.decor.push({ t: 'bench', x: cx + (i < 2 ? s * 70 : 0), y: cy + (i < 2 ? 22 : s * 80), a: i < 2 ? 0 : Math.PI / 2 });
      b.lamps.push({ x: cx + (i < 2 ? s * 100 : 22), y: cy + (i < 2 ? -22 : s * 110) });
    }
    var want = 20;
    while (want > 0 && tries++ < 120) {
      var x = b.x0 + rr(40, BS - 40), y = b.y0 + rr(40, BS - 40);
      if (Math.abs(x - cx) < 30 || Math.abs(y - cy) < 30) continue;
      if (W.blocked(x, y, 22)) continue;
      addTree(b, x, y, pk(['round', 'round', 'lime', 'blossom', 'blossom', 'autumn', 'purple', 'pine', 'palm']), 1);
      want--;
    }
    for (i = 0; i < 40; i++) {
      var fx = b.x0 + rr(36, BS - 36), fy = b.y0 + rr(36, BS - 36);
      if (Math.abs(fx - cx) < 20 || Math.abs(fy - cy) < 20) continue;
      b.decor.push({ t: 'flower', x: fx, y: fy, c: pk(['#ff5d8f', '#ffd166', '#ffffff', '#c77dff', '#ff9f1c', '#4cc9f0']) });
    }
    streetLamps(b);
  }

  function genPlaza(b) {
    var cx = b.x0 + BS / 2, cy = b.y0 + BS / 2;
    b.ground = '#d8d0bd';
    b.decor.push({ t: 'grid', x: b.x0 + SW, y: b.y0 + SW, w: BS - 2 * SW, h: BS - 2 * SW, c: 'rgba(120,110,90,0.35)' });
    b.decor.push({ t: 'fountain', x: cx, y: cy, r: 48 });
    W.addCircle(cx, cy, 43);
    var cr = [[-120, -120], [120, -120], [-120, 120], [120, 120]];
    for (var i = 0; i < 4; i++) {
      addTree(b, cx + cr[i][0], cy + cr[i][1], pk(['lime', 'blossom', 'round', 'palm']), 0.9);
      b.decor.push({ t: 'bench', x: cx + cr[i][0] * 0.55, y: cy + cr[i][1] * 0.55, a: i % 2 ? 0 : Math.PI / 2 });
    }
    var wall = pk(WALL);
    addBld(b, b.x0 + SW + 6, b.y0 + SW + 6, 58, 42, 46, 'shop', wall, G.shade(wall, -0.2));
    wall = pk(WALL);
    addBld(b, b.x0 + BS - SW - 64, b.y0 + BS - SW - 48, 58, 42, 46, 'shop', wall, G.shade(wall, -0.2));
    streetTrees(b, 0.4); streetLamps(b);
  }

  function genBeach(b) {
    var i, tries = 0, bottom = W.SEA_Y;
    b.ground = '#f0dfaa';
    for (i = 0; i < 2; i++) {
      var wall = pk(['#f4845f', '#ffd166', '#4cc9f0', '#ef476f']);
      addBld(b, b.x0 + 50 + i * 190, b.y0 + 16, 68, 52, 46, 'hut', wall, '#c68b3a');
    }
    if (b.i % 3 === 1) addBld(b, b.x0 + BS / 2 - 15, bottom - 70, 30, 30, 90, 'tower', '#ef4444', '#f8fafc', { win: false });
    var n = 0;
    while (n < 7 && tries++ < 60) {
      var x = b.x0 + rr(20, BS - 20), y = b.y0 + rr(8, 70);
      if (W.blocked(x, y, 22)) continue;
      addTree(b, x, y, 'palm', 1); n++;
    }
    for (i = 0; i < 5; i++) {
      var ux = b.x0 + rr(30, BS - 30), uy = b.y0 + rr(90, bottom - b.y0 - 40);
      b.decor.push({ t: 'towel', x: ux + 18, y: uy + 6, c: pk(['#ff5d8f', '#4cc9f0', '#ffd166', '#ffffff']) });
      b.decor.push({ t: 'umbrella', x: ux, y: uy, c: pk(['#ef476f', '#118ab2', '#ffd166', '#06d6a0', '#f4845f']) });
    }
    b.decor.push({ t: 'net', x: b.x0 + 260, y: b.y0 + 120, w: 70 });
  }

  function genBlock(i, j) {
    var b = { i: i, j: j, x0: i * CELL + ROAD, y0: j * CELL + ROAD, type: '', bld: [], trees: [], lamps: [], decor: [], ground: '#78c667' };
    var dc = Math.sqrt((i - 3.5) * (i - 3.5) + (j - 3) * (j - 3));
    if (j === 7) b.type = 'beach';
    else if (dc < 1.7) b.type = rnd() < 0.12 ? 'plaza' : 'downtown';
    else if (dc < 3.0) b.type = rnd() < 0.2 ? 'park' : 'mixed';
    else b.type = rnd() < 0.18 ? 'park' : 'suburb';
    if (i === 4 && j === 3) b.type = 'plaza';
    switch (b.type) {
      case 'downtown': genDowntown(b); break;
      case 'mixed': genMixed(b); break;
      case 'suburb': genSuburb(b); break;
      case 'park': genPark(b); break;
      case 'plaza': genPlaza(b); break;
      default: genBeach(b);
    }
    return b;
  }

  W.generate = function () {
    for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) W.blocks[j * N + i] = genBlock(i, j);
  };
  W.generate();
})(window.G = window.G || {});
