/* Open City - HUD, minimap, toasts. Made by Ayushdev */
(function (G) {
  'use strict';
  var S = G.S, W = G.world;
  var ui = G.ui = {};
  var el = {}, mm, mctx, MS = 300, acc = 0, last = {};

  function $(id) { return document.getElementById(id); }

  ui.init = function () {
    ['hp-fill', 'ar-fill', 'money', 'w-name', 'w-ammo', 'm-text', 'm-fill', 'clock', 'prompt', 'toasts', 'speedo', 'vignette', 'hp-num', 'gameover', 'go-stats', 't-fire', 't-act'].forEach(function (id) { el[id] = $(id); });
    el.stars = document.querySelectorAll('#stars .star');
    mm = $('minimap'); mctx = mm ? mm.getContext('2d') : null;
    if (mm) { mm.width = MS; mm.height = MS; }
  };

  G.toast = function (msg, cls) {
    if (!el.toasts) return;
    var d = document.createElement('div');
    d.className = 'toast ' + (cls || 'info'); d.textContent = msg;
    el.toasts.appendChild(d);
    while (el.toasts.children.length > 4) el.toasts.removeChild(el.toasts.firstChild);
    setTimeout(function () { d.classList.add('out'); }, 2600);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 3200);
  };

  ui.showOver = function () {
    if (!el.gameover) return;
    el['go-stats'].textContent = 'Red gang down: ' + S.totalKills + '   |   Cash: $' + S.money;
    el.gameover.classList.remove('hidden');
  };
  ui.hideOver = function () { if (el.gameover) el.gameover.classList.add('hidden'); };

  function set(key, id, val, prop) {
    if (last[key] === val) return;
    last[key] = val;
    if (el[id]) { if (prop === 'w') el[id].style.width = val; else el[id].textContent = val; }
  }

  var MMC = { downtown: '#5d6679', mixed: '#717a8e', suburb: '#4f8a4b', park: '#3da34e', plaza: '#a39b84', beach: '#e5d29b' };

  function drawMini() {
    if (!mctx) return;
    var p = S.player, R = 620, k = MS / (2 * R), c = mctx, i;
    c.save();
    c.clearRect(0, 0, MS, MS);
    c.beginPath(); c.arc(MS / 2, MS / 2, MS / 2 - 2, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#10151d'; c.fillRect(0, 0, MS, MS);
    c.translate(MS / 2, MS / 2); c.scale(k, k); c.translate(-p.x, -p.y);
    c.fillStyle = '#2d323d'; c.fillRect(0, 0, W.WIDTH, W.SAND_Y);
    c.fillStyle = '#e5d29b'; c.fillRect(0, W.SAND_Y, W.WIDTH, W.SEA_Y - W.SAND_Y);
    c.fillStyle = '#1f6f99'; c.fillRect(-2000, W.SEA_Y, W.WIDTH + 4000, 3000);
    var i0 = Math.max(0, Math.floor((p.x - R - 140) / W.CELL)), i1 = Math.min(W.N - 1, Math.floor((p.x + R) / W.CELL));
    var j0 = Math.max(0, Math.floor((p.y - R - 140) / W.CELL)), j1 = Math.min(W.N - 1, Math.floor((p.y + R) / W.CELL));
    for (var j = j0; j <= j1; j++) for (i = i0; i <= i1; i++) {
      var b = W.blocks[j * W.N + i];
      if (b.type === 'beach') continue;
      c.fillStyle = MMC[b.type]; c.fillRect(b.x0, b.y0, W.BS, W.BS);
    }
    var r = 5 / k * 0.55;
    for (i = 0; i < S.pickups.length; i++) { var pk = S.pickups[i]; c.fillStyle = '#facc15'; c.fillRect(pk.x - r * 0.6, pk.y - r * 0.6, r * 1.2, r * 1.2); }
    for (i = 0; i < S.cars.length; i++) { var v = S.cars[i]; if (v.sleep) continue; c.fillStyle = v.wreck ? '#555' : '#e5e7eb'; c.fillRect(v.x - r * 0.7, v.y - r * 0.7, r * 1.4, r * 1.4); }
    for (i = 0; i < S.peds.length; i++) {
      var q = S.peds[i];
      if (q.dead || q.far || q.kind === 'civ') continue;
      c.fillStyle = q.kind === 'gang' ? '#ff3030' : '#3b82f6';
      c.beginPath(); c.arc(q.x, q.y, r, 0, Math.PI * 2); c.fill();
    }
    c.translate(p.x, p.y); c.rotate(p.angle + Math.PI / 2);
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1 / k;
    c.beginPath(); c.moveTo(0, -r * 1.7); c.lineTo(r * 1.2, r * 1.2); c.lineTo(0, r * 0.5); c.lineTo(-r * 1.2, r * 1.2); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }

  ui.update = function (dt) {
    if (!el.money || !S.player) return;
    acc += dt;
    var p = S.player;
    if (el.vignette) el.vignette.style.opacity = Math.min(1, S.hurt + (p.hp < 30 ? 0.35 : 0)).toFixed(2);
    if (acc < 0.1) return;
    acc = 0;
    set('hp', 'hp-fill', Math.max(0, p.hp / p.maxhp * 100).toFixed(0) + '%', 'w');
    set('hpn', 'hp-num', Math.ceil(p.hp) + '');
    set('ar', 'ar-fill', Math.max(0, p.armor).toFixed(0) + '%', 'w');
    set('money', 'money', '$' + S.money.toLocaleString('en-US'));
    var w = G.WEAPONS[p.weapon];
    set('wn', 'w-name', p.vehicle ? p.vehicle.t.name : w.name);
    set('wa', 'w-ammo', p.vehicle ? Math.round(Math.abs(p.vehicle.speed) * 0.45) + ' km/h' : (w.melee ? 'Melee' : (p.ammo[p.weapon] || 0) + ' rounds'));
    set('mt', 'm-text', 'Red Gang  ' + S.kills + ' / ' + S.target + '   (Lv ' + S.level + ')');
    set('mf', 'm-fill', Math.min(100, S.kills / S.target * 100).toFixed(0) + '%', 'w');
    var h = G.hourOfDay(), hh = Math.floor(h), mi = Math.floor((h - hh) * 60);
    set('clock', 'clock', (hh < 10 ? '0' : '') + hh + ':' + (mi < 10 ? '0' : '') + mi);
    for (var i = 0; i < el.stars.length; i++) {
      var on = i < S.wanted;
      if (last['s' + i] !== on) { last['s' + i] = on; el.stars[i].classList.toggle('on', on); }
    }
    var pr = '';
    if (!S.over) {
      if (p.vehicle) pr = G.input.touch ? '' : 'E  Exit vehicle';
      else { var v = G.nearestVehicle(p.x, p.y, 42); if (v) pr = (G.input.touch ? 'Tap ENTER to drive ' : 'Press E to drive ') + v.t.name; }
    }
    set('pr', 'prompt', pr);
    if (el.prompt) el.prompt.style.opacity = pr ? 1 : 0;
    if (el['t-act']) set('ta', 't-act', p.vehicle ? 'EXIT' : 'ENTER');
    if (el['t-fire']) set('tf', 't-fire', p.vehicle ? 'BRAKE' : 'FIRE');
    drawMini();
  };
})(window.G = window.G || {});
