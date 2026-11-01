/* Open City - people: player, civilians, red gang, police. Made by Ayushdev */
(function (G) {
  'use strict';
  var S = G.S, W = G.world, TAU = G.TAU;
  var clamp = G.clamp, rand = G.rand, pick = G.pick, angDiff = G.angDiff;

  var WEAPONS = G.WEAPONS = {
    fist:    { name: 'Fists', melee: true, dmg: 14, range: 30, rate: 0.36, kb: 90 },
    bat:     { name: 'Baseball Bat', melee: true, dmg: 34, range: 50, rate: 0.62, kb: 200 },
    pistol:  { name: 'Pistol', dmg: 26, rate: 0.28, spread: 0.035, speed: 1050, range: 720, pellets: 1, snd: 'pistol' },
    smg:     { name: 'SMG', dmg: 13, rate: 0.082, spread: 0.1, speed: 1150, range: 650, pellets: 1, snd: 'smg' },
    shotgun: { name: 'Shotgun', dmg: 12, rate: 0.85, spread: 0.2, speed: 950, range: 360, pellets: 7, snd: 'shotgun' }
  };
  G.WORDER = ['fist', 'bat', 'pistol', 'smg', 'shotgun'];

  var SKIN = ['#f5d0b0', '#e8b98d', '#d39c6b', '#b9814f', '#8d5a35', '#6b4226'];
  var HAIRC = ['#1a1a1a', '#2b1b12', '#3b2314', '#6b4423', '#a0522d', '#d9b36c', '#e8d28a', '#8a8a8a', '#b5521b'];
  var SHIRT = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#eab308', '#e5e7eb', '#06b6d4', '#84cc16', '#a855f7'];
  var PANTS = ['#1f2937', '#374151', '#4b5563', '#78350f', '#1e3a8a', '#111827', '#6b7280', '#0f766e'];
  var SHOES = ['#111827', '#f9fafb', '#6b7280', '#78350f'];

  var makeLook = G.makeLook = function (kind) {
    var L = { skin: pick(SKIN), hairC: pick(HAIRC), hair: 'short', shirt: '#3b82f6', pants: '#1f2937', shoes: '#111827', head: 'none', capC: '#2563eb', jacket: false, stripe: null, bw: 1, female: false };
    var female = Math.random() < 0.45;
    if (kind === 'civ') {
      L.female = female; L.bw = female ? 0.88 : 1 + rand(0, 0.08);
      L.shirt = pick(SHIRT); L.pants = pick(PANTS); L.shoes = pick(SHOES);
      L.hair = female ? pick(['long', 'long', 'bun', 'short', 'ponytail']) : pick(['short', 'short', 'bald', 'afro', 'cap', 'buzz']);
      if (L.hair === 'cap') { L.head = 'cap'; L.capC = pick(['#2563eb', '#16a34a', '#f59e0b', '#111827']); L.hair = 'short'; }
      L.jacket = Math.random() < 0.3;
    } else if (kind === 'gang') {
      L.bw = 1.06 + rand(0, 0.06);
      L.shirt = '#d62828'; L.pants = '#16161a'; L.shoes = '#f9fafb'; L.jacket = true; L.stripe = '#161616';
      L.hair = pick(['short', 'buzz', 'bald', 'afro', 'short']);
      L.head = pick(['bandana', 'bandana', 'cap', 'none']); L.capC = '#b91c1c';
    } else if (kind === 'cop') {
      L.bw = 1.04; L.shirt = '#1e40af'; L.pants = '#0f172a'; L.shoes = '#0b0b0b'; L.jacket = true; L.stripe = '#fbbf24';
      L.hair = 'short'; L.head = 'copcap';
    } else {
      L.bw = 1.02; L.skin = '#e0ac80'; L.hairC = '#1a1a1a'; L.hair = 'short';
      L.shirt = '#14b8a6'; L.pants = '#2b2f38'; L.shoes = '#f9fafb'; L.jacket = true; L.stripe = '#ffffff';
    }
    return L;
  };

  G.newPerson = function (kind, x, y, o) {
    o = o || {};
    var p = {
      kind: kind, x: x, y: y, angle: rand(0, TAU), r: 10, hp: 40, maxhp: 40, armor: 0, kx: 0, ky: 0,
      phase: rand(0, TAU), walkAmt: 0, curSpeed: 0, attackT: 9, cool: 0, hitT: -1, flash: 0, hitFlash: 0,
      weapon: 'fist', look: makeLook(kind), dead: false, deadT: 0, state: 'wander', timer: rand(0, 3),
      tx: x, ty: y, fx: x, fy: y, fleeT: 0, aggro: 0, homeX: x, homeY: y, stuckT: 0, sx: x, sy: y,
      strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 0, leaveT: 0, vehicle: null,
      walkSpeed: rand(60, 86), runSpeed: 150, remove: false, far: false, shots: 0, group: o.group || 0
    };
    if (kind === 'civ') { p.hp = p.maxhp = 40; }
    else if (kind === 'gang') {
      p.hp = p.maxhp = 55 + Math.min(S.level, 8) * 6;
      var r = Math.random(), lv = S.level;
      p.weapon = r < 0.3 ? 'fist' : (r < 0.55 ? 'bat' : (r < 0.88 || lv < 2 ? 'pistol' : (lv >= 3 && r > 0.96 ? 'shotgun' : 'smg')));
      p.runSpeed = rand(118, 138); p.walkSpeed = rand(50, 66);
    } else if (kind === 'cop') {
      p.hp = p.maxhp = 85; p.runSpeed = rand(132, 150);
      p.weapon = S.wanted >= 4 ? 'shotgun' : (S.wanted >= 3 ? 'smg' : 'pistol');
    } else if (kind === 'player') {
      p.hp = p.maxhp = 100; p.armor = 0; p.weapon = 'fist';
      p.has = { fist: true, bat: true, pistol: true, smg: false, shotgun: false };
      p.ammo = { pistol: 48, smg: 0, shotgun: 0 };
    }
    if (kind !== 'player') S.peds.push(p);
    return p;
  };

  /* ---------- helpers ---------- */
  function turnTo(p, a, dt, rate) {
    var d = angDiff(p.angle, a), m = rate * dt;
    p.angle += clamp(d, -m, m);
  }
  function clampWorld(p) {
    p.x = clamp(p.x, 24, W.WIDTH - 24);
    p.y = clamp(p.y, 24, W.SEA_Y - 14);
  }
  function walk(p, dx, dy, spd, dt) {
    if (spd > 0) { p.x += dx * spd * dt; p.y += dy * spd * dt; }
    p.x += p.kx * dt; p.y += p.ky * dt;
    var kd = Math.max(0, 1 - 7 * dt); p.kx *= kd; p.ky *= kd;
    W.resolve(p, p.r);
    clampWorld(p);
    p.walkAmt += ((spd > 8 ? 1 : 0) - p.walkAmt) * Math.min(1, dt * 12);
    p.phase += spd * dt * 0.09;
    p.curSpeed = spd;
  }

  G.addHeat = function (h) {
    S.heat = Math.min(5.99, S.heat + h);
    S.crimeT = 0;
  };

  G.alertNoise = function (x, y, r, byPlayer) {
    var list = S.peds;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (p.dead || p.far) continue;
      var dx = p.x - x, dy = p.y - y;
      if (dx * dx + dy * dy > r * r) continue;
      if (p.kind === 'civ') { p.state = 'flee'; p.fx = x; p.fy = y; p.fleeT = rand(4, 8); }
      else if (p.kind === 'gang' && byPlayer && p.aggro <= 0) p.aggro = 5;
    }
  };

  /* ---------- damage / death ---------- */
  G.hurt = function (p, dmg, sx, sy, byPlayer, kb) {
    if (p.dead) return;
    if (p.kind === 'player') {
      if (S.over) return;
      if (p.armor > 0) { var a = Math.min(p.armor, dmg * 0.6); p.armor -= a; dmg -= a; }
      p.hp -= dmg;
      S.hurt = Math.min(1, S.hurt + 0.35);
      S.shake = Math.min(12, S.shake + 2.5);
      G.audio.hurt();
      if (p.hp <= 0) { p.hp = 0; G.killPlayer(); }
      return;
    }
    p.hp -= dmg; p.hitFlash = 0.15;
    var ang = Math.atan2(p.y - sy, p.x - sx);
    if (kb) { p.kx += Math.cos(ang) * kb; p.ky += Math.sin(ang) * kb; }
    G.fx.blood(p.x, p.y, ang, 4);
    if (p.kind === 'civ') { p.state = 'flee'; p.fx = sx; p.fy = sy; p.fleeT = rand(5, 9); }
    else if (byPlayer) p.aggro = Math.max(p.aggro, 8);
    if (p.hp <= 0) { die(p, byPlayer); return; }
    if (byPlayer) { if (p.kind === 'cop') G.addHeat(0.35); else if (p.kind === 'civ') G.addHeat(0.15); }
  };

  function die(p, byPlayer) {
    p.dead = true; p.deadT = 0; p.hp = 0; p.state = 'dead'; p.flash = 0;
    G.decal('blood', p.x, p.y, rand(14, 22));
    G.fx.blood(p.x, p.y, rand(0, TAU), 10);
    if (!byPlayer) return;
    if (p.kind === 'gang') {
      var r = 120 + Math.floor(rand(0, 130));
      S.money += r; S.kills++; S.totalKills++;
      G.toast('Red gang member down  +$' + r, 'good');
      G.audio.cash();
      if (Math.random() < 0.2) G.spawnPickup(Math.random() < 0.5 ? 'ammo' : 'health', p.x, p.y, true);
      G.checkMission();
    } else if (p.kind === 'cop') {
      G.addHeat(1.4); S.money += 60;
      G.toast('Police officer down', 'bad');
    } else if (p.kind === 'civ') {
      G.addHeat(1.0);
      G.toast('Civilian casualty - police alerted', 'bad');
    }
  }

  G.killPlayer = function () {
    var p = S.player;
    if (p.vehicle) { var v = p.vehicle; v.driver = null; p.vehicle = null; }
    p.dead = true; S.over = true;
    G.audio.engine(false, 0);
    G.fx.blood(p.x, p.y, 0, 12);
    G.decal('blood', p.x, p.y, 24);
    if (G.ui && G.ui.showOver) G.ui.showOver();
  };

  G.respawnPlayer = function () {
    var p = S.player;
    p.dead = false; p.hp = p.maxhp; p.armor = 0; p.vehicle = null;
    p.x = W.START.x; p.y = W.START.y + 40; p.angle = 0; p.kx = p.ky = 0; p.cool = 0;
    S.over = false; S.heat = 0; S.wanted = 0; S.hurt = 0;
    S.money = Math.floor(S.money * 0.9);
    for (var i = 0; i < S.peds.length; i++) {
      var q = S.peds[i];
      if (q.kind === 'cop') q.leaveT = 99;
      if (q.kind === 'gang' && G.dist(q.x, q.y, p.x, p.y) < 700) q.remove = true;
    }
    if (G.ui && G.ui.hideOver) G.ui.hideOver();
  };

  /* ---------- weapons ---------- */
  G.switchWeapon = function (slot) {
    var p = S.player; if (p.dead || p.vehicle) return;
    var name = G.WORDER[slot];
    if (!name || !p.has[name]) { G.toast('Weapon not owned yet', 'info'); return; }
    p.weapon = name; G.audio.click();
  };
  G.nextWeapon = function () {
    var p = S.player; if (p.dead || p.vehicle) return;
    var i = G.WORDER.indexOf(p.weapon);
    for (var k = 1; k <= G.WORDER.length; k++) {
      var n = G.WORDER[(i + k) % G.WORDER.length];
      if (p.has[n] && (WEAPONS[n].melee || p.ammo[n] > 0)) { p.weapon = n; G.audio.click(); return; }
    }
  };

  function nearestTarget(p, maxD) {
    var best = null, bd = maxD * maxD, list = S.peds;
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (t.dead || t.far || t.kind === 'civ') continue;
      var dx = t.x - p.x, dy = t.y - p.y, d2 = dx * dx + dy * dy;
      if (d2 > bd) continue;
      var off = Math.abs(angDiff(p.angle, Math.atan2(dy, dx)));
      var score = d2 * (1 + off * 0.8);
      if (score < bd) { bd = score; best = t; }
    }
    return best;
  }

  function fireBullets(p, w, extra) {
    var a = p.angle, c = Math.cos(a), s = Math.sin(a);
    var mx = p.x + c * 22 - s * 4, my = p.y + s * 22 + c * 4;
    var isP = p.kind === 'player';
    var mul = isP ? 1 : 0.42;
    for (var i = 0; i < w.pellets; i++) {
      var ang = a + (Math.random() - 0.5) * 2 * (w.spread + extra);
      S.bullets.push({ x: mx, y: my, vx: Math.cos(ang) * w.speed, vy: Math.sin(ang) * w.speed, dmg: w.dmg * mul, life: w.range / w.speed, by: isP ? 'player' : 'enemy' });
    }
    p.flash = 0.06;
    G.fx.flash(mx, my);
    G.audio.shoot(w.snd, G.audio.near(p.x, p.y));
    G.alertNoise(p.x, p.y, 650, isP);
    if (isP) { S.shake = Math.min(8, S.shake + (p.weapon === 'shotgun' ? 3 : 1)); }
  }

  function tryAttack(p) {
    if (p.cool > 0) return;
    var w = WEAPONS[p.weapon];
    if (!w.melee && p.kind === 'player') {
      if ((p.ammo[p.weapon] || 0) <= 0) {
        p.cool = 0.35; G.audio.click(); G.toast('Out of ammo - switched to fists', 'info');
        p.weapon = 'fist'; return;
      }
      p.ammo[p.weapon]--;
    }
    p.cool = w.rate; p.attackT = 0;
    if (w.melee) { p.hitT = 0.09; G.audio.punch(G.audio.near(p.x, p.y)); }
    else fireBullets(p, w, 0);
  }

  function meleeResolve(p) {
    var w = WEAPONS[p.weapon], isP = p.kind === 'player', hits = 0;
    var targets = isP ? S.peds : [S.player];
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      if (!t || t.dead || t === p) continue;
      if (t.kind === 'player' && (t.vehicle || S.over)) continue;
      var dx = t.x - p.x, dy = t.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > w.range + t.r) continue;
      if (Math.abs(angDiff(p.angle, Math.atan2(dy, dx))) > 1.05 && d > t.r + 8) continue;
      G.hurt(t, w.dmg * (isP ? 1 : 0.6), p.x, p.y, isP, w.kb);
      G.audio.hit();
      hits++;
      if (hits >= (p.weapon === 'bat' ? 2 : 1)) break;
    }
  }

  /* ---------- player ---------- */
  G.updatePlayer = function (dt) {
    var p = S.player, I = G.input;
    if (p.dead) return;
    p.attackT += dt; p.cool -= dt; p.flash -= dt; p.hitFlash -= dt;
    if (p.hitT > 0) { p.hitT -= dt; if (p.hitT <= 0) { p.hitT = -1; meleeResolve(p); } }
    if (p.vehicle) return;

    var mx = (I.right ? 1 : 0) - (I.left ? 1 : 0) + I.jx;
    var my = (I.down ? 1 : 0) - (I.up ? 1 : 0) + I.jy;
    var len = Math.sqrt(mx * mx + my * my);
    if (len > 1) { mx /= len; my /= len; len = 1; }
    var moving = len > 0.12;
    var moveAng = moving ? Math.atan2(my, mx) : p.angle;
    var spd = moving ? (I.run ? 178 : 108) * (I.touch ? Math.max(0.55, len) : 1) : 0;
    var w = WEAPONS[p.weapon], aim = null;
    if (I.mouse && !I.touch) aim = Math.atan2(I.aimY - p.y, I.aimX - p.x);
    else if (I.touch && I.taim !== null && I.taim !== undefined) aim = I.taim;
    else if (I.fire) {
      var tg = nearestTarget(p, w.melee ? 90 : 560);
      if (tg) aim = Math.atan2(tg.y - p.y, tg.x - p.x);
    }
    turnTo(p, aim !== null ? aim : (moving ? moveAng : p.angle), dt, 16);
    walk(p, Math.cos(moveAng), Math.sin(moveAng), spd, dt);
    if (I.fire) tryAttack(p);
  };

  /* ---------- AI ---------- */
  function pickTarget(p, leash) {
    for (var i = 0; i < 6; i++) {
      var a = rand(0, TAU), d = rand(90, 300);
      var tx = p.x + Math.cos(a) * d, ty = p.y + Math.sin(a) * d;
      if (leash && G.dist(tx, ty, p.homeX, p.homeY) > leash) continue;
      if (tx < 40 || ty < 40 || tx > W.WIDTH - 40 || ty > W.SEA_Y - 40) continue;
      if (W.blocked(tx, ty, 10)) continue;
      p.tx = tx; p.ty = ty; p.timer = rand(4, 9); return;
    }
    p.state = 'idle'; p.timer = rand(1, 3);
  }

  function wander(p, dt, leash, speed) {
    p.timer -= dt;
    if (p.state === 'idle') {
      walk(p, 0, 0, 0, dt);
      if (p.timer <= 0) { p.state = 'wander'; pickTarget(p, leash); }
      return;
    }
    var dx = p.tx - p.x, dy = p.ty - p.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 14 || p.timer <= 0) {
      if (Math.random() < 0.35) { p.state = 'idle'; p.timer = rand(1.5, 5); }
      else pickTarget(p, leash);
      walk(p, 0, 0, 0, dt);
      return;
    }
    turnTo(p, Math.atan2(dy, dx), dt, 8);
    walk(p, Math.cos(p.angle), Math.sin(p.angle), speed, dt);
    p.stuckT += dt;
    if (p.stuckT > 0.8) {
      if (G.dist(p.x, p.y, p.sx, p.sy) < 6) pickTarget(p, leash);
      p.sx = p.x; p.sy = p.y; p.stuckT = 0;
    }
  }

  function updateCiv(p, dt) {
    var pl = S.player;
    if (p.state !== 'flee' && pl.vehicle && Math.abs(pl.vehicle.speed) > 130) {
      var vx = pl.x - p.x, vy = pl.y - p.y;
      if (vx * vx + vy * vy < 150 * 150) { p.state = 'flee'; p.fx = pl.x; p.fy = pl.y; p.fleeT = rand(2.5, 4); }
    }
    if (p.state === 'flee') {
      var ang = Math.atan2(p.y - p.fy, p.x - p.fx) + Math.sin(p.phase * 0.25) * 0.35;
      turnTo(p, ang, dt, 12);
      walk(p, Math.cos(p.angle), Math.sin(p.angle), 168, dt);
      p.fleeT -= dt;
      if (p.fleeT <= 0) { p.state = 'wander'; p.timer = 0; pickTarget(p, 0); }
    } else {
      wander(p, dt, 0, p.walkSpeed);
    }
  }

  function alertGroup(p) {
    if (!p.group) return;
    var list = S.peds;
    for (var i = 0; i < list.length; i++) {
      var q = list[i];
      if (q.group === p.group && !q.dead && G.dist(q.x, q.y, p.x, p.y) < 420) q.aggro = Math.max(q.aggro, 6);
    }
  }

  function enemyShoot(p, d) {
    var w = WEAPONS[p.weapon];
    fireBullets(p, w, 0.02 + d * 0.00022);
    p.shots++;
    if (p.weapon === 'smg') p.cool = (p.shots % 4 === 0) ? 1.1 : 0.2;
    else if (p.weapon === 'shotgun') p.cool = 1.6 + Math.random() * 0.4;
    else p.cool = 0.8 + Math.random() * 0.6;
    p.attackT = 0;
  }

  function updateHostile(p, dt) {
    var pl = S.player, cop = p.kind === 'cop';
    var alive = !pl.dead && !S.over;
    var dx = pl.x - p.x, dy = pl.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
    var seen = false;
    if (alive) {
      var vr = cop ? 900 : (pl.vehicle ? 480 : 430);
      if (d < vr) seen = W.clearLine(p.x, p.y, pl.x, pl.y);
    }
    if (cop) {
      if (S.wanted > 0 && alive) { p.aggro = 5; p.leaveT = 0; }
      else { p.aggro = 0; p.leaveT += dt; }
    } else {
      if (seen && p.aggro <= 0) alertGroup(p);
      if (seen) p.aggro = 7; else p.aggro -= dt;
    }
    var w = WEAPONS[p.weapon];
    if (p.hitT > 0) { p.hitT -= dt; if (p.hitT <= 0) { p.hitT = -1; meleeResolve(p); } }
    if (p.aggro > 0 && alive) {
      var ang = Math.atan2(dy, dx), ca = Math.cos(ang), sa = Math.sin(ang);
      if (w.melee) {
        var rr = w.range + pl.r + 6;
        if (d > rr) { turnTo(p, ang, dt, 10); walk(p, ca, sa, p.runSpeed, dt); }
        else {
          turnTo(p, ang, dt, 14); walk(p, 0, 0, 0, dt);
          if (p.cool <= 0 && !pl.vehicle) { p.cool = w.rate * 1.5 + rand(0, 0.4); p.attackT = 0; p.hitT = 0.12; G.audio.punch(G.audio.near(p.x, p.y)); }
        }
      } else {
        var pref = cop ? 210 : 250;
        turnTo(p, ang, dt, 12);
        if (!seen || d > pref + 60) walk(p, ca, sa, p.runSpeed, dt);
        else if (d < pref - 90) walk(p, -ca, -sa, 70, dt);
        else {
          p.strafeT -= dt;
          if (p.strafeT <= 0) { p.strafe = -p.strafe; p.strafeT = rand(1.2, 2.6); }
          walk(p, -sa * p.strafe, ca * p.strafe, 55, dt);
        }
        if (seen && d < 520 && p.cool <= 0 && Math.abs(angDiff(p.angle, ang)) < 0.25) enemyShoot(p, d);
      }
    } else {
      wander(p, dt, cop ? 0 : 220, cop ? p.walkSpeed : p.walkSpeed);
    }
  }

  function updatePerson(p, dt) {
    p.attackT += dt; p.cool -= dt; p.flash -= dt; p.hitFlash -= dt;
    if (p.dead) {
      p.deadT += dt;
      p.x += p.kx * dt; p.y += p.ky * dt;
      var kd = Math.max(0, 1 - 6 * dt); p.kx *= kd; p.ky *= kd;
      W.resolve(p, p.r * 0.8);
      if (p.deadT > 18) p.remove = true;
      return;
    }
    if (p.kind === 'civ') updateCiv(p, dt); else updateHostile(p, dt);
  }

  G.updatePeds = function (dt) {
    var pl = S.player, list = S.peds, i, j;
    for (i = list.length - 1; i >= 0; i--) {
      var p = list[i];
      var dx = p.x - pl.x, dy = p.y - pl.y;
      if (dx * dx + dy * dy > 1900 * 1900) { p.far = true; continue; }
      p.far = false;
      updatePerson(p, dt);
      if (p.remove) list.splice(i, 1);
    }
    /* soft separation */
    for (i = 0; i < list.length; i++) {
      var a = list[i];
      if (a.dead || a.far) continue;
      for (j = i + 1; j < list.length; j++) {
        var b = list[j];
        if (b.dead || b.far) continue;
        var ex = b.x - a.x; if (ex > 24 || ex < -24) continue;
        var ey = b.y - a.y; if (ey > 24 || ey < -24) continue;
        var d2 = ex * ex + ey * ey, rad = (a.r + b.r) * 0.95;
        if (d2 < rad * rad && d2 > 0.01) {
          var d = Math.sqrt(d2), push = (rad - d) * 0.5;
          a.x -= ex / d * push; a.y -= ey / d * push; b.x += ex / d * push; b.y += ey / d * push;
        }
      }
      if (!pl.vehicle && !pl.dead) {
        var qx = a.x - pl.x, qy = a.y - pl.y, q2 = qx * qx + qy * qy, rr2 = (a.r + pl.r) * 0.95;
        if (q2 < rr2 * rr2 && q2 > 0.01) {
          var qd = Math.sqrt(q2), pp = rr2 - qd;
          a.x += qx / qd * pp; a.y += qy / qd * pp;
        }
      }
    }
  };
})(window.G = window.G || {});
