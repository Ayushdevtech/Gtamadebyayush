/* Open City - world population, missions, wanted level. Made by Ayushdev */
(function (G) {
  'use strict';
  var S = G.S, W = G.world, TAU = G.TAU, rand = G.rand, pick = G.pick;
  var timer = 0, groupId = 1;

  function spawnPoint(minD, maxD, initial) {
    var pl = S.player;
    for (var i = 0; i < 20; i++) {
      var q = W.randomWalkPoint(), d = G.dist(q.x, q.y, pl.x, pl.y);
      if (d < minD || d > maxD) continue;
      if (!initial && G.onScreen(q.x, q.y, 100)) continue;
      return q;
    }
    return null;
  }

  function spawnGang() {
    var q = spawnPoint(700, 1500, false) || (S.clock < 1 ? spawnPoint(350, 1500, true) : null);
    if (!q) return;
    var n = G.randInt(2, 4), id = groupId++;
    for (var i = 0; i < n; i++) {
      var p = G.newPerson('gang', q.x + rand(-30, 30), q.y + rand(-30, 30), { group: id });
      W.resolve(p, p.r);
      p.homeX = q.x; p.homeY = q.y;
    }
  }

  function randomPickupType() {
    var r = Math.random();
    return r < 0.3 ? 'health' : r < 0.45 ? 'armor' : r < 0.7 ? 'ammo' : 'cash';
  }

  G.initWorld = function () {
    var p = G.newPerson('player', W.START.x, W.START.y + 30);
    p.angle = 0;
    S.player = p;
    var cx = W.START.x, cy = W.START.y;
    var car = G.newVehicle('sports', cx + 110, cy + 32, 0, { color: '#ff3d71' });
    G.newVehicle('bike', cx - 100, cy - 32, Math.PI, { color: '#ffd166' });
    G.newVehicle('cycle', cx + 20, cy + 70, 0.4);
    car.speed = 0;
    var i, q;
    for (i = 0; i < 34; i++) {
      q = spawnPoint(220, 1500, true);
      if (q) G.newPerson('civ', q.x, q.y);
    }
    for (i = 0; i < 26; i++) G.spawnTraffic(true);
    G.spawnParkedNear();
    for (i = 0; i < 5; i++) spawnGang();
    for (i = 0; i < 40; i++) {
      q = W.randomWalkPoint();
      G.spawnPickup(randomPickupType(), q.x, q.y);
    }
    q = spawnPoint(250, 700, true) || { x: cx + 200, y: cy + 150 };
    G.spawnPickup('smg', q.x, q.y);
    q = spawnPoint(300, 900, true) || { x: cx - 200, y: cy + 150 };
    G.spawnPickup('shotgun', q.x, q.y);
  };

  G.checkMission = function () {
    if (S.kills >= S.target) {
      var bonus = 2000 + S.level * 1500;
      S.money += bonus;
      G.toast('MISSION COMPLETE  +$' + bonus, 'gold');
      G.audio.cash();
      S.level++; S.kills = 0; S.target = 10 + S.level * 5;
      G.toast('New mission: take down ' + S.target + ' red gang members', 'info');
    }
  };

  function maintain() {
    var pl = S.player, i, civs = 0, gang = 0, cops = 0, traffic = 0;
    for (i = S.peds.length - 1; i >= 0; i--) {
      var p = S.peds[i], d = G.dist(p.x, p.y, pl.x, pl.y);
      if (p.dead) continue;
      if (p.kind === 'civ') { civs++; if (d > 2300) p.remove = true; }
      else if (p.kind === 'gang') { gang++; if (d > 2600) p.remove = true; }
      else if (p.kind === 'cop') { cops++; if (d > 2000 || p.leaveT > 10) p.remove = true; }
    }
    for (i = 0; i < S.cars.length; i++) {
      var v = S.cars[i];
      if (v.ai) { traffic++; if (G.dist(v.x, v.y, pl.x, pl.y) > 2300) v.remove = true; }
      if (v.wreck && v.burnT > 28) v.remove = true;
    }
    var t;
    for (t = 0; t < 3 && civs < 34; t++, civs++) {
      var q = spawnPoint(600, 1300, false);
      if (q) G.newPerson('civ', q.x, q.y);
    }
    for (t = 0; t < 2 && traffic < 24; t++, traffic++) G.spawnTraffic(false);
    var want = Math.min(26, 10 + S.level * 3);
    if (gang < want) spawnGang();
    var wantCops = S.wanted > 0 ? Math.min(12, 2 + S.wanted * 2) : 0;
    if (cops < wantCops && !S.over) {
      var c = spawnPoint(500, 850, false);
      if (c) G.newPerson('cop', c.x, c.y);
    }
    G.spawnParkedNear();
    for (i = S.respawnQ.length - 1; i >= 0; i--) {
      S.respawnQ[i].t -= 0.5;
      if (S.respawnQ[i].t <= 0) {
        S.respawnQ.splice(i, 1);
        var r = W.randomWalkPoint();
        G.spawnPickup(randomPickupType(), r.x, r.y);
      }
    }
  }

  G.updateSpawner = function (dt) {
    timer += dt;
    if (timer >= 0.5) { timer = 0; maintain(); }
    /* wanted level heat */
    S.crimeT += dt;
    if (S.heat > 0 && S.crimeT > 16) S.heat = Math.max(0, S.heat - dt * 0.25);
    var nw = Math.min(5, Math.floor(S.heat + 1e-6));
    if (nw > S.wanted) { G.toast('Wanted level ' + nw + ' - police are coming', 'bad'); }
    else if (nw < S.wanted && nw === 0) G.toast('You lost the cops', 'good');
    S.wanted = nw;
  };
})(window.G = window.G || {});
