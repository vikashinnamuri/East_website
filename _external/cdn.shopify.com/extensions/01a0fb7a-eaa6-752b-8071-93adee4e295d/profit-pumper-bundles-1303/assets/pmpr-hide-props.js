"use strict";
// Hides Pumper's internal cart-line properties (`__pumper_*` / `_pumper_*`)
// wherever a theme prints them as text (cart page, drawers, mini-carts).
// Loads on EVERY page (app-embed, outside the product-template gate) because
// the cart page is not a product page.
//
// SCOPED RESCAN CONTRACT (2026-09-03): after the one initial full scan, only
// the subtrees a mutation actually touched are rescanned. The previous shape
// re-ran a whole-document `querySelectorAll` + textContent read (thousands of
// nodes on a PDP) on every mutation batch — PSI attributed 112-183ms of CPU
// to this 1.4KB file. Never reintroduce a full-document scan in the observer
// path; cost here must stay proportional to the DOM that changed.
(() => {
  window.pumper = window.pumper || {};
  if (window.pumper.hideCartProps) return;
  window.pumper.hideCartProps = true;

  const PREFIXES = ["__pumper_", "_pumper_"];
  const MAX_TEXT_LENGTH = 300;
  const SCAN_SELECTORS = "span, li, p, div, dd, dt, td";

  const containsPumperText = (text) => {
    const trimmed = text.trimStart();
    return PREFIXES.some((prefix) => trimmed.startsWith(prefix));
  };

  const hasInteractiveChild = (el) =>
    Boolean(el.querySelector("a, img, form, button, input, select"));

  const hideIfPumperProp = (el) => {
    const text = el.textContent ?? "";
    if (text.length > MAX_TEXT_LENGTH) return;
    if (!containsPumperText(text)) return;
    if (hasInteractiveChild(el)) return;
    el.style.setProperty("display", "none", "important");
  };

  const scanWithin = (root) => {
    if (typeof root.matches === "function" && root.matches(SCAN_SELECTORS))
      hideIfPumperProp(root);
    root.querySelectorAll(SCAN_SELECTORS).forEach(hideIfPumperProp);
  };

  // rAF-coalesced queue of touched subtree roots. A text-node target maps to
  // its parent element so replaced text (theme re-render) is still caught.
  const pendingRoots = new Set();
  let rafId = null;
  const flushPendingRoots = () => {
    rafId = null;
    pendingRoots.forEach((root) => {
      if (root.isConnected) scanWithin(root);
    });
    pendingRoots.clear();
  };
  const queueRoot = (node) => {
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!el) return;
    pendingRoots.add(el);
    if (rafId) return;
    rafId = requestAnimationFrame(flushPendingRoots);
  };

  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach(queueRoot);
      // Removals can unlock a previously skipped parent (its interactive
      // child left) — rescan the removal's parent, same as the old
      // whole-document rescan would have caught.
      if (record.removedNodes.length > 0) queueRoot(record.target);
    });
  });

  const startObserving = () => {
    observer.observe(document.body, { childList: true, subtree: true });
    scanWithin(document.body);
  };

  if (document.body) {
    startObserving();
  } else {
    document.addEventListener("DOMContentLoaded", startObserving, {
      once: true
    });
  }
})();
