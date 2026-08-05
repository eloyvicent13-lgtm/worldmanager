import { ServerContext } from '@/state/server';

/**
 * Docker images used by Minecraft eggs. `java` on its own is intentionally
 * included: every mainstream Minecraft egg runs on one of the java yolks.
 */
const MINECRAFT_IMAGE =
    /(java|minecraft|paper|purpur|pufferfish|spigot|bukkit|forge|fabric|quilt|sponge|mohist|magma|arclight|folia|bedrock|pocketmine|nukkit|bungee|waterfall|velocity)/i;

export const isMinecraftServer = (dockerImage?: string | null, eggFeatures?: string[] | null): boolean => {
    if ((eggFeatures || []).includes('eula')) {
        return true;
    }

    return MINECRAFT_IMAGE.test(dockerImage || '');
};

/**
 * Must only be called from a component rendered inside the server context.
 */
export default function useIsMinecraft(): boolean {
    const dockerImage = ServerContext.useStoreState((state) => state.server.data?.dockerImage);
    const eggFeatures = ServerContext.useStoreState((state) => state.server.data?.eggFeatures);

    return isMinecraftServer(dockerImage, eggFeatures);
}
