import React, { useEffect, useLayoutEffect, useState } from 'react';
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
 * theme's markup, this component portals a real NavLink into the theme's own
 * navigation group and copies the class names of a neighbouring item, so the
 * entry inherits whatever styling that theme uses.
 *
 * It also hides the link again on servers that are not Minecraft.
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
        group.querySelector<HTMLElement>('a[href^="/server/"]') ??
        document.querySelector<HTMLElement>(`a[href="${base}/files"]`);

    const spans = sample ? Array.from(sample.querySelectorAll<HTMLElement>(':scope > span')) : [];

    return {
        link: sample?.className ?? '',
        icon: spans[0]?.className ?? '',
        label: spans[1]?.className ?? '',
    };
};

export default function WorldManagerGuard(): React.ReactPortal | null {
    const minecraft = useIsMinecraft();
    const id = ServerContext.useStoreState((state) => state.server.data?.id);
    const base = id ? `/server/${id}` : '';

    const [group, setGroup] = useState<HTMLElement | null>(null);
    const [template, setTemplate] = useState<Template | null>(null);
    // True when the panel already renders the entry itself (stock sub navigation),
    // in which case injecting a second one would duplicate it.
    const [native, setNative] = useState(false);

    // The theme owns the sidebar, so watch it for re-renders instead of assuming
    // the nodes found on mount stay around.
    useEffect(() => {
        if (!base) {
            return;
        }

        const locate = () => {
            const link = document.querySelector('a[href$="/world-manager"]');
            setNative(!!link && link.getAttribute('data-world-manager-portal') !== 'true');

            const found = groupFor(base);
            setGroup((current) => (current === found ? current : found));
            if (found) {
                setTemplate((current) => {
                    const next = templateFrom(found, base);

                    return current && current.link === next.link && current.icon === next.icon ? current : next;
                });
            }
        };

        locate();

        // Scope the observer to the navigation; watching the whole document would
        // fire on every console line.
        const root = document.querySelector('aside') ?? document.querySelector('nav');
        if (!root) {
            return;
        }

        const observer = new MutationObserver(locate);
        observer.observe(root, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, [base]);

    // Stock panels render the entry from the route table; hide that one when the
    // server is not Minecraft, and leave it alone when it is so we do not end up
    // with the link twice.
    useLayoutEffect(() => {
        document.querySelectorAll<HTMLElement>('a[href$="/world-manager"]').forEach((link) => {
            if (link.dataset.worldManagerPortal === 'true') {
                return;
            }
            const target = (link.closest('li') as HTMLElement | null) ?? link;
            target.style.display = minecraft ? '' : 'none';
        });
    });

    if (!minecraft || native || !base || !group || !template) {
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
        group
    );
}
