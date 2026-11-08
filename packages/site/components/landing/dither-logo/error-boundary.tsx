"use client";

import { Component, type ReactNode } from "react";

/** The dither is decoration over a plain mark, so any failure inside it shows the mark. */
export class LogoBoundary extends Component<
    { children: ReactNode; fallback: ReactNode },
    { failed: boolean }
> {
    override state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    override render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}
