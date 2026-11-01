/* Open City - canvas renderer. Made by Ayushdev */
(function (G) {
  'use strict';
  var S = G.S, W = G.world, TAU = G.TAU, clamp = G.clamp, shade = G.shade;
  var canvas, ctx, dpr = 1, VW = 800, VH = 450, baseZoom = 1;
  var cam = G.cam = { x: W.START.x, y: W.START.y, zoom: 1 };
  var PK = 0.0005;
  var CELL = W.CELL, ROAD = W.ROAD, SW = W.SW, BS = W.BS, N = W.N;
  var glow = null, litWins = [], redLights = [], drawList = [];
  var tint = [255, 255, 255], night = 0;
  var WEAPONS = G.WEAPONS;
  G.view = { w: 800, h: 450 };

  G.initRender = function (c) {
    canvas = c; ctx = c.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
    glow = document.createElement('canvas'); glow.width = glow.height = 128;
    var g = glow.getContext('2d'), gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(0.35, 'rgba(255,220,140,0.45)'); gr.addColorStop(1, 'rgba(255,200,100,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    VW = window.innerWidth; VH = window.innerHeight;
    canvas.width = Math.floor(VW * dpr); canvas.height = Math.floor(VH * dpr);
    canvas.style.width = VW + 'px'; canvas.style.height = VH + 'px';
    baseZoom = clamp(Math.min(VW / 1100, VH / 620), 0.55, 1.15);
    G.view.w = VW; G.view.h = VH;
  }

  G.screenToWorld = function (sx, sy) { return { x: (sx - VW / 2) / cam.zoom + cam.x, y: (sy - VH / 2) / cam.zoom + cam.y }; };
  G.onScreen = function (x, y, m) {
    var hw = VW / 2 / cam.zoom + m, hh = VH / 2 / cam.zoom + m;
    return Math.abs(x - cam.x) < hw && Math.abs(y - cam.y) < hh;
  };

  G.updateCamera = function (dt, snap) {
    var p = S.player, v = p.vehicle, tx = p.x, ty = p.y, tz = baseZoom;
    if (v) {
      tx += Math.cos(v.angle) * v.speed * 0.28; ty += Math.sin(v.angle) * v.speed * 0.28;
      tz = baseZoom * (1 - clamp(Math.abs(v.speed) / v.t.max, 0, 1) * 0.2) * (v.t.kind === 'car' ? 0.92 : 1);
    }
    var k = snap ? 1 : Math.min(1, dt * 6);
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.zoom += (tz - cam.zoom) * Math.min(1, k * 0.7 + (snap ? 1 : 0));
  };

  /* ---------- time of day ---------- */
  var KEYS = [[0, 55, 65, 115], [5, 70, 78, 128], [6.5, 255, 196, 150], [8, 255, 255, 255], [17, 255, 255, 255], [18.5, 255, 190, 135], [20, 95, 95, 150], [21.5, 55, 65, 115], [24, 55, 65, 115]];
  G.hourOfDay = function () { return (S.time / 60) % 24; };
  function dayTint() {
    var h = G.hourOfDay();
    for (var k = 0; k < KEYS.length - 1; k++) {
      var a = KEYS[k], b = KEYS[k + 1];
      if (h >= a[0] && h <= b[0]) {
        var t = (h - a[0]) / (b[0] - a[0]);
        tint[0] = a[1] + (b[1] - a[1]) * t; tint[1] = a[2] + (b[2] - a[2]) * t; tint[2] = a[3] + (b[3] - a[3]) * t;
        break;
      }
    }
    night = clamp((205 - tint[1]) / 130, 0, 1);
    G.night = night;
  }

  function rrect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }

  /* ---------- ground ---------- */
  function drawForest(vx0, vy0, vx1, vy1) {
    var cs = 70, gx0 = Math.floor(vx0 / cs), gx1 = Math.floor(vx1 / cs), gy0 = Math.floor(vy0 / cs), gy1 = Math.floor(vy1 / cs);
    var cols = ['#1d4a2a', '#235a31', '#1a4025', '#2a6b38'];
    for (var gy = gy0; gy <= gy1; gy++) for (var gx = gx0; gx <= gx1; gx++) {
      var cx = gx * cs, cy = gy * cs;
      if (cx > -10 && cy > -10 && cx < W.WIDTH + 10 && cy < W.SEA_Y + 10) continue;
      var h1 = G.hash2(gx, gy), h2 = G.hash2(gy + 77, gx - 31);
      ctx.fillStyle = cols[Math.floor(h1 * 4)];
      ctx.beginPath(); ctx.arc(cx + h1 * 40, cy + h2 * 40, 36 + h2 * 14, 0, TAU); ctx.fill();
    }
  }

  function drawSea(vx0, vy0, vx1, vy1) {
    var y0 = Math.max(vy0, W.SEA_Y);
    if (vy1 <= W.SEA_Y) return;
    var gr = ctx.createLinearGradient(0, W.SEA_Y, 0, W.SEA_Y + 700);
    gr.addColorStop(0, '#35b3d1'); gr.addColorStop(1, '#0c4f78');
    ctx.fillStyle = gr; ctx.fillRect(vx0, y0, vx1 - vx0, vy1 - y0);
    var t = S.clock;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2;
    for (var k = 0; k < 7; k++) {
      var yy = W.SEA_Y + 22 + k * 38 + Math.sin(t * 0.8 + k) * 6;
      if (yy < vy0 || yy > vy1) continue;
      ctx.beginPath();
      for (var x = Math.floor(vx0 / 40) * 40; x < vx1; x += 40) { var wy = yy + Math.sin(x * 0.03 + t * 1.3 + k) * 4; if (x === Math.floor(vx0 / 40) * 40) ctx.moveTo(x, wy); else ctx.lineTo(x, wy); }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 5;
    ctx.beginPath();
    for (var x2 = Math.floor(vx0 / 30) * 30, f = true; x2 < vx1; x2 += 30) { var fy = W.SEA_Y + Math.sin(x2 * 0.05 + t * 1.5) * 3; if (f) { ctx.moveTo(x2, fy); f = false; } else ctx.lineTo(x2, fy); }
    ctx.stroke();
  }

  function drawDecor(b) {
    var D = b.decor;
    for (var i = 0; i < D.length; i++) {
      var d = D[i];
      switch (d.t) {
        case 'rect': ctx.fillStyle = d.c; ctx.fillRect(d.x, d.y, d.w, d.h); break;
        case 'fence': ctx.strokeStyle = d.c; ctx.lineWidth = 2.2; ctx.strokeRect(d.x, d.y, d.w, d.h); break;
        case 'grid':
          ctx.strokeStyle = d.c; ctx.lineWidth = 1; ctx.beginPath();
          for (var gx = d.x; gx <= d.x + d.w; gx += 26) { ctx.moveTo(gx, d.y); ctx.lineTo(gx, d.y + d.h); }
          for (var gy = d.y; gy <= d.y + d.h; gy += 26) { ctx.moveTo(d.x, gy); ctx.lineTo(d.x + d.w, gy); }
          ctx.stroke(); break;
        case 'lines':
          ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.beginPath();
          for (var ly = d.y + 54; ly < d.y + d.h; ly += 54) { ctx.moveTo(d.x + 6, ly - 27); ctx.lineTo(d.x + d.w - 6, ly - 27); }
          ctx.stroke(); break;
        case 'pool':
          ctx.fillStyle = '#e5e7eb'; ctx.fillRect(d.x - 4, d.y - 4, d.w + 8, d.h + 8);
          ctx.fillStyle = '#38bdf8'; ctx.fillRect(d.x, d.y, d.w, d.h);
          ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(d.x + 3, d.y + 3 + Math.sin(S.clock * 2 + d.x) * 1.5, d.w - 6, 4); break;
        case 'flower':
          ctx.fillStyle = d.c; ctx.beginPath(); ctx.arc(d.x, d.y, 2.4, 0, TAU); ctx.fill();
          ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(d.x, d.y, 0.9, 0, TAU); ctx.fill(); break;
        case 'bench':
          ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a);
          ctx.fillStyle = '#7c4a21'; ctx.fillRect(-14, -4, 28, 8); ctx.fillStyle = '#5b3417'; ctx.fillRect(-14, -5, 28, 2);
          ctx.restore(); break;
        case 'fountain':
          ctx.fillStyle = '#c9c3b5'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill();
          ctx.fillStyle = '#3ab7e8'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r - 6, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
          for (var rp = 0; rp < 3; rp++) { ctx.beginPath(); ctx.arc(d.x, d.y, ((S.clock * 12 + rp * 10) % 30) + 4, 0, TAU); ctx.stroke(); }
          ctx.fillStyle = '#e8e4d8'; ctx.beginPath(); ctx.arc(d.x, d.y, 7, 0, TAU); ctx.fill(); break;
        case 'pond':
          ctx.fillStyle = '#b9a77a'; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.rx + 5, d.ry + 5, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#2fa9d8'; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.rx, d.ry, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(d.x - 14, d.y - 10, d.rx * 0.4, d.ry * 0.2, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#3f9d4e'; ctx.beginPath(); ctx.arc(d.x + 30, d.y + 12, 6, 0, TAU); ctx.arc(d.x - 40, d.y + 4, 5, 0, TAU); ctx.fill(); break;
        case 'umbrella':
          ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.arc(d.x + 5, d.y + 6, 19, 0, TAU); ctx.fill();
          for (var w = 0; w < 8; w++) {
            ctx.fillStyle = w % 2 ? '#ffffff' : d.c;
            ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.arc(d.x, d.y, 19, w * TAU / 8, (w + 1) * TAU / 8); ctx.closePath(); ctx.fill();
          }
          ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(d.x, d.y, 1.8, 0, TAU); ctx.fill(); break;
        case 'towel': ctx.fillStyle = d.c; ctx.fillRect(d.x, d.y, 14, 30); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(d.x + 4, d.y, 2, 30); break;
        case 'net':
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.w, d.y); ctx.stroke();
          ctx.fillStyle = '#555'; ctx.fillRect(d.x - 2, d.y - 2, 4, 4); ctx.fillRect(d.x + d.w - 2, d.y - 2, 4, 4); break;
      }
    }
  }

  function drawRoadMarks(vx0, vy0, vx1, vy1) {
    var i, j, c;
    var i0 = Math.max(0, Math.floor(vx0 / CELL) - 1), i1 = Math.min(N - 1, Math.floor(vx1 / CELL));
    var j0 = Math.max(0, Math.floor(vy0 / CELL) - 1), j1 = Math.min(N - 1, Math.floor(vy1 / CELL));
    ctx.fillStyle = '#e8c547';
    for (j = j0; j <= j1; j++) {
      c = j * CELL + ROAD / 2;
      for (i = i0; i <= i1; i++) {
        var xa = i * CELL + ROAD + 44, xb = (i + 1) * CELL - 44;
        ctx.fillRect(xa, c - 3.5, xb - xa, 2); ctx.fillRect(xa, c + 1.5, xb - xa, 2);
      }
    }
    for (i = i0; i <= i1; i++) {
      c = i * CELL + ROAD / 2;
      for (j = j0; j <= j1; j++) {
        if (j >= N - 1 + 0 && j > 7) continue;
        var ya = j * CELL + ROAD + 44, yb = (j + 1) * CELL - 44;
        if (j === 7) continue;
        ctx.fillRect(c - 3.5, ya, 2, yb - ya); ctx.fillRect(c + 1.5, ya, 2, yb - ya);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (j = j0; j <= j1; j++) {
      var cy = j * CELL;
      for (i = i0; i <= i1; i++) {
        var x0 = i * CELL;
        /* crosswalks across horizontal road (both sides of intersection) */
        var xs = [x0 + ROAD + 8, x0 + CELL - 38];
        for (var q = 0; q < 2; q++) for (var yy = cy + 10; yy < cy + ROAD - 8; yy += 12) ctx.fillRect(xs[q], yy, 30, 6);
        if (j < 7) {
          var ys = [cy + ROAD + 8, cy + CELL - 38];
          for (q = 0; q < 2; q++) for (var xx = x0 + 10; xx < x0 + ROAD - 8; xx += 12) ctx.fillRect(xx, ys[q], 6, 30);
        }
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (j = j0; j <= j1; j++) { ctx.fillRect(vx0, j * CELL + 4, vx1 - vx0, 2); ctx.fillRect(vx0, j * CELL + ROAD - 6, vx1 - vx0, 2); }
    for (i = i0; i <= i1; i++) { ctx.fillRect(i * CELL + 4, vy0, 2, Math.min(vy1, W.SAND_Y) - vy0); ctx.fillRect(i * CELL + ROAD - 6, vy0, 2, Math.min(vy1, W.SAND_Y) - vy0); }
  }

  function drawGround(vx0, vy0, vx1, vy1) {
    ctx.fillStyle = '#17331f'; ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    if (vx0 < 0 || vy0 < 0 || vx1 > W.WIDTH) drawForest(vx0, vy0, vx1, vy1);
    ctx.fillStyle = '#383b43'; ctx.fillRect(0, 0, W.WIDTH, W.SAND_Y);
    ctx.fillStyle = '#f0dfaa'; ctx.fillRect(0, W.SAND_Y, W.WIDTH, W.SEA_Y - W.SAND_Y);
    ctx.fillStyle = '#e3cf92'; ctx.fillRect(0, W.SEA_Y - 14, W.WIDTH, 14);
    drawSea(vx0, vy0, vx1, vy1);
    drawRoadMarks(Math.max(0, vx0), Math.max(0, vy0), Math.min(W.WIDTH, vx1), Math.min(W.SAND_Y, vy1));
    var i0 = Math.max(0, Math.floor((vx0 - ROAD) / CELL)), i1 = Math.min(N - 1, Math.floor(vx1 / CELL));
    var j0 = Math.max(0, Math.floor((vy0 - ROAD) / CELL)), j1 = Math.min(N - 1, Math.floor(vy1 / CELL));
    for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
      var b = W.blocks[j * N + i];
      if (b.type !== 'beach') {
        ctx.fillStyle = '#cfcabf'; ctx.fillRect(b.x0, b.y0, BS, BS);
        ctx.fillStyle = '#9d988c'; ctx.fillRect(b.x0, b.y0, BS, 2); ctx.fillRect(b.x0, b.y0 + BS - 2, BS, 2);
        ctx.fillRect(b.x0, b.y0, 2, BS); ctx.fillRect(b.x0 + BS - 2, b.y0, 2, BS);
        ctx.fillStyle = b.ground; ctx.fillRect(b.x0 + SW, b.y0 + SW, BS - 2 * SW, BS - 2 * SW);
      }
      drawDecor(b);
    }
    ctx.strokeStyle = '#8a8f98'; ctx.lineWidth = 10;
    ctx.strokeRect(-5, -5, W.WIDTH + 10, W.SEA_Y + 5);
  }

  /* ---------- buildings & trees ---------- */
  function faceQuad(ax, ay, bx, by, cx, cy, dx, dy, color, sh, b, faceId, height, edgeLen) {
    ctx.fillStyle = shade(color, sh);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); ctx.closePath(); ctx.fill();
    if (!b.win) return;
    var th = Math.sqrt((dx - ax) * (dx - ax) + (dy - ay) * (dy - ay));
    if (th < 6) return;
    var tower = b.kind === 'tower';
    var F = Math.max(1, Math.floor(height / (tower ? 34 : 38))), n = Math.max(1, Math.floor(edgeLen / (tower ? 24 : 28)));
    if (F * n > 260) { F = Math.min(F, 14); n = Math.min(n, 18); }
    var lf = night > 0.3 ? 0.55 : 0.3, pass, f, c, lit;
    for (pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      var cnt = 0;
      for (f = 0; f < F; f++) for (c = 0; c < n; c++) {
        lit = G.hash2(b.sid * 7 + faceId * 131 + f, c) < lf;
        if ((pass === 1) !== lit) continue;
        var u0 = (c + 0.2) / n, u1 = (c + 0.8) / n, t0 = (f + 0.25) / F, t1 = (f + 0.75) / F;
        var p00x = (1 - t0) * (ax + (bx - ax) * u0) + t0 * (dx + (cx - dx) * u0), p00y = (1 - t0) * (ay + (by - ay) * u0) + t0 * (dy + (cy - dy) * u0);
        var p10x = (1 - t0) * (ax + (bx - ax) * u1) + t0 * (dx + (cx - dx) * u1), p10y = (1 - t0) * (ay + (by - ay) * u1) + t0 * (dy + (cy - dy) * u1);
        var p11x = (1 - t1) * (ax + (bx - ax) * u1) + t1 * (dx + (cx - dx) * u1), p11y = (1 - t1) * (ay + (by - ay) * u1) + t1 * (dy + (cy - dy) * u1);
        var p01x = (1 - t1) * (ax + (bx - ax) * u0) + t1 * (dx + (cx - dx) * u0), p01y = (1 - t1) * (ay + (by - ay) * u0) + t1 * (dy + (cy - dy) * u0);
        ctx.moveTo(p00x, p00y); ctx.lineTo(p10x, p10y); ctx.lineTo(p11x, p11y); ctx.lineTo(p01x, p01y); ctx.closePath();
        cnt++;
        if (pass === 1 && night > 0.3 && litWins.length < 12000) litWins.push(p00x, p00y, p10x, p10y, p11x, p11y, p01x, p01y);
      }
      if (cnt) {
        if (pass === 0) ctx.fillStyle = night > 0.3 ? 'rgba(12,16,30,0.8)' : 'rgba(18,36,64,0.55)';
        else ctx.fillStyle = night > 0.3 ? 'rgba(255,214,120,0.95)' : 'rgba(200,230,255,0.7)';
        ctx.fill();
      }
    }
  }

  /* draws side faces of a box between base height hb and top height ht; returns roof rect */
  var roofR = [0, 0, 0, 0];
  function drawBox(b, x0, y0, x1, y1, hb, ht, wall, windows) {
    var sb = 1 + hb * PK, st = 1 + ht * PK, cx = cam.x, cy = cam.y;
    var bx0 = cx + (x0 - cx) * sb, by0 = cy + (y0 - cy) * sb, bx1 = cx + (x1 - cx) * sb, by1 = cy + (y1 - cy) * sb;
    var tx0 = cx + (x0 - cx) * st, ty0 = cy + (y0 - cy) * st, tx1 = cx + (x1 - cx) * st, ty1 = cy + (y1 - cy) * st;
    var saveWin = b.win; b.win = windows && saveWin;
    var hgt = ht - hb, wl = x1 - x0, hl = y1 - y0;
    if (cx < x0) faceQuad(bx0, by1, bx0, by0, tx0, ty0, tx0, ty1, wall, -0.14, b, 1, hgt, hl);
    if (cx > x1) faceQuad(bx1, by0, bx1, by1, tx1, ty1, tx1, ty0, wall, -0.22, b, 2, hgt, hl);
    if (cy < y0) faceQuad(bx0, by0, bx1, by0, tx1, ty0, tx0, ty0, wall, -0.04, b, 3, hgt, wl);
    if (cy > y1) faceQuad(bx1, by1, bx0, by1, tx0, ty1, tx1, ty1, wall, -0.3, b, 4, hgt, wl);
    b.win = saveWin;
    roofR[0] = tx0; roofR[1] = ty0; roofR[2] = tx1; roofR[3] = ty1;
    return roofR;
  }

  function drawBuilding(b) {
    var H = b.H, r, x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
    if (b.kind === 'house' || b.kind === 'hut') {
      drawBox(b, x0, y0, x1, y1, 0, H, b.wall, true);
      var s2 = 1 + (H + 12) * PK, cx = cam.x, cy = cam.y, e = 5;
      var rx0 = cx + (x0 - e - cx) * s2, ry0 = cy + (y0 - e - cy) * s2, rx1 = cx + (x1 + e - cx) * s2, ry1 = cy + (y1 + e - cy) * s2;
      var horiz = b.w >= b.h, mx = (rx0 + rx1) / 2, my = (ry0 + ry1) / 2;
      ctx.fillStyle = shade(b.roof, 0.12);
      if (horiz) ctx.fillRect(rx0, ry0, rx1 - rx0, my - ry0); else ctx.fillRect(rx0, ry0, mx - rx0, ry1 - ry0);
      ctx.fillStyle = shade(b.roof, -0.2);
      if (horiz) ctx.fillRect(rx0, my, rx1 - rx0, ry1 - my); else ctx.fillRect(mx, ry0, rx1 - mx, ry1 - ry0);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1; ctx.beginPath();
      if (horiz) { for (var yy = ry0 + 6; yy < ry1; yy += 7) { ctx.moveTo(rx0, yy); ctx.lineTo(rx1, yy); } }
      else { for (var xx = rx0 + 6; xx < rx1; xx += 7) { ctx.moveTo(xx, ry0); ctx.lineTo(xx, ry1); } }
      ctx.stroke();
      ctx.strokeStyle = shade(b.roof, -0.4); ctx.lineWidth = 2; ctx.beginPath();
      if (horiz) { ctx.moveTo(rx0, my); ctx.lineTo(rx1, my); } else { ctx.moveTo(mx, ry0); ctx.lineTo(mx, ry1); }
      ctx.stroke();
      if (b.kind === 'house') {
        var chx = x0 + b.w * 0.72, chy = y0 + b.h * 0.3;
        r = drawBox(b, chx, chy, chx + 9, chy + 9, H + 8, H + 26, '#8b5e3c', false);
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
      }
      return;
    }
    r = drawBox(b, x0, y0, x1, y1, 0, H, b.wall, true);
    var rw = r[2] - r[0], rh = r[3] - r[1];
    ctx.fillStyle = b.roof; ctx.fillRect(r[0], r[1], rw, rh);
    ctx.strokeStyle = shade(b.roof, 0.25); ctx.lineWidth = 3; ctx.strokeRect(r[0] + 1.5, r[1] + 1.5, rw - 3, rh - 3);
    ctx.fillStyle = shade(b.roof, -0.15);
    ctx.fillRect(r[0] + rw * 0.12, r[1] + rh * 0.14, rw * 0.16, rh * 0.14);
    ctx.fillRect(r[0] + rw * 0.62, r[1] + rh * 0.58, rw * 0.2, rh * 0.16);
    if (b.kind === 'tower' && b.tier) {
      var ix = b.w * 0.2, iy = b.h * 0.2;
      var t0 = b.tier ? 55 : 0;
      r = drawBox(b, x0 + ix, y0 + iy, x1 - ix, y1 - iy, H, H + t0, shade(b.wall, -0.1), true);
      ctx.fillStyle = shade(b.roof, 0.1); ctx.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
      var s3 = 1 + (H + t0) * PK, s4 = 1 + (H + t0 + 80) * PK, ccx = x0 + b.w / 2, ccy = y0 + b.h / 2;
      var ax = cam.x + (ccx - cam.x) * s3, ay = cam.y + (ccy - cam.y) * s3, tx = cam.x + (ccx - cam.x) * s4, ty = cam.y + (ccy - cam.y) * s4;
      ctx.strokeStyle = '#9aa0aa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = (Math.floor(S.clock * 1.5 + b.sid) % 2) ? '#ff3030' : '#661010';
      ctx.beginPath(); ctx.arc(tx, ty, 2.6, 0, TAU); ctx.fill();
      if (night > 0.3 && redLights.length < 80) redLights.push(tx, ty);
    } else if (b.kind === 'tower' && b.w > 180 && b.h > 180) {
      ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r[0] + rw / 2, r[1] + rh / 2, Math.min(rw, rh) * 0.24, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#f8fafc'; ctx.font = 'bold ' + Math.floor(Math.min(rw, rh) * 0.24) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('H', r[0] + rw / 2, r[1] + rh / 2 + 1);
    }
  }

  function drawTree(t) {
    var h = t.h, s = 1 + h * PK * 1.3, px = cam.x + (t.x - cam.x) * s, py = cam.y + (t.y - cam.y) * s, R = t.r * s;
    ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = t.trunk * 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(px, py); ctx.stroke(); ctx.lineCap = 'butt';
    var pl = S.player, dd = Math.sqrt((pl.x - px) * (pl.x - px) + (pl.y - py) * (pl.y - py));
    var a = (dd < R * 0.95 && !pl.vehicle) ? 0.5 : 1;
    if (a < 1) ctx.globalAlpha = a;
    var k;
    if (t.kind === 'pine') {
      for (k = 0; k < 2; k++) {
        ctx.fillStyle = k ? t.c2 : t.c1; ctx.beginPath();
        var rad = R * (k ? 0.55 : 1);
        for (var q = 0; q < 16; q++) { var rr = q % 2 ? rad * 0.55 : rad, an = q * TAU / 16 + t.seed; ctx.lineTo(px + Math.cos(an) * rr, py + Math.sin(an) * rr); }
        ctx.closePath(); ctx.fill();
      }
    } else if (t.kind === 'palm') {
      for (k = 0; k < 9; k++) {
        var an2 = k * TAU / 9 + t.seed, ex = px + Math.cos(an2) * R * 1.05, ey = py + Math.sin(an2) * R * 1.05;
        ctx.fillStyle = k % 2 ? t.c1 : t.c3;
        ctx.beginPath(); ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + Math.cos(an2 - 0.35) * R * 0.7, py + Math.sin(an2 - 0.35) * R * 0.7, ex, ey);
        ctx.quadraticCurveTo(px + Math.cos(an2 + 0.35) * R * 0.7, py + Math.sin(an2 + 0.35) * R * 0.7, px, py);
        ctx.fill();
      }
      ctx.fillStyle = '#6b4423'; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.arc(px + 2, py + 3, R, 0, TAU); ctx.fill();
      for (k = 0; k < 5; k++) {
        var an3 = t.seed + k * 1.2566;
        ctx.fillStyle = k % 2 ? t.c1 : t.c3;
        ctx.beginPath(); ctx.arc(px + Math.cos(an3) * R * 0.42, py + Math.sin(an3) * R * 0.42, R * 0.62, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = t.c1; ctx.beginPath(); ctx.arc(px, py, R * 0.7, 0, TAU); ctx.fill();
      ctx.fillStyle = t.c2; ctx.beginPath(); ctx.arc(px - R * 0.22, py - R * 0.25, R * 0.34, 0, TAU); ctx.fill();
      if (t.kind === 'blossom') {
        ctx.fillStyle = '#ffffff';
        for (k = 0; k < 8; k++) { var an4 = t.seed * 3 + k * 0.8; ctx.beginPath(); ctx.arc(px + Math.cos(an4) * R * 0.55, py + Math.sin(an4 * 1.3) * R * 0.5, 1.6, 0, TAU); ctx.fill(); }
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawLamp(l) {
    var s = 1 + 46 * PK, px = cam.x + (l.x - cam.x) * s, py = cam.y + (l.y - cam.y) * s;
    ctx.strokeStyle = '#3b3f48'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(px, py); ctx.stroke();
    ctx.fillStyle = night > 0.3 ? '#fff4b8' : '#e8e8e8'; ctx.beginPath(); ctx.arc(px, py, 4, 0, TAU); ctx.fill();
  }

  /* ---------- people ---------- */
  function drawLeg(c, y0, xf, y1, pants, shoes) {
    c.strokeStyle = pants; c.lineWidth = 5.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, y0); c.lineTo(xf, y1); c.stroke();
    c.fillStyle = shoes; c.beginPath(); c.ellipse(xf + 1.8, y1, 4.2, 2.8, 0, 0, TAU); c.fill();
  }
  function drawArm(c, sy, hx, hy, col) {
    c.strokeStyle = col; c.lineWidth = 4.6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0.5, sy); c.lineTo(hx, hy); c.stroke();
  }
  function drawGun(c, w, flash) {
    if (w === 'pistol') { c.fillStyle = '#2b2f38'; c.fillRect(12, 2.4, 11, 2.8); c.fillStyle = '#6b7280'; c.fillRect(12, 2.4, 11, 0.9); }
    else if (w === 'smg') { c.fillStyle = '#252a33'; c.fillRect(11, 1.8, 16, 3.6); c.fillStyle = '#111'; c.fillRect(27, 2.6, 5, 1.6); c.fillStyle = '#374151'; c.fillRect(17, 5.2, 3, 6); }
    else if (w === 'shotgun') { c.fillStyle = '#7c4a21'; c.fillRect(7, 2.2, 8, 3.2); c.fillStyle = '#2b2f38'; c.fillRect(15, 2.4, 23, 2.2); c.fillStyle = '#7c4a21'; c.fillRect(22, 2, 7, 3.2); }
    if (flash > 0) {
      var mx = w === 'pistol' ? 26 : (w === 'smg' ? 35 : 41);
      c.fillStyle = '#fff2a8'; c.beginPath();
      for (var i = 0; i < 10; i++) { var rr = i % 2 ? 3 : 8, a = i * TAU / 10; c.lineTo(mx + Math.cos(a) * rr, 3.8 + Math.sin(a) * rr); }
      c.closePath(); c.fill();
    }
  }

  function drawBody(c, p, pose) {
    var L = p.look, bw = L.bw, ph = pose.ph, wa = pose.wa, dead = pose.dead, ride = pose.ride, wn = pose.weapon;
    var step = Math.sin(ph) * 8 * wa, jac = L.jacket ? shade(L.shirt, -0.18) : L.shirt, ly = 4.2 * bw;
    var wdef = WEAPONS[wn] || WEAPONS.fist, armed = !ride && !dead && !wdef.melee, atk = pose.atk;
    /* legs */
    if (dead) { drawLeg(c, -ly, -6, -7, L.pants, L.shoes); drawLeg(c, ly, -2, 8, L.pants, L.shoes); }
    else if (ride === 'cycle') { var pd = Math.sin(ph) * 7; drawLeg(c, -ly, pd, -5, L.pants, L.shoes); drawLeg(c, ly, -pd, 5, L.pants, L.shoes); }
    else if (ride === 'bike') { drawLeg(c, -ly, 1, -8, L.pants, L.shoes); drawLeg(c, ly, 1, 8, L.pants, L.shoes); }
    else { drawLeg(c, -ly, step, -ly, L.pants, L.shoes); drawLeg(c, ly, -step, ly, L.pants, L.shoes); }
    /* torso */
    var lean = ride ? 1.5 : 0;
    c.fillStyle = jac; c.beginPath(); c.ellipse(lean, 0, 5.8, 10 * bw, 0, 0, TAU); c.fill();
    c.strokeStyle = shade(L.shirt, -0.4); c.lineWidth = 1; c.stroke();
    if (L.stripe) { c.strokeStyle = L.stripe; c.lineWidth = 1.8; c.beginPath(); c.moveTo(lean - 5, 0); c.lineTo(lean + 5, 0); c.stroke(); }
    /* arms */
    var sh = 9 * bw, lhx, lhy, rhx, rhy;
    if (dead) { lhx = -5; lhy = -15; rhx = -3; rhy = 14; }
    else if (ride) { lhx = 11; lhy = -6.5; rhx = 11; rhy = 6.5; }
    else {
      var sw = -step * 0.95;
      lhx = sw * 0.9; lhy = -(sh + 2.5); rhx = -sw * 0.9; rhy = sh + 2.5;
      if (armed) { rhx = 14; rhy = 4; lhx = wn === 'pistol' ? 8 : 12; lhy = wn === 'pistol' ? -2.5 : -2; }
      else if (wn === 'bat') { rhx = 7; rhy = 8; }
      if (atk >= 0 && wdef.melee) {
        var e = Math.sin(atk * Math.PI);
        if (wn === 'fist') { rhx = 6 + 15 * e; rhy = 5; lhx = 8; lhy = -7; } else { rhx = 7 + 4 * e; rhy = 8 - 3 * e; }
      }
    }
    drawArm(c, -sh, lhx, lhy, jac); drawArm(c, sh, rhx, rhy, jac);
    if (armed) drawGun(c, wn, pose.flash);
    if (!dead && !ride && wn === 'bat') {
      c.save(); c.translate(rhx, rhy);
      c.rotate(atk >= 0 ? -1.5 + 2.9 * Math.min(1, atk) : -0.25);
      c.fillStyle = '#c8923f'; c.fillRect(0, -1.6, 30, 3.2); c.fillStyle = '#a8742a'; c.fillRect(18, -2.4, 12, 4.8);
      c.restore();
    }
    c.fillStyle = L.skin;
    c.beginPath(); c.arc(lhx, lhy, 2.5, 0, TAU); c.arc(rhx, rhy, 2.5, 0, TAU); c.fill();
    /* head */
    var hx = lean + 1;
    c.fillStyle = L.skin; c.beginPath(); c.arc(hx, 0, 6.4, 0, TAU); c.fill();
    c.fillStyle = shade(L.skin, -0.14);
    c.beginPath(); c.arc(hx + 0.2, -6.4, 1.7, 0, TAU); c.arc(hx + 0.2, 6.4, 1.7, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(hx + 6.8, 0, 2.3, 1.8, 0, 0, TAU); c.fill();
    var hair = L.hair, hc = L.hairC, sway = Math.sin(ph) * 2.5 * wa;
    if (hair === 'long') {
      c.fillStyle = hc; c.beginPath(); c.moveTo(hx - 3, -5.5); c.quadraticCurveTo(hx - 12, -6 + sway, hx - 17 + sway * 0.4, sway); c.quadraticCurveTo(hx - 12, 6 + sway, hx - 3, 5.5); c.closePath(); c.fill();
    } else if (hair === 'ponytail') {
      c.strokeStyle = hc; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(hx - 6, 0); c.quadraticCurveTo(hx - 10, sway, hx - 14, sway * 1.4); c.stroke();
    } else if (hair === 'bun') { c.fillStyle = hc; c.beginPath(); c.arc(hx - 6.5, 0, 3.6, 0, TAU); c.fill(); }
    if (hair !== 'bald') {
      c.fillStyle = hc; c.beginPath();
      var hr = hair === 'afro' ? 8.6 : (hair === 'buzz' ? 5.4 : 6.3);
      c.arc(hx - (hair === 'afro' ? 1.2 : 0.7), 0, hr, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.16)'; c.beginPath(); c.arc(hx - 2, -2, hr * 0.4, 0, TAU); c.fill();
    } else { c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.ellipse(hx - 1, -1.5, 2.6, 1.6, 0, 0, TAU); c.fill(); }
    var hd = ride === 'bike' ? 'helmet' : L.head;
    if (hd === 'cap') { c.fillStyle = L.capC; c.beginPath(); c.arc(hx, 0, 6.9, 0, TAU); c.fill(); c.fillStyle = shade(L.capC, -0.25); c.beginPath(); c.ellipse(hx + 7, 0, 3.8, 4.8, 0, 0, TAU); c.fill(); }
    else if (hd === 'bandana') { c.fillStyle = '#ff2d2d'; c.beginPath(); c.arc(hx - 0.5, 0, 6.9, 0, TAU); c.fill(); c.fillStyle = '#b81414'; c.beginPath(); c.moveTo(hx - 6, -2); c.lineTo(hx - 12, -4 + sway); c.lineTo(hx - 12, 3 + sway); c.lineTo(hx - 6, 2); c.fill(); }
    else if (hd === 'copcap') { c.fillStyle = '#1e3a8a'; c.beginPath(); c.arc(hx, 0, 7.2, 0, TAU); c.fill(); c.fillStyle = '#0b0b0b'; c.beginPath(); c.ellipse(hx + 7, 0, 3.5, 5, 0, 0, TAU); c.fill(); c.strokeStyle = '#fbbf24'; c.lineWidth = 1.2; c.beginPath(); c.arc(hx, 0, 5, 0, TAU); c.stroke(); }
    else if (hd === 'helmet') { c.fillStyle = '#e11d48'; c.beginPath(); c.arc(hx, 0, 7.4, 0, TAU); c.fill(); c.fillStyle = '#111827'; c.fillRect(hx + 3.5, -5, 3.5, 10); }
  }

  function drawPerson(p) {
    if (p.far) return;
    if (p.x < cam.x - VW / 2 / cam.zoom - 40 || p.x > cam.x + VW / 2 / cam.zoom + 40 || p.y < cam.y - VH / 2 / cam.zoom - 40 || p.y > cam.y + VH / 2 / cam.zoom + 40) return;
    var dead = p.dead;
    if (dead) ctx.globalAlpha = p.deadT > 15 ? clamp((18 - p.deadT) / 3, 0, 1) : 1;
    if (!dead) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + 4, 11, 8, 0, 0, TAU); ctx.fill();
      if (p.kind === 'gang') { ctx.strokeStyle = 'rgba(255,40,40,' + (0.35 + (p.aggro > 0 ? 0.3 : 0)) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, TAU); ctx.stroke(); }
      else if (p.kind === 'cop') { ctx.strokeStyle = 'rgba(60,120,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, TAU); ctx.stroke(); }
      else if (p.kind === 'player') { ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 + Math.sin(S.clock * 4) * 0.12) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, TAU); ctx.stroke(); }
    }
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
    var atk = p.attackT < 0.28 ? p.attackT / 0.28 : -1;
    drawBody(ctx, p, { ph: p.phase, wa: p.walkAmt, dead: dead, ride: null, weapon: p.weapon, atk: atk, flash: p.flash });
    if (p.hitFlash > 0 && !dead) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 11, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
    if (!dead && p.kind !== 'player' && p.kind !== 'civ' && p.hp < p.maxhp) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(p.x - 13, p.y - 24, 26, 4);
      ctx.fillStyle = p.hp / p.maxhp > 0.4 ? '#4ade80' : '#ef4444'; ctx.fillRect(p.x - 12, p.y - 23, 24 * p.hp / p.maxhp, 2);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- vehicles ---------- */
  function drawCar(v) {
    var T = v.t, L = T.len, Wd = T.w, col = v.wreck ? '#1d1d20' : v.color, type = v.type, i;
    var wheelPos = type === 'bus' ? [-0.34, 0.3] : [-0.3, 0.3];
    ctx.fillStyle = '#0d0d0f';
    for (i = 0; i < wheelPos.length; i++) { ctx.fillRect(wheelPos[i] * L - 7, -Wd / 2 - 1.5, 14, 6); ctx.fillRect(wheelPos[i] * L - 7, Wd / 2 - 4.5, 14, 6); }
    rrect(ctx, -L / 2, -Wd / 2, L, Wd, type === 'bus' ? 6 : 10); ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = shade(col, -0.38); ctx.lineWidth = 1.5; ctx.stroke();
    if (v.wreck) { ctx.fillStyle = 'rgba(255,90,0,' + (0.2 + Math.random() * 0.2) + ')'; ctx.fillRect(-L / 2, -Wd / 2, L, Wd); return; }
    if (type === 'bus') {
      ctx.fillStyle = shade(col, 0.18); rrect(ctx, -L / 2 + 6, -Wd / 2 + 4, L - 12, Wd - 8, 4); ctx.fill();
      ctx.fillStyle = '#1c2f48';
      for (i = 0; i < 8; i++) { var wx = -L / 2 + 14 + i * 20; ctx.fillRect(wx, -Wd / 2 + 0.5, 14, 3.2); ctx.fillRect(wx, Wd / 2 - 3.7, 14, 3.2); }
      ctx.fillStyle = '#223a56'; ctx.fillRect(L / 2 - 10, -Wd / 2 + 5, 7, Wd - 10);
      ctx.fillStyle = '#fff'; ctx.fillRect(-L / 2 + 6, -1.5, L - 12, 3);
    } else {
      var glass = '#223a56', cabF = type === 'van' ? 0.05 : 0.12;
      ctx.fillStyle = shade(col, 0.12); rrect(ctx, L * 0.18, -Wd / 2 + 3, L * 0.3, Wd - 6, 6); ctx.fill();
      ctx.fillStyle = glass; rrect(ctx, -L * (type === 'van' ? 0.45 : 0.37), -Wd / 2 + 3.5, L * (type === 'van' ? 0.69 : 0.61), Wd - 7, 6); ctx.fill();
      ctx.fillStyle = shade(col, 0.18); rrect(ctx, -L * (type === 'van' ? 0.43 : 0.27), -Wd / 2 + 7.5, L * (type === 'van' ? 0.45 : 0.39), Wd - 15, 5); ctx.fill();
      ctx.fillStyle = shade(col, -0.1); ctx.fillRect(-L / 2 + 3, -Wd / 2 + 6, L * 0.1, Wd - 12);
      if (type === 'sports') { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(-L / 2 + 6, -3, L - 12, 6); ctx.fillStyle = '#16161a'; ctx.fillRect(-L / 2 + 1, -Wd / 2 + 3, 5, Wd - 6); }
      if (type === 'suv') { ctx.strokeStyle = '#222'; ctx.lineWidth = 1.2; ctx.beginPath(); for (i = 0; i < 3; i++) { ctx.moveTo(-L * 0.2 + i * 9, -Wd / 2 + 8); ctx.lineTo(-L * 0.2 + i * 9, Wd / 2 - 8); } ctx.stroke(); }
      if (type === 'taxi') { ctx.fillStyle = '#fff'; ctx.fillRect(-4, -7, 9, 14); ctx.fillStyle = '#111'; ctx.fillRect(-2, -5, 5, 2); }
      if (type === 'police') {
        ctx.fillStyle = '#111'; ctx.fillRect(-L * 0.18, -Wd / 2 + 0.5, L * 0.3, 5); ctx.fillRect(-L * 0.18, Wd / 2 - 5.5, L * 0.3, 5);
        var fl = Math.floor(S.clock * 6) % 2 === 0 && (S.wanted > 0 || v.ai);
        ctx.fillStyle = fl ? '#ff2020' : '#661010'; ctx.fillRect(-4, -9, 8, 9);
        ctx.fillStyle = fl ? '#1a3a66' : '#2d6bff'; ctx.fillRect(-4, 0, 8, 9);
      }
    }
    var brake = v.brakeOn;
    ctx.fillStyle = night > 0.3 ? '#fff7b0' : '#fff7c2';
    ctx.fillRect(L / 2 - 4, -Wd / 2 + 3, 4, 6); ctx.fillRect(L / 2 - 4, Wd / 2 - 9, 4, 6);
    ctx.fillStyle = brake ? '#ff4040' : '#a01818';
    ctx.fillRect(-L / 2, -Wd / 2 + 3, 3, 6); ctx.fillRect(-L / 2, Wd / 2 - 9, 3, 6);
    ctx.fillStyle = shade(col, -0.25); ctx.fillRect(L * 0.13, -Wd / 2 - 1.5, 3, 2); ctx.fillRect(L * 0.13, Wd / 2 - 0.5, 3, 2);
  }

  function drawBike(v) {
    var L = v.t.len;
    ctx.fillStyle = '#0d0d0f'; rrect(ctx, L * 0.2, -3, 15, 6, 3); ctx.fill(); rrect(ctx, -L * 0.45, -3, 15, 6, 3); ctx.fill();
    ctx.fillStyle = v.color; rrect(ctx, -L * 0.3, -3.5, L * 0.6, 7, 3.5); ctx.fill();
    ctx.fillStyle = shade(v.color, 0.2); ctx.beginPath(); ctx.ellipse(L * 0.04, 0, 8, 5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(L * 0.2, -9); ctx.lineTo(L * 0.2, 9); ctx.stroke();
    ctx.fillStyle = '#fff7b0'; ctx.fillRect(L * 0.45, -2, 3, 4);
    ctx.fillStyle = v.brakeOn ? '#ff4040' : '#a01818'; ctx.fillRect(-L * 0.5, -2, 3, 4);
  }
  function drawCycle(v) {
    var L = v.t.len;
    ctx.fillStyle = '#111'; ctx.fillRect(L * 0.18, -1.5, 15, 3); ctx.fillRect(-L * 0.46, -1.5, 15, 3);
    ctx.strokeStyle = v.color; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-L * 0.28, 0); ctx.lineTo(L * 0.28, 0); ctx.stroke();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(L * 0.2, -8); ctx.lineTo(L * 0.2, 8); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(-L * 0.1, 0, 4, 2.4, 0, 0, TAU); ctx.fill();
  }

  function drawVehicle(v) {
    if (v.sleep) return;
    var T = v.t, m = T.br + 20;
    if (v.x < cam.x - VW / 2 / cam.zoom - m || v.x > cam.x + VW / 2 / cam.zoom + m || v.y < cam.y - VH / 2 / cam.zoom - m || v.y > cam.y + VH / 2 / cam.zoom + m) return;
    ctx.save(); ctx.translate(v.x + 5, v.y + 7); ctx.rotate(v.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; rrect(ctx, -T.len / 2, -T.w / 2, T.len, T.w, 8); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(v.angle);
    if (T.kind === 'cycle') drawCycle(v); else if (T.kind === 'bike') drawBike(v); else drawCar(v);
    var rd = v.driver || v.rider;
    if (rd && T.kind !== 'car' && !v.wreck) drawBody(ctx, rd, { ph: v.wheel * 0.9, wa: 1, dead: false, ride: T.kind, weapon: 'fist', atk: -1, flash: 0 });
    ctx.restore();
  }

  /* ---------- misc ---------- */
  function drawPickup(pk) {
    if (!G.onScreen(pk.x, pk.y, 40)) return;
    var y = pk.y + Math.sin(pk.t * 3) * 2.5, col, r = 13;
    switch (pk.type) { case 'health': col = '#ef4444'; break; case 'armor': col = '#3b82f6'; break; case 'ammo': col = '#f59e0b'; break; case 'cash': col = '#22c55e'; break; default: col = '#a855f7'; }
    ctx.fillStyle = 'rgba(' + (pk.type === 'health' ? '239,68,68' : pk.type === 'armor' ? '59,130,246' : pk.type === 'ammo' ? '245,158,11' : pk.type === 'cash' ? '34,197,94' : '168,85,247') + ',' + (0.22 + Math.sin(pk.t * 4) * 0.08) + ')';
    ctx.beginPath(); ctx.arc(pk.x, y, 22, 0, TAU); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(pk.x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff';
    if (pk.type === 'health') { ctx.fillRect(pk.x - 2.5, y - 7, 5, 14); ctx.fillRect(pk.x - 7, y - 2.5, 14, 5); }
    else if (pk.type === 'armor') { ctx.beginPath(); ctx.moveTo(pk.x - 7, y - 6); ctx.lineTo(pk.x + 7, y - 6); ctx.lineTo(pk.x + 6, y + 2); ctx.lineTo(pk.x, y + 8); ctx.lineTo(pk.x - 6, y + 2); ctx.closePath(); ctx.fill(); }
    else if (pk.type === 'ammo') { for (var i = -1; i <= 1; i++) ctx.fillRect(pk.x + i * 4 - 1.3, y - 6, 2.6, 12); }
    else if (pk.type === 'cash') { ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', pk.x, y + 1); }
    else { ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(pk.type === 'smg' ? 'SMG' : 'SG', pk.x, y + 1); }
  }

  function drawDecals() {
    var D = S.decals;
    for (var i = 0; i < D.length; i++) {
      var d = D[i], a = Math.min(1, d.life / 8);
      if (d.t === 'blood') { ctx.fillStyle = 'rgba(120,10,16,' + (0.7 * a) + ')'; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.7, d.rot, 0, TAU); ctx.fill(); }
      else { ctx.strokeStyle = 'rgba(10,10,10,' + (0.35 * Math.min(1, d.life / 6)) + ')'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x2, d.y2); ctx.stroke(); }
    }
  }

  function drawParts(top) {
    var P = S.parts;
    for (var i = 0; i < P.length; i++) {
      var p = P[i], isTop = p.type === 'smoke' || p.type === 'fire' || p.type === 'ring' || p.type === 'flash';
      if (isTop !== top) continue;
      var a = p.life / p.max;
      switch (p.type) {
        case 'blood': ctx.fillStyle = 'rgba(150,12,20,' + a + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); break;
        case 'spark': ctx.strokeStyle = 'rgba(255,220,110,' + a + ')'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke(); break;
        case 'smoke': ctx.fillStyle = 'rgba(70,70,76,' + (a * 0.5) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); break;
        case 'fire': ctx.fillStyle = 'rgba(255,' + Math.floor(80 + a * 150) + ',20,' + (a * 0.9) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); break;
        case 'flash': ctx.fillStyle = 'rgba(255,240,170,0.9)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); break;
        case 'ring': ctx.strokeStyle = 'rgba(255,200,120,' + (a * 0.8) + ')'; ctx.lineWidth = 6 * a + 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.stroke(); break;
      }
    }
  }

  function drawBullets() {
    var B = S.bullets;
    for (var i = 0; i < B.length; i++) {
      var b = B[i];
      ctx.strokeStyle = b.by === 'player' ? '#fff0b0' : '#ff9a5a'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022); ctx.stroke();
    }
  }

  function drawShadowsAndStatics(vx0, vy0, vx1, vy1) {
    var m = 360;
    var i0 = Math.max(0, Math.floor((vx0 - m - ROAD) / CELL)), i1 = Math.min(N - 1, Math.floor((vx1 + m) / CELL));
    var j0 = Math.max(0, Math.floor((vy0 - m - ROAD) / CELL)), j1 = Math.min(N - 1, Math.floor((vy1 + m) / CELL));
    drawList.length = 0;
    var lamps = [], i, j, k, b;
    ctx.fillStyle = 'rgba(0,0,0,' + (0.24 * (1 - night * 0.7)) + ')';
    for (j = j0; j <= j1; j++) for (i = i0; i <= i1; i++) {
      b = W.blocks[j * N + i];
      for (k = 0; k < b.bld.length; k++) {
        var o = b.bld[k], sx = o.H * 0.28, sy = o.H * 0.2;
        ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + o.w, o.y); ctx.lineTo(o.x + o.w + sx, o.y + sy); ctx.lineTo(o.x + o.w + sx, o.y + o.h + sy);
        ctx.lineTo(o.x + sx, o.y + o.h + sy); ctx.lineTo(o.x, o.y + o.h); ctx.closePath(); ctx.fill();
        drawList.push(o);
      }
      for (k = 0; k < b.trees.length; k++) {
        var t = b.trees[k];
        ctx.beginPath(); ctx.ellipse(t.x + t.h * 0.22, t.y + t.h * 0.16, t.r * 0.95, t.r * 0.7, 0.4, 0, TAU); ctx.fill();
        drawList.push(t);
      }
      for (k = 0; k < b.lamps.length; k++) lamps.push(b.lamps[k]);
    }
    return lamps;
  }

  function lightPass(lamps) {
    ctx.globalCompositeOperation = 'lighter';
    var i, a = night * 0.85;
    ctx.globalAlpha = a;
    for (i = 0; i < lamps.length; i++) { var l = lamps[i]; if (G.onScreen(l.x, l.y, 90)) ctx.drawImage(glow, l.x - 85, l.y - 85, 170, 170); }
    for (i = 0; i < S.cars.length; i++) {
      var v = S.cars[i];
      if (v.sleep || v.wreck || v.t.kind === 'cycle' || !G.onScreen(v.x, v.y, 220)) continue;
      var c = Math.cos(v.angle), s = Math.sin(v.angle);
      ctx.save(); ctx.translate(v.x + c * (v.t.len / 2 + 55), v.y + s * (v.t.len / 2 + 55)); ctx.rotate(v.angle); ctx.scale(1.7, 0.9);
      ctx.drawImage(glow, -90, -90, 180, 180); ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (litWins.length) {
      ctx.fillStyle = 'rgba(255,205,110,0.85)'; ctx.beginPath();
      for (i = 0; i < litWins.length; i += 8) { ctx.moveTo(litWins[i], litWins[i + 1]); ctx.lineTo(litWins[i + 2], litWins[i + 3]); ctx.lineTo(litWins[i + 4], litWins[i + 5]); ctx.lineTo(litWins[i + 6], litWins[i + 7]); ctx.closePath(); }
      ctx.fill();
    }
    ctx.globalAlpha = night;
    for (i = 0; i < redLights.length; i += 2) ctx.drawImage(glow, redLights[i] - 20, redLights[i + 1] - 20, 40, 40);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- main render ---------- */
  G.render = function () {
    dayTint();
    litWins.length = 0; redLights.length = 0;
    var z = cam.zoom, shk = S.shake > 0.1 ? S.shake : 0;
    var ox = shk ? (Math.random() - 0.5) * shk : 0, oy = shk ? (Math.random() - 0.5) * shk : 0;
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (VW / 2 - cam.x * z + ox), dpr * (VH / 2 - cam.y * z + oy));
    var vx0 = cam.x - VW / 2 / z - 40, vx1 = cam.x + VW / 2 / z + 40, vy0 = cam.y - VH / 2 / z - 40, vy1 = cam.y + VH / 2 / z + 40;
    drawGround(vx0, vy0, vx1, vy1);
    drawDecals();
    var lamps = drawShadowsAndStatics(vx0, vy0, vx1, vy1), i;
    for (i = 0; i < S.pickups.length; i++) drawPickup(S.pickups[i]);
    for (i = 0; i < S.peds.length; i++) if (S.peds[i].dead) drawPerson(S.peds[i]);
    for (i = 0; i < S.cars.length; i++) drawVehicle(S.cars[i]);
    for (i = 0; i < S.peds.length; i++) if (!S.peds[i].dead) drawPerson(S.peds[i]);
    var pl = S.player;
    if (!pl.vehicle) drawPerson(pl);
    drawBullets();
    drawParts(false);
    for (i = 0; i < lamps.length; i++) drawLamp(lamps[i]);
    drawList.sort(function (a, b) { return a.z - b.z; });
    for (i = 0; i < drawList.length; i++) { var o = drawList[i]; if (o.isTree) drawTree(o); else drawBuilding(o); }
    drawParts(true);
    /* day / night tint */
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (tint[0] < 250 || tint[1] < 250 || tint[2] < 250) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgb(' + (tint[0] | 0) + ',' + (tint[1] | 0) + ',' + (tint[2] | 0) + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (VW / 2 - cam.x * z + ox), dpr * (VH / 2 - cam.y * z + oy));
    if (night > 0.05) lightPass(lamps);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };
})(window.G = window.G || {});
