import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only cleans up by itself when Vitest's globals are on.
afterEach(cleanup);

// jsdom has <dialog> but not its methods. These do the part tests can see:
// the dialog opens, closes and fires "close" a moment later, as a browser
// does. What only a browser does (the focus trap, the inert page, Escape,
// returning the focus) isn't tested here.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  if (!this.hasAttribute("open")) return;
  this.removeAttribute("open");
  setTimeout(() => this.dispatchEvent(new Event("close")));
};
