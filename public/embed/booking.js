/* Tread Ready booking widget loader — defers to the shared widget core. */
(function () {
  window.__TR_FLOW = "booking";
  var s = document.currentScript;
  var core = document.createElement("script");
  core.src = new URL(s.src).origin + "/embed/widget.js";
  document.head.appendChild(core);
})();
