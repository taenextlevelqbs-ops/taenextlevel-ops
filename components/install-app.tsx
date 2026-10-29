"use client";
import { useState } from "react";
import { Smartphone, X } from "lucide-react";
export function InstallApp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="install-wrap">
      <button
        className="button secondary"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <Smartphone size={17} /> Add to home screen
      </button>
      {open && (
        <div className="install-help" role="status">
          <button
            onClick={() => setOpen(false)}
            aria-label="Close install instructions"
          >
            <X size={18} />
          </button>
          <strong>Your command center, one tap away.</strong>
          <p>
            On iPhone, open this page in Safari. Tap Share, then Add to Home
            Screen, and turn on Open as Web App.
          </p>
          <p>
            On Android or desktop, choose Install app from your browser menu.
          </p>
          <small>A connection is required to view current business data.</small>
        </div>
      )}
    </div>
  );
}
