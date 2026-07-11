// Hawkeye Sterling RA — intro motion: gauge draw-in, score count-up, pop on change.
(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scoreEl = document.getElementById('totalScore');
  var gaugeArc = document.getElementById('gaugeArc');
  var gaugeWrap = document.querySelector('.gauge-wrap');
  if (!scoreEl || !gaugeArc) return;

  function attachPop() {
    if (reduced || !gaugeWrap) return;
    var obs = new MutationObserver(function () {
      gaugeWrap.classList.remove('pop');
      void gaugeWrap.offsetWidth; // restart animation
      gaugeWrap.classList.add('pop');
      setTimeout(function () { gaugeWrap.classList.remove('pop'); }, 500);
    });
    obs.observe(scoreEl, { childList: true, characterData: true, subtree: true });
  }

  if (reduced) { attachPop(); return; }

  // Gauge draw-in: rewind to 0, then animate to the value recalc() computed.
  var target = gaugeArc.style.strokeDasharray || gaugeArc.getAttribute('stroke-dasharray');
  var finalScore = parseInt(scoreEl.textContent, 10) || 0;
  gaugeArc.style.transition = 'none';
  gaugeArc.style.strokeDasharray = '0 452';
  scoreEl.textContent = '0';

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      gaugeArc.style.transition = 'stroke-dasharray 1.1s cubic-bezier(0.3,0.7,0.2,1)';
      gaugeArc.style.strokeDasharray = target;

      var t0 = performance.now(), dur = 1000;
      function tick(now) {
        var p = Math.min((now - t0) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        scoreEl.textContent = Math.round(eased * finalScore);
        if (p < 1) { requestAnimationFrame(tick); }
        else { scoreEl.textContent = String(finalScore); attachPop(); }
      }
      requestAnimationFrame(tick);
    });
  });
})();
