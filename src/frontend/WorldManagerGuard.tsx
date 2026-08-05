import { useLayoutEffect } from 'react';
import useIsMinecraft from '@/worldmanager/useIsMinecraft';

/**
 * The sub navigation is built from a static route table, so there is no clean
 * hook to filter a single entry per server type. This guard is mounted next to
 * the navigation and removes the World Manager link whenever the current server
 * is not a Minecraft server. It runs in a layout effect, so the link is gone
 * before the browser paints and never flashes.
 *
 * The route itself stays registered; the API returns 404 for non-Minecraft
 * servers, so nothing is reachable by guessing the URL.
 */
export default function WorldManagerGuard(): null {
    const minecraft = useIsMinecraft();

    useLayoutEffect(() => {
        const links = document.querySelectorAll<HTMLElement>('a[href$="/world-manager"]');

        links.forEach((link) => {
            const target = (link.closest('li') as HTMLElement | null) ?? link;
            target.style.display = minecraft ? '' : 'none';
        });
    });

    return null;
}
