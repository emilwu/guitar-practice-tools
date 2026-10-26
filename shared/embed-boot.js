/* Classic script for <head>. Marks an iframed tool before the header paints. The module in embed.js adds the back link. */
(function () {
  var inFrame = false;
  try {
    inFrame = window.self !== window.top;
  } catch (err) {
    inFrame = true;
  }
  if (!inFrame) return;
  document.documentElement.classList.add("is-embedded");
  document.addEventListener("DOMContentLoaded", function () {
    document.body.classList.add("is-embedded");
  });
})();
