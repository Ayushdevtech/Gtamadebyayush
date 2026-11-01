/* Open City - cars, bus, motorbike, bicycle, traffic AI. Made by Ayushdev */
(function (G) {
  'use strict';
  var S = G.S, W = G.world, TAU = G.TAU;
  var clamp = G.clamp, rand = G.rand, pick = G.pick, angDiff = G.angDiff;

  var CARCOL = ['#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#ffd166', '#9b5de5', '#06d6a0', '#ef476f', '#f1f5f9', '#1d3557', '#f15bb5', '#00bbf9', '#8ac926', '#ff924c', '#2b2d33'];

  var VT = G.VT = {
    sedan:  { name: 'Sedan',        len: 92,  w: 42, max: 290, acc: 230, turn: 2.3, hp: 120, kind: 'car' },
    sports: { name: 'Sports Car',   len: 90,  w: 40, max: 410, acc: 340, turn: 2.6, hp: 100, kind: 'car' },
    suv:    { name: 'SUV',          len: 100, w: 46, max: 270, acc: 200, turn: 2.0, hp: 170, kind: 'car' },
    taxi:   { name: 'Taxi',         len: 92,  w: 42, max: 290, acc: 230, turn: 2.3, hp: 120, kind: 'car' },
    van:    { name: 'Van',          len: 112, w: 48, max: 240, acc: 170, turn: 1.8, hp: 150, kind: 'car' },
    bus:    { name: 'City Bus',     len: 200, w: 54, max: 190, acc: 110, turn: 1.35, hp: 280, kind: 'car' },
    police: { name: 'Police Car',   len: 92,  w: 42, max: 360, acc: 290, turn: 2.4, hp: 150, kind: 'car' },
    bike:   { name: 'Motorbike',    len: 56,  w: 18, max: 360, acc: 300, turn: 3.0, hp: 60,  kind: 'bike' },
    cycle:  { name: 'Bicycle',      len: 44,  w: 12, max: 150, acc: 120, turn: 3.4, hp: 40,  kind: 'cycle' }
  };
  (function () {
    for (var k in VT) {
      var T = VT[k], half = (T.len - T.w) / 2;
      var n = Math.max(1, Math.round((T.len - T.w) / (T.w * 0.75)) + 1);
      T.co = [];
      if (n === 1) T.co.push(0);
      else for (var i = 0; i < n; i++) T.co.push(-half + i * (2 * half) / (n - 1));
      T.cr = T.w / 2;
      T.br = T.len / 2 + 6;
    }
  })();

  var idc = 0;
  G.newVehicle = function (type, x, y, angle, opts) {
    var T = VT[type];
    var v = {
      id: ++idc, t: T, type: type, x: x, y: y, angle: angle || 0, speed: 0, steer: 0, hp: T.hp, maxhp: T.hp,
      color: pick(CARCOL), driver: null, ai: null, rider: null, wreck: false, wheel: 0, burnT: 0, smokeT: 0,
      horn: 0, brakeOn: false, sleep: false, remove: false, skidT: 0, parkRef: null
    };
    if (type === 'taxi') v.color = '#ffc300';
    else if (type === 'police') v.color = '#f4f4f6';
    else if (type === 'bus') v.color = pick(['#2a9d8f', '#e76f51', '#457b9d', '#f4a261']);
    else if (type === 'cycle') v.color = pick(['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#a855f7']);
    if (opts) for (var k in opts) v[k] = opts[k];
    S.cars.push(v);
    return v;
  };

  function fakeRider(kind) {
    return { kind: 'civ', look: G.makeLook('civ'), phase: rand(0, TAU), walkAmt: 0, weapon: 'fist', attackT: 9, flash: 0, dead: false, angle: 0, x: 0, y: 0 };
  }

  /* ---------- damage ---------- */
  G.damageVehicle = function (v, dmg, byPlayer) {
    if (v.wreck || dmg <= 0) return;
    v.hp -= dmg;
    if (v.hp <= 0) explodeVehicle(v, byPlayer);
  };

  function explodeVehicle(v, byPlayer) {
    v.wreck = true; v.hp = 0; v.burnT = 0;
    v.speed *= 0.3; v.ai = null;
    var p = S.player;
    if (v.driver === p) {
      v.driver = null; p.vehicle = null;
      var a = v.angle;
      p.x = v.x + Math.sin(a) * (v.t.w / 2 + 26); p.y = v.y - Math.cos(a) * (v.t.w / 2 + 26);
      W.resolve(p, p.r);
      G.hurt(p, 35, v.x, v.y, false, 220);
      G.audio.engine(false, 0);
    }
    v.rider = null;
    G.explode(v.x, v.y, byPlayer || false);
  }

  /* ---------- collisions helpers ---------- */
  function circlesOf(v, out) {
    var T = v.t, c = Math.cos(v.angle), s = Math.sin(v.angle);
    for (var i = 0; i < T.co.length; i++) { out[i * 2] = v.x + c * T.co[i]; out[i * 2 + 1] = v.y + s * T.co[i]; }
    return T.co.length;
  }
  var tmpA = [], tmpB = [], tmpO = { x: 0, y: 0 };

  function resolveStatics(v, isDriven) {
    var T = v.t, c = Math.cos(v.angle), s = Math.sin(v.angle), hit = false;
    for (var i = 0; i < T.co.length; i++) {
      tmpO.x = v.x + c * T.co[i]; tmpO.y = v.y + s * T.co[i];
      var ox = tmpO.x, oy = tmpO.y;
      var pen = W.resolve(tmpO, T.cr);
      if (pen > 0) { v.x += tmpO.x - ox; v.y += tmpO.y - oy; hit = true; }
    }
    var margin = 40;
    if (v.x < margin) { v.x = margin; hit = true; } else if (v.x > W.WIDTH - margin) { v.x = W.WIDTH - margin; hit = true; }
    if (v.y < margin) { v.y = margin; hit = true; } else if (v.y > W.SEA_Y - margin) { v.y = W.SEA_Y - margin; hit = true; }
    if (hit) {
      var imp = Math.abs(v.speed);
      if (imp > 70) {
        G.damageVehicle(v, (imp - 50) * (isDriven ? 0.14 : 0.1), false);
        if (imp > 110) { G.fx.spark(v.x + c * T.len / 2, v.y + s * T.len / 2, 5); G.audio.crash(G.audio.near(v.x, v.y)); S.shake = Math.min(10, S.shake + imp * 0.012); }
        if ((T.kind !== 'car') && isDriven && imp > 150) throwRider(v);
      }
      v.speed *= -0.18;
      if (v.ai) v.ai.hitT = 0.6;
    }
  }

  function throwRider(v) {
    var p = v.driver;
    if (!p || p !== S.player) return;
    G.hurt(p, 14, v.x, v.y, false, 0);
    exitVehicle(p, true);
    v.speed = 0;
  }

  /* ---------- AI ---------- */
  var DIRA = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  function dirOK(nd, i, j) {
    if (nd === 0) return i < 7; if (nd === 1) return j < 7; if (nd === 2) return i > 0; return j > 0;
  }

  function obstacleGap(v) {
    var ca = Math.cos(v.angle), sa = Math.sin(v.angle), best = 1e9, T = v.t, look = 230, i;
    var cars = S.cars;
    for (i = 0; i < cars.length; i++) {
      var o = cars[i];
      if (o === v || o.sleep) continue;
      var dx = o.x - v.x, dy = o.y - v.y;
      if (dx > look || dx < -look || dy > look || dy < -look) continue;
      var f = dx * ca + dy * sa;
      if (f <= 0 || f > look) continue;
      var l = Math.abs(-dx * sa + dy * ca);
      var da = angDiff(v.angle, o.angle), cd = Math.abs(Math.cos(da));
      var lim = T.w / 2 + o.t.w / 2 + 12 + (1 - cd) * (o.t.len / 2 - o.t.w / 2) * 0.8;
      if (l < lim) {
        var g = f - T.len / 2 - o.t.w / 2 - (o.t.len / 2 - o.t.w / 2) * cd;
        if (g < best) best = g;
      }
    }
    var peds = S.peds;
    for (i = -1; i < peds.length; i++) {
      var p = i < 0 ? S.player : peds[i];
      if (!p || p.dead || p.far || (i < 0 && p.vehicle)) continue;
      var px = p.x - v.x, py = p.y - v.y;
      if (px > look || px < -look || py > look || py < -look) continue;
      var pf = px * ca + py * sa;
      if (pf <= 0 || pf > look) continue;
      var pl = Math.abs(-px * sa + py * ca);
      if (pl < T.w / 2 + p.r + 10) {
        var pg = pf - T.len / 2 - p.r;
        if (pg < best) best = pg;
      }
    }
    return best;
  }

  function aiDrive(v, dt) {
    var a = v.ai, T = v.t, C = W.CELL, h = W.ROAD / 2;
    var d = a.dir, horiz = (d % 2 === 0), sgn = (d === 0 || d === 1) ? 1 : -1;
    var along = horiz ? v.x : v.y, lat = horiz ? v.y : v.x;
    var idx = Math.round((along - h) / C), ic = idx * C + h;
    var lidx = Math.round((lat - h) / C);
    var ahead = (ic - along) * sgn;
    var ii = horiz ? idx : lidx, jj = horiz ? lidx : idx, key = ii * 10 + jj;
    if (ahead < 10 && ahead > -30 && a.key !== key) {
      a.key = key;
      var cand = [d, (d + 1) % 4, (d + 3) % 4], wts = [0.55, 0.22, 0.23], tot = 0, opts = [], k;
      for (k = 0; k < 3; k++) if (dirOK(cand[k], ii, jj)) { opts.push([cand[k], wts[k]]); tot += wts[k]; }
      var nd = (d + 2) % 4;
      if (opts.length) {
        var r = Math.random() * tot, acc = 0;
        for (k = 0; k < opts.length; k++) { acc += opts[k][1]; if (r <= acc) { nd = opts[k][0]; break; } nd = opts[k][0]; }
      }
      a.dir = nd; d = nd;
      horiz = (d % 2 === 0); sgn = (d === 0 || d === 1) ? 1 : -1;
      along = horiz ? v.x : v.y; lat = horiz ? v.y : v.x;
      idx = Math.round((along - h) / C); ic = idx * C + h; lidx = Math.round((lat - h) / C);
      ahead = (ic - along) * sgn;
    }
    var lc = lidx * C + h, ls = (d === 0 || d === 3) ? 1 : -1;
    var laneT = lc + ls * a.lane;
    var corr = clamp(ls * (laneT - lat) * 0.02, -0.55, 0.55);
    var desired = DIRA[d] + corr;
    var adiff = angDiff(v.angle, desired);
    var target = a.cruise;
    if (Math.abs(adiff) > 0.25) target *= 0.55;
    if (ahead > 0 && ahead < 70) target = Math.min(target, a.cruise * 0.75);
    if (a.hitT > 0) { a.hitT -= dt; target = 0; }
    if (a.ignoreT > 0) a.ignoreT -= dt;
    else {
      var gap = obstacleGap(v);
      if (gap < 230) { var allow = Math.max(0, (gap - 26) * 2.2); if (allow < target) target = allow; }
      if (v.speed < 8 && gap < 70) { a.blockedT += dt; if (a.blockedT > 3.5) { a.ignoreT = 2.5; a.blockedT = 0; } }
      else a.blockedT = Math.max(0, a.blockedT - dt);
    }
    var tm = T.turn * 0.9 * dt;
    v.angle += clamp(adiff, -tm, tm);
    if (v.speed < target) v.speed = Math.min(target, v.speed + T.acc * 0.55 * dt);
    else v.speed = Math.max(target, v.speed - T.acc * 1.6 * dt);
    v.brakeOn = v.speed > target + 5;
    v.steer = clamp(adiff, -0.5, 0.5);
  }

  /* ---------- per-vehicle update ---------- */
  function stepVehicle(v, dt) {
    var T = v.t, I = G.input, drv = v.driver, isPlayer = drv === S.player && drv;
    v.horn = Math.max(0, v.horn - dt);
    var c = Math.cos(v.angle), s = Math.sin(v.angle);

    if (v.wreck) {
      v.burnT += dt;
      v.speed *= Math.max(0, 1 - 2.5 * dt);
      v.x += c * v.speed * dt; v.y += s * v.speed * dt;
      resolveStatics(v, false);
      if (Math.random() < dt * 14) G.fx.fire(v.x, v.y);
      if (Math.random() < dt * 7) G.fx.smoke(v.x, v.y, true);
      if (v.burnT > 28) v.remove = true;
      return;
    }

    if (isPlayer) {
      var throttle = clamp((I.up ? 1 : 0) - (I.down ? 1 : 0) - I.jy, -1, 1);
      var steer = clamp((I.right ? 1 : 0) - (I.left ? 1 : 0) + I.jx, -1, 1);
      var hand = I.fire, sp = v.speed;
      if (throttle > 0) {
        if (sp < 0) sp += T.acc * 2.2 * dt;
        else sp += T.acc * throttle * dt * (1 - Math.max(0, sp) / T.max * 0.85);
        if (sp > T.max) sp = T.max;
      } else if (throttle < 0) {
        if (sp > 0) sp -= T.acc * 2.4 * dt; else sp -= T.acc * 0.7 * dt;
        if (sp < -T.max * 0.35) sp = -T.max * 0.35;
      } else {
        var drag = Math.abs(sp) > 1 ? 70 + Math.abs(sp) * 0.25 : 0;
        if (sp > 0) sp = Math.max(0, sp - drag * dt); else sp = Math.min(0, sp + drag * dt);
      }
      if (hand) { if (sp > 0) sp = Math.max(0, sp - T.acc * 1.6 * dt); else sp = Math.min(0, sp + T.acc * 1.6 * dt); }
      v.speed = sp;
      v.brakeOn = throttle < 0 && sp > 5 || hand;
      var sr = T.turn * clamp(Math.abs(sp) / 70, 0, 1) * (1 - 0.45 * Math.abs(sp) / T.max);
      if (hand && Math.abs(sp) > 80) sr *= 1.45;
      v.angle += steer * sr * (sp >= 0 ? 1 : -1) * dt;
      v.steer += (steer * 0.5 - v.steer) * Math.min(1, dt * 10);
      if (I.horn && v.horn <= 0) { v.horn = 0.4; G.audio.horn(); G.alertNoise(v.x, v.y, 300, false); }
      if (T.kind === 'car' && hand && Math.abs(sp) > 120 || (Math.abs(steer) > 0.5 && Math.abs(sp) > T.max * 0.75)) {
        v.skidT -= dt;
        if (v.skidT <= 0) {
          v.skidT = 0.045;
          var bx = v.x - c * T.len * 0.3, by = v.y - s * T.len * 0.3, ox = -s * T.w * 0.38, oy = c * T.w * 0.38;
          G.skid(bx + ox, by + oy, bx + ox - c * 6, by + oy - s * 6);
          G.skid(bx - ox, by - oy, bx - ox - c * 6, by - oy - s * 6);
          G.fx.smoke(bx, by, false);
        }
      }
    } else if (v.ai) {
      aiDrive(v, dt);
    } else {
      var d2 = Math.abs(v.speed) > 1 ? 140 + Math.abs(v.speed) * 0.5 : 0;
      if (v.speed > 0) v.speed = Math.max(0, v.speed - d2 * dt); else v.speed = Math.min(0, v.speed + d2 * dt);
      v.brakeOn = false;
    }

    c = Math.cos(v.angle); s = Math.sin(v.angle);
    v.x += c * v.speed * dt; v.y += s * v.speed * dt;
    v.wheel += v.speed * dt * 0.12;
    resolveStatics(v, !!isPlayer);

    /* damage effects */
    if (v.hp < v.maxhp * 0.4) {
      v.smokeT -= dt;
      if (v.smokeT <= 0) { v.smokeT = 0.12; G.fx.smoke(v.x + c * T.len * 0.35, v.y + s * T.len * 0.35, false); }
    }
    if (v.hp < 22 && T.kind === 'car') {
      if (Math.random() < dt * 12) G.fx.fire(v.x + c * T.len * 0.3, v.y + s * T.len * 0.3);
      v.hp -= 4 * dt;
      if (v.hp <= 0) explodeVehicle(v, false);
    }
  }

  function vehVsPeds(v) {
    if (v.wreck) return;
    var T = v.t, peds = S.peds, i, k;
    var n = circlesOf(v, tmpA);
    var fast = Math.abs(v.speed) > 65, byP = v.driver === S.player;
    var c = Math.cos(v.angle), s = Math.sin(v.angle);
    for (i = -1; i < peds.length; i++) {
      var p = i < 0 ? S.player : peds[i];
      if (!p || p.dead || p.far) continue;
      if (i < 0 && (p.vehicle || S.over)) continue;
      var dx = p.x - v.x, dy = p.y - v.y;
      if (dx > T.br + 14 || dx < -T.br - 14 || dy > T.br + 14 || dy < -T.br - 14) continue;
      for (k = 0; k < n; k++) {
        var cx = tmpA[k * 2], cy = tmpA[k * 2 + 1];
        var ex = p.x - cx, ey = p.y - cy, d = Math.sqrt(ex * ex + ey * ey), rad = T.cr + p.r;
        if (d >= rad) continue;
        if (fast && !(i < 0 && byP)) {
          if (i < 0 && !byP && p.hitFlash > 0) break;
          var dmg = Math.abs(v.speed) * 0.22;
          var dir = v.speed >= 0 ? 1 : -1;
          p.kx += c * Math.abs(v.speed) * 0.9 * dir; p.ky += s * Math.abs(v.speed) * 0.9 * dir;
          G.hurt(p, dmg, v.x, v.y, byP, 0);
          p.hitFlash = 0.3;
          G.audio.punch(G.audio.near(p.x, p.y));
          v.speed *= 0.96;
        } else {
          var dd = d || 0.01;
          p.x = cx + ex / dd * rad; p.y = cy + ey / dd * rad;
        }
        break;
      }
    }
  }

  function vehVsVeh(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, lim = a.t.br + b.t.br;
    if (dx > lim || dx < -lim || dy > lim || dy < -lim) return;
    var na = circlesOf(a, tmpA), nb = circlesOf(b, tmpB), i, j, hit = false, nx = 0, ny = 0, pen = 0;
    for (i = 0; i < na && !hit; i++) for (j = 0; j < nb; j++) {
      var ex = tmpA[i * 2] - tmpB[j * 2], ey = tmpA[i * 2 + 1] - tmpB[j * 2 + 1];
      var rad = a.t.cr + b.t.cr, d2 = ex * ex + ey * ey;
      if (d2 < rad * rad) {
        var d = Math.sqrt(d2) || 0.01; nx = ex / d; ny = ey / d; pen = rad - d; hit = true; break;
      }
    }
    if (!hit) return;
    var aStatic = a.wreck || (!a.driver && !a.ai && Math.abs(a.speed) < 5);
    var bStatic = b.wreck || (!b.driver && !b.ai && Math.abs(b.speed) < 5);
    var wa = aStatic ? 0.15 : 1, wb = bStatic ? 0.15 : 1, ws = wa + wb;
    a.x += nx * pen * (wa / ws); a.y += ny * pen * (wa / ws);
    b.x -= nx * pen * (wb / ws); b.y -= ny * pen * (wb / ws);
    var rel = Math.abs(a.speed) + Math.abs(b.speed);
    if (rel > 90) {
      var pa = a.driver === S.player, pb = b.driver === S.player;
      G.damageVehicle(a, (rel - 70) * 0.08, pb);
      G.damageVehicle(b, (rel - 70) * 0.08, pa);
      if (rel > 120) { G.audio.crash(G.audio.near(a.x, a.y)); G.fx.spark((a.x + b.x) / 2, (a.y + b.y) / 2, 5); }
      if (pa || pb) S.shake = Math.min(10, S.shake + rel * 0.01);
    }
    a.speed *= 0.6; b.speed *= 0.6;
    if (bStatic && !b.wreck) { var bc = Math.cos(b.angle), bs = Math.sin(b.angle); b.speed += (-nx * bc - ny * bs) * rel * 0.25; }
    if (aStatic && !a.wreck) { var ac = Math.cos(a.angle), as = Math.sin(a.angle); a.speed += (nx * ac + ny * as) * rel * 0.25; }
    if (a.ai) a.ai.hitT = 0.5;
    if (b.ai) b.ai.hitT = 0.5;
  }

  G.updateVehicles = function (dt) {
    var cars = S.cars, pl = S.player, i, j;
    for (i = 0; i < cars.length; i++) {
      var v = cars[i];
      var dx = v.x - pl.x, dy = v.y - pl.y;
      v.sleep = (dx * dx + dy * dy) > 1900 * 1900;
      if (v.sleep) continue;
      stepVehicle(v, dt);
    }
    for (i = 0; i < cars.length; i++) {
      var a = cars[i]; if (a.sleep) continue;
      for (j = i + 1; j < cars.length; j++) { var b = cars[j]; if (b.sleep) continue; vehVsVeh(a, b); }
      vehVsPeds(a);
    }
    for (i = cars.length - 1; i >= 0; i--) {
      if (cars[i].remove) {
        if (cars[i].parkRef) cars[i].parkRef.spawned = false, cars[i].parkRef.dead = cars[i].wreck;
        cars.splice(i, 1);
      }
    }
    if (pl.vehicle) {
      var pv = pl.vehicle;
      pl.x = pv.x; pl.y = pv.y; pl.angle = pv.angle;
      G.audio.engine(!pv.wreck && pv.t.kind !== 'cycle', clamp(Math.abs(pv.speed) / pv.t.max, 0, 1));
    } else G.audio.engine(false, 0);
  };

  /* ---------- enter / exit ---------- */
  function surfaceDist(v, x, y) {
    var T = v.t, c = Math.cos(v.angle), s = Math.sin(v.angle), best = 1e9;
    for (var i = 0; i < T.co.length; i++) {
      var d = G.dist(x, y, v.x + c * T.co[i], v.y + s * T.co[i]) - T.cr;
      if (d < best) best = d;
    }
    return best;
  }
  G.nearestVehicle = function (x, y, maxD) {
    var best = null, bd = maxD;
    for (var i = 0; i < S.cars.length; i++) {
      var v = S.cars[i];
      if (v.wreck || v.sleep || v.driver) { if (!(v.driver && v.ai)) continue; }
      var d = surfaceDist(v, x, y);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  };

  function enterVehicle(p, v) {
    if (v.ai) {
      var T = v.t, a = v.angle;
      var q = G.newPerson('civ', v.x - Math.sin(a) * (T.w / 2 + 16), v.y + Math.cos(a) * (T.w / 2 + 16));
      if (v.rider) q.look = v.rider.look;
      W.resolve(q, q.r);
      q.state = 'flee'; q.fx = p.x; q.fy = p.y; q.fleeT = rand(4, 7);
      v.ai = null; v.rider = null;
      if (T.kind === 'car') { G.addHeat(0.9); G.toast('Carjacked!', 'bad'); }
    }
    v.driver = p; p.vehicle = v;
    p.x = v.x; p.y = v.y; p.angle = v.angle;
    G.audio.click();
    G.toast('Driving: ' + v.t.name, 'info');
  }

  function exitVehicle(p, forced) {
    var v = p.vehicle; if (!v) return;
    var T = v.t, a = v.angle, off = T.w / 2 + 16, placed = false;
    var sides = [1, -1];
    for (var i = 0; i < 2 && !placed; i++) {
      var x = v.x + Math.sin(a) * off * sides[i], y = v.y - Math.cos(a) * off * sides[i];
      if (!W.blocked(x, y, p.r)) { p.x = x; p.y = y; placed = true; }
    }
    if (!placed) { p.x = v.x; p.y = v.y; W.resolve(p, p.r); }
    if (Math.abs(v.speed) > 230 && !forced) G.hurt(p, 8, v.x, v.y, false, 0);
    v.driver = null; p.vehicle = null; p.angle = a; p.kx = p.ky = 0;
  }
  G.exitVehicle = exitVehicle;

  G.interact = function () {
    var p = S.player;
    if (p.dead || S.over) return;
    if (p.vehicle) { exitVehicle(p, false); return; }
    var v = G.nearestVehicle(p.x, p.y, 42);
    if (v) enterVehicle(p, v);
  };

  /* ---------- traffic spawn ---------- */
  var TRAFFIC = ['sedan', 'sedan', 'sedan', 'sedan', 'sedan', 'sedan', 'sports', 'sports', 'suv', 'suv', 'suv', 'taxi', 'taxi', 'van', 'van', 'bus', 'police', 'bike', 'bike', 'cycle', 'cycle', 'cycle'];

  G.spawnTraffic = function (initial) {
    var pl = S.player, C = W.CELL, h = W.ROAD / 2;
    for (var tries = 0; tries < 14; tries++) {
      var ang = rand(0, TAU), dist = initial ? rand(320, 1500) : rand(750, 1400);
      var px = pl.x + Math.cos(ang) * dist, py = pl.y + Math.sin(ang) * dist;
      var horiz = Math.random() < 0.5, d, x, y, m;
      var type = pick(TRAFFIC), T = VT[type];
      var lane = T.kind === 'cycle' ? 50 : (T.kind === 'bike' ? 44 : 32);
      if (horiz) {
        var j = clamp(Math.round((py - h) / C), 0, 7), cy = j * C + h;
        d = Math.random() < 0.5 ? 0 : 2;
        x = px; y = cy + (d === 0 ? lane : -lane);
        m = ((x % C) + C) % C;
        if (m < W.ROAD + 40 || m > C - 40) continue;
        if (x < 200 || x > 3780) continue;
      } else {
        var i2 = clamp(Math.round((px - h) / C), 0, 7), cx = i2 * C + h;
        d = Math.random() < 0.5 ? 1 : 3;
        x = cx + (d === 1 ? -lane : lane); y = py;
        m = ((y % C) + C) % C;
        if (m < W.ROAD + 40 || m > C - 40) continue;
        if (y < 200 || y > 3780) continue;
      }
      if (!initial && G.onScreen(x, y, 140)) continue;
      var ok = true;
      for (var k = 0; k < S.cars.length; k++) { var o = S.cars[k]; if (Math.abs(o.x - x) < 140 && Math.abs(o.y - y) < 140) { ok = false; break; } }
      if (!ok) continue;
      var v = G.newVehicle(type, x, y, DIRA[d]);
      var cruise = type === 'sports' ? rand(190, 250) : type === 'bus' ? rand(100, 130) : type === 'cycle' ? rand(52, 72) : type === 'bike' ? rand(170, 215) : type === 'van' ? rand(120, 160) : rand(130, 190);
      v.ai = { dir: d, key: -1, cruise: cruise, lane: lane, blockedT: 0, ignoreT: 0, hitT: 0 };
      v.speed = cruise * 0.8;
      if (T.kind !== 'car') v.rider = fakeRider();
      return v;
    }
    return null;
  };

  G.spawnParkedNear = function () {
    var pl = S.player, list = W.parked, n = 0;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.dead) continue;
      var dx = e.x - pl.x, dy = e.y - pl.y, d2 = dx * dx + dy * dy;
      if (!e.spawned) {
        if (d2 < 1300 * 1300 && S.cars.length < 110) {
          var v = G.newVehicle(e.type, e.x, e.y, e.a);
          v.parkRef = e; e.spawned = true; e.v = v; n++;
        }
      } else if (e.v && d2 > 2200 * 2200 && !e.v.driver && !e.v.ai) {
        e.v.remove = true; e.spawned = false; e.v = null;
      }
    }
    return n;
  };
})(window.G = window.G || {});
