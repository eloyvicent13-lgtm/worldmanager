import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGlobe } from '@fortawesome/free-solid-svg-icons';
import { ServerContext } from '@/state/server';
import useIsMinecraft from '@/worldmanager/useIsMinecraft';

/**
 * Puts the World Manager entry in the server sidebar.
 *
 * Stock Pterodactyl builds its sub navigation from the route table, so the
 * routes.ts patch is enough there. Custom themes usually hardcode their own
 * sidebar instead, which no route entry can reach. Rather than patching every
 * theme's markup, this component portals a real NavLink into the theme's
 * navigation and copies the class names of a neighbouring item, so the entry
 * inherits whatever styling that theme uses.
 *
 * The portal never targets a node owned by the theme: it renders into a wrapper
 * this component creates and appends itself. React therefore only ever adds and
 * removes children of that wrapper, and a theme that re-renders its sidebar can
 * never leave React removing a node from a parent it no longer belongs to -
 * which would throw and take down the whole application.
 *
 * Everything that touches the DOM is defensive: if anything goes wrong the
 * component renders nothing rather than crashing the panel.
 */

interface Template {
    link: string;
    icon: string;
    label: string;
}

const groupFor = (base: string): HTMLElement | null => {
    // Preferred: an explicit addons/extensions group exposed by the theme.
    const tagged = document.querySelector<HTMLElement>(
        '[data-theme-layout-group="server:addons"], [data-theme-layout-group="server:extensions"]'
    );
    if (tagged) {
        return tagged;
    }

    // Otherwise sit next to a link every server navigation has.
    for (const path of ['/files', '/backups', '/settings']) {
        const sibling = document.querySelector<HTMLElement>(`a[href="${base}${path}"]`);
        if (sibling?.parentElement) {
            return sibling.parentElement;
        }
    }

    return null;
};

const templateFrom = (group: HTMLElement, base: string): Template => {
    const sample =
        group.querySelector<HTMLElement>('a[href^="/server/"]:not([data-world-manager-portal])') ??
        document.querySelector<HTMLElement>(`a[href="${base}/files"]`);

    const spans = sample ? Array.from(sample.querySelectorAll<HTMLElement>(':scope > span')) : [];

    return {
        link: sample?.className ?? '',
        icon: spans[0]?.className ?? '',
        label: spans[1]?.className ?? '',
    };
};

function Injector(): React.ReactPortal | null {
    const minecraft = useIsMinecraft();
    const id = ServerContext.useStoreState((state) => state.server.data?.id);
    const base = id ? `/server/${id}` : '';

    // Our own wrapper. `display: contents` keeps it invisible to the theme's
    // flex/grid layout, so the injected link lines up like a native one.
    const mount = useRef<HTMLDivElement | null>(null);
    if (mount.current === null && typeof document !== 'undefined') {
        const element = document.createElement('div');
        element.setAttribute('data-world-manager-mount', 'true');
        element.style.display = 'contents';
        mount.current = element;
    }

    const [ready, setReady] = useState(false);
    const [template, setTemplate] = useState<Template | null>(null);
    // True when the panel already renders the entry itself (stock sub navigation),
    // in which case injecting a second one would duplicate it.
    const [native, setNative] = useState(false);

    // The theme owns the sidebar, so watch it for re-renders instead of assuming
    // the nodes found on mount stay around.
    useEffect(() => {
        const element = mount.current;
        if (!element || !base) {
            return;
        }

        let frame = 0;

        const place = () => {
            try {
                const link = document.querySelector('a[href$="/world-manager"]:not([data-world-manager-portal])');
                setNative(!!link);

                const group = groupFor(base);
                if (!group) {
                    setReady(false);

                    return;
                }

                if (element.parentElement !== group) {
                    group.appendChild(element);
                }

                const next = templateFrom(group, base);
                setTemplate((current) =>
                    current && current.link === next.link && current.icon === next.icon && current.label === next.label
                        ? current
                        : next
                );
                setReady(true);
            } catch {
                setReady(false);
            }
        };

        place();

        // Scope the observer to the navigation; watching the whole document would
        // fire on every console line. Coalesce bursts into one pass per frame so
        // appending our own wrapper cannot feed back into a loop.
        const root = document.querySelector('aside') ?? document.querySelector('nav');
        const observer = root
            ? new MutationObserver(() => {
                  cancelAnimationFrame(frame);
                  frame = requestAnimationFrame(place);
              })
            : null;

        observer?.observe(root as Node, { childList: true, subtree: true });

        return () => {
            observer?.disconnect();
            cancelAnimationFrame(frame);
            try {
                element.remove();
            } catch {
                // Already gone with the theme's own subtree.
            }
        };
    }, [base]);

    // Stock panels render the entry from the route table; hide that one when the
    // server is not Minecraft.
    useLayoutEffect(() => {
        try {
            document
                .querySelectorAll<HTMLElement>('a[href$="/world-manager"]:not([data-world-manager-portal])')
                .forEach((link) => {
                    const target = (link.closest('li') as HTMLElement | null) ?? link;
                    target.style.display = minecraft ? '' : 'none';
                });
        } catch {
            // Nothing to hide.
        }
    });

    if (!minecraft || native || !ready || !template || !mount.current) {
        return null;
    }

    return createPortal(
        <NavLink
            to={`${base}/world-manager`}
            className={template.link}
            data-world-manager-portal={'true'}
            draggable={false}
        >
            <span className={template.icon}>
                <FontAwesomeIcon icon={faGlobe} />
            </span>
            <span className={template.label}>World Manager</span>
        </NavLink>,
        mount.current
    );
}

/**
 * This component is mounted in ServerRouter, which sits outside Pterodactyl's
 * own error boundary: an exception here would blank the entire panel, sidebar
 * included. Its own boundary makes the worst case a missing sidebar entry.
 */
export default class WorldManagerGuard extends React.Component<Record<string, never>, { failed: boolean }> {
    // Assigned in the constructor rather than as a class property so the build
    // does not depend on the class-properties babel plugin being enabled.
    constructor(props: Record<string, never>) {
        super(props);
        this.state = { failed: false };
    }

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error: Error) {
        console.error('[world-manager] sidebar injection disabled after an error:', error);
    }

    render() {
        return this.state.failed ? null : <Injector />;
    }
}
