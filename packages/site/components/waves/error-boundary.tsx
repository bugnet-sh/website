"use client";

import { Component, type ReactNode } from "react";

/** The waves are decoration, so any failure inside them leaves the slot empty and silent. */
export class WavesBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    override state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    override render() {
        return this.state.failed ? null : this.props.children;
    }
}
