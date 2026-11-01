/* Open City - bullets, particles, explosions, pickups. Made by Ayushdev */
(function (G) {
  'use strict';
  var S = G.S, W = G.world, TAU = G.TAU, rand = G.rand, clamp = G.clamp;

  function addPart(o) {
    if (S.parts.length > 420) return;
    o.max = o.life; o.rot = o.rot || 0; o.grow = o.grow || 0; o.drag = o.drag || 0;
    S.parts.push(o);
  }

  G.fx = {
    blood: function (x, y, a, n) {
      for (var i = 0; i < n; i++) {
        var s = rand(40, 190), aa = a + rand(-0.8, 0.8);
        addPart({ type: 'blood', x: x, y: y, vx: Math.cos(aa) * s, vy: Math.sin(aa) * s, life: rand(0.25, 0.6), size: rand(1.4, 3), drag: 5 });
      }
    },
    spark: function (x, y, n) {
      for (var i = 0; i < n; i++) {
        var a = rand(0, TAU), s = rand(80, 260);
        addPart({ type: 'spark', x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.1, 0.28), size: 2, drag: 3 });
      }
    },
    smoke: function (x, y, big) {
      addPart({ type: 'smoke', x: x, y: y, vx: rand(-14, 14), vy: rand(-14, 14), life: rand(0.8, 1.6), size: big ? rand(10, 18) : rand(5, 9), grow: big ? 22 : 12, drag: 1 });
    },
    fire: function (x, y) {
      addPart({ type: 'fire', x: x + rand(-8, 8), y: y + rand(-8, 8), vx: rand(-20, 20), vy: rand(-20, 20), life: rand(0.25, 0.55), size: rand(6, 12), grow: -8, drag: 2 });
    },
    flash: function (x, y) { addPart({ type: 'flash', x: x, y: y, vx: 0, vy: 0, life: 0.06, size: 9 }); },
    ring: function (x, y, r) { addPart({ type: 'ring', x: x, y: y, vx: 0, vy: 0, life: 0.45, size: 10, grow: r * 2.2 }); }
  };

  G.decal = function (t, x, y, r) {
    var l = S.decals; if (l.length > 200) l.shift();
    l.push({ t: t, x: x, y: y, r: r, life: 45, max: 45, rot: rand(0, TAU) });
  };
  G.skid = function (x1, y1, x2, y2) {
    var l = S.decals; if (l.length > 200) l.shift();
    l.push({ t: 'skid', x: x1, y: y1, x2: x2, y2: y2, life: 25, max: 25 });
  };

  G.updateParts = function (dt) {
    var P = S.parts, i;
    for (i = P.length - 1; i >= 0; i--) {
      var p = P[i];
      p.life -= dt;
      if (p.life <= 0) { P[i] = P[P.length - 1]; P.pop(); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.drag) { var k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.size += p.grow * dt;
      if (p.size < 0.5) p.size = 0.5;
    }
    var D = S.decals;
    for (i = D.length - 1; i >= 0; i--) { D[i].life -= dt; if (D[i].life <= 0) D.splice(i, 1); }
    S.shake = Math.max(0, S.shake - dt * 22);
    S.hurt = Math.max(0, S.hurt - dt * 0.7);
  };

  G.explode = function (x, y, byPlayer) {
    var near = G.audio.near(x, y), i, R = 140;
    G.fx.ring(x, y, 130);
    for (i = 0; i < 24; i++) G.fx.fire(x + rand(-20, 20), y + rand(-20, 20));
    for (i = 0; i < 8; i++) G.fx.smoke(x + rand(-20, 20), y + rand(-20, 20), true);
    G.fx.spark(x, y, 14);
    G.audio.boom(near);
    S.shake = Math.min(16, S.shake + 10 * near);
    var list = S.peds.concat([S.player]);
    for (i = 0; i < list.length; i++) {
      var p = list[i];
      if (p.dead) continue;
      var d = G.dist(p.x, p.y, x, y);
      if (d < R) G.hurt(p, 130 * (1 - d / R), x, y, byPlayer, 320 * (1 - d / R));
    }
    for (i = 0; i < S.cars.length; i++) {
      var v = S.cars[i];
      if (v.wreck) continue;
      var dv = G.dist(v.x, v.y, x, y);
      if (dv < R && dv > 1) G.damageVehicle(v, 90 * (1 - dv / R), byPlayer);
    }
    if (byPlayer) G.addHeat(0.5);
    G.alertNoise(x, y, 900, byPlayer);
  };

  G.updateBullets = function (dt) {
    var B = S.bullets, pl = S.player, i, k, j;
    for (i = B.length - 1; i >= 0; i--) {
      var b = B[i], dead = false;
      var steps = Math.max(1, Math.ceil(Math.sqrt(b.vx * b.vx + b.vy * b.vy) * dt / 14)), sdt = dt / steps;
      for (var s = 0; s < steps && !dead; s++) {
        b.x += b.vx * sdt; b.y += b.vy * sdt;
        if (W.pointSolid(b.x, b.y)) { G.fx.spark(b.x, b.y, 4); dead = true; break; }
        if (b.x < 0 || b.y < 0 || b.x > W.WIDTH || b.y > W.HEIGHT) { dead = true; break; }
        if (b.by === 'player') {
          for (k = 0; k < S.peds.length; k++) {
            var p = S.peds[k];
            if (p.dead || p.far) continue;
            var dx = p.x - b.x, dy = p.y - b.y;
            if (dx * dx + dy * dy < (p.r + 2) * (p.r + 2)) { G.hurt(p, b.dmg, b.x - b.vx * 0.02, b.y - b.vy * 0.02, true, 40); G.audio.hit(); dead = true; break; }
          }
        } else {
          if (!pl.dead && !pl.vehicle) {
            var ex = pl.x - b.x, ey = pl.y - b.y;
            if (ex * ex + ey * ey < (pl.r + 2) * (pl.r + 2)) { G.hurt(pl, b.dmg, b.x - b.vx * 0.02, b.y - b.vy * 0.02, false, 0); dead = true; }
          }
          if (!dead) for (k = 0; k < S.peds.length; k++) {
            var q = S.peds[k];
            if (q.dead || q.far || q.kind !== 'civ') continue;
            var qx = q.x - b.x, qy = q.y - b.y;
            if (qx * qx + qy * qy < (q.r + 2) * (q.r + 2)) { G.hurt(q, b.dmg, b.x - b.vx * 0.02, b.y - b.vy * 0.02, false, 30); dead = true; break; }
          }
        }
        if (dead) break;
        for (k = 0; k < S.cars.length && !dead; k++) {
          var v = S.cars[k];
          if (v.wreck || v.sleep) continue;
          var vx = v.x - b.x, vy = v.y - b.y;
          if (vx > v.t.br || vx < -v.t.br || vy > v.t.br || vy < -v.t.br) continue;
          var c = Math.cos(v.angle), sn = Math.sin(v.angle);
          for (j = 0; j < v.t.co.length; j++) {
            var cx = v.x + c * v.t.co[j] - b.x, cy = v.y + sn * v.t.co[j] - b.y;
            if (cx * cx + cy * cy < v.t.cr * v.t.cr) {
              G.damageVehicle(v, b.dmg * 0.55, b.by === 'player');
              if (v.driver === pl && b.by === 'enemy') G.hurt(pl, b.dmg * 0.35, b.x, b.y, false, 0);
              G.fx.spark(b.x, b.y, 3); dead = true; break;
            }
          }
        }
      }
      b.life -= dt;
      if (b.life <= 0) dead = true;
      if (dead) B.splice(i, 1);
    }
  };

  /* ---------- pickups ---------- */
  G.spawnPickup = function (type, x, y, temp) {
    S.pickups.push({ type: type, x: x, y: y, t: rand(0, 6), life: temp ? 25 : -1, temp: !!temp });
  };

  function collect(pk, pl) {
    switch (pk.type) {
      case 'health':
        if (pl.hp >= pl.maxhp) return false;
        pl.hp = Math.min(pl.maxhp, pl.hp + 40); G.toast('Health +40', 'good'); break;
      case 'armor':
        if (pl.armor >= 100) return false;
        pl.armor = Math.min(100, pl.armor + 50); G.toast('Armor +50', 'good'); break;
      case 'ammo':
        pl.ammo.pistol += 30;
        if (pl.has.smg) pl.ammo.smg += 60;
        if (pl.has.shotgun) pl.ammo.shotgun += 10;
        G.toast('Ammo collected', 'good'); break;
      case 'cash':
        var amt = G.randInt(100, 450); S.money += amt; G.toast('Cash +$' + amt, 'gold'); G.audio.cash(); return true;
      case 'smg':
        pl.has.smg = true; pl.ammo.smg += 90; G.toast('SMG acquired - press 4', 'gold'); break;
      case 'shotgun':
        pl.has.shotgun = true; pl.ammo.shotgun += 16; G.toast('Shotgun acquired - press 5', 'gold'); break;
    }
    G.audio.pick();
    return true;
  }

  G.updatePickups = function (dt) {
    var pl = S.player, L = S.pickups;
    for (var i = L.length - 1; i >= 0; i--) {
      var pk = L[i];
      pk.t += dt;
      if (pk.life > 0) { pk.life -= dt; if (pk.life <= 0) { L.splice(i, 1); continue; } }
      if (pl.dead) continue;
      var dx = pl.x - pk.x, dy = pl.y - pk.y, r = pl.vehicle ? 40 : 30;
      if (dx * dx + dy * dy < r * r) {
        if (collect(pk, pl)) {
          L.splice(i, 1);
          if (!pk.temp) S.respawnQ.push({ t: 50 });
        }
      }
    }
  };
})(window.G = window.G || {});
